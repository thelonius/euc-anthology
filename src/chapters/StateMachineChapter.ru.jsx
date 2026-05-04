import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

const STATES = {
  POR:          { x: 80,  y: 60,  label: 'POR',         full: 'Power-On Reset',         color: '#666',    group: 'boot',  dur: 300 },
  CLOCK:        { x: 80,  y: 130, label: 'CLOCK',       full: 'HSE → PLL 168 MHz',      color: '#666',    group: 'boot',  dur: 200 },
  PERIPH:       { x: 80,  y: 200, label: 'PERIPH',      full: 'TIM, ADC, SPI, USART',   color: '#888',    group: 'boot',  dur: 500 },
  IMU_WARM:     { x: 80,  y: 270, label: 'IMU_WARM',    full: 'MPU6500 stabilize',      color: '#33ff99', group: 'boot',  dur: 1000 },
  GYRO_CAL:     { x: 80,  y: 340, label: 'GYRO_CAL',    full: '200 samples → bias',     color: '#33ff99', group: 'boot',  dur: 400 },
  ADC_CAL:      { x: 80,  y: 410, label: 'ADC_CAL',     full: 'Current shunt offset',   color: '#ffcc00', group: 'boot',  dur: 200 },
  BMS_WAIT:     { x: 80,  y: 480, label: 'BMS_WAIT',    full: 'UART handshake',         color: '#ffcc00', group: 'boot',  dur: 300 },
  IDLE:         { x: 280, y: 340, label: 'IDLE_LEVEL',  full: 'Педали ровно, ждём посадку', color: '#00ccff', group: 'run', dur: null },
  ARMED:        { x: 440, y: 340, label: 'ARMED',       full: 'Мотор активен, баланс', color: '#00ccff', group: 'run',  dur: null },
  RUNNING:      { x: 600, y: 340, label: 'RUNNING',     full: 'Движение',               color: '#00ccff', group: 'run',  dur: null },
  TILTBACK:     { x: 600, y: 450, label: 'TILTBACK',    full: 'Принудительный наклон педалей назад', color: '#ff9933', group: 'warn', dur: null },
  FAULT:        { x: 440, y: 450, label: 'FAULT',       full: 'Cutout — мотор отключён', color: '#ff3366', group: 'fault',dur: null },
}

const BOOT_SEQ = ['POR', 'CLOCK', 'PERIPH', 'IMU_WARM', 'GYRO_CAL', 'ADC_CAL', 'BMS_WAIT', 'IDLE']

const TRANSITIONS = [
  ['POR', 'CLOCK'], ['CLOCK', 'PERIPH'], ['PERIPH', 'IMU_WARM'],
  ['IMU_WARM', 'GYRO_CAL'], ['GYRO_CAL', 'ADC_CAL'], ['ADC_CAL', 'BMS_WAIT'], ['BMS_WAIT', 'IDLE'],
  ['IDLE', 'ARMED'], ['ARMED', 'IDLE'], ['ARMED', 'RUNNING'], ['RUNNING', 'ARMED'],
  ['RUNNING', 'TILTBACK'], ['TILTBACK', 'RUNNING'],
  ['RUNNING', 'FAULT'], ['ARMED', 'FAULT'], ['TILTBACK', 'FAULT'],
]

const STATE_DESC = {
  POR:      { title: 'Power-On Reset', desc: 'Векторная таблица по 0x08000000, стек установлен, PC → Reset_Handler. Бутлоадер по дефолту передаёт управление приложению по 0x08004000, если не нажата специальная кнопка для YMODEM-режима.', addr: '0x08000000', code: '// Reset_Handler\nSystemInit();  // в startup_stm32f405xx.s\n__main();      // C runtime → main()' },
  CLOCK:    { title: 'Конфигурация тактовой сети', desc: 'HSE 8 МГц → PLL ×21 /1 = 168 МГц SYSCLK. Настройка делителей шин: AHB=168, APB1=42, APB2=84 МГц. Flash latency = 5 wait states (требуется выше 150 МГц).', addr: '0x0800047C', code: 'RCC->CR  |= RCC_CR_HSEON;\nwhile (!(RCC->CR & RCC_CR_HSERDY));\nRCC->PLLCFGR = ... // PLLN=168, PLLM=8, PLLP=2\nRCC->CR  |= RCC_CR_PLLON;\nwhile (!(RCC->CR & RCC_CR_PLLRDY));\nFLASH->ACR = FLASH_ACR_LATENCY_5WS | FLASH_ACR_PRFTEN;\nRCC->CFGR = RCC_CFGR_SW_PLL;' },
  PERIPH:   { title: 'Инициализация периферии', desc: 'TIM1+TIM8 в центрированном режиме ШИМ, 20 кГц, dead-time 571 нс. ADC1 с injected-каналами на TRGO от TIM1. SPI1 @ 1 МГц для MPU6500. USART1 @ 115200 для BLE.', addr: '0x08000648', code: 'HAL_TIM_PWM_Init(&htim1);\nTIM1->BDTR |= 0x24;        // DTG = 96 * (4/Fck) = 571ns\nHAL_ADC_Init(&hadc1);\nADC1->CR2 |= ADC_CR2_JEXTEN_0 | ADC_CR2_JEXTSEL_0;\nHAL_SPI_Init(&hspi1);\nHAL_UART_Init(&huart1);' },
  IMU_WARM: { title: 'Прогрев IMU', desc: 'После подачи питания MPU6500 нужно ~30 мс на стабилизацию осцилятора. Прошивка ждёт ~1 секунду (с запасом) перед первым чтением данных, чтобы гироскоп не давал шум от переходных процессов внутри чипа.', addr: '0x08013EF8', code: '// Power-on: ждём 1000 мс для MPU стабилизации\nHAL_Delay(1000);\n// Проверка WHO_AM_I\nuint8_t id = mpu_read_reg(0x75);\nif (id != 0x70) fault();  // MPU6500 не отвечает\n// Настройка: Gyro ±250°/с, Accel ±2g, DLPF\nmpu_write_reg(0x1B, 0x00);\nmpu_write_reg(0x1C, 0x00);' },
  GYRO_CAL: { title: 'Калибровка нуля гироскопа', desc: 'Критически важный шаг: MEMS-гироскоп имеет смещение нуля (bias), которое плавает с температурой. Прошивка берёт 200 выборок при неподвижном положении и усредняет — это становится опорным нулём. Если в этот момент пошевелить колесо, гироскоп будет врать всю поездку.', addr: '0x08013354', code: 'int32_t sum_x = 0, sum_y = 0, sum_z = 0;\nfor (int i = 0; i < 200; i++) {\n    mpu_read_gyro(&gx, &gy, &gz);\n    sum_x += gx; sum_y += gy; sum_z += gz;\n    HAL_Delay(2);\n}\ngyro_bias_x = sum_x / 200;\ngyro_bias_y = sum_y / 200;\ngyro_bias_z = sum_z / 200;' },
  ADC_CAL:  { title: 'Оффсет токовых сенсоров', desc: 'Шунты измеряют ток как дифференциальное напряжение, усиленное OpAmp. При нулевом токе усилитель даёт не ровно 0 В, а ~V_ref/2 из-за смещения операционника. Прошивка делает ~100 замеров при отключённом моторе и запоминает средний уровень как "нулевой ток".', addr: '—', code: 'int32_t zero_a = 0, zero_b = 0;\nfor (int i = 0; i < 100; i++) {\n    zero_a += ADC1->JDR1;\n    zero_b += ADC1->JDR2;\n    HAL_Delay(1);\n}\ncurrent_offset_a = zero_a / 100;\ncurrent_offset_b = zero_b / 100;\n// Далее: i_phase = (ADC_raw - offset) * GAIN' },
  BMS_WAIT: { title: 'Handshake с BMS', desc: 'BMS (Battery Management System) передаёт данные по UART2: напряжение пакета, ток, температуру ячеек, SoC. Прошивка ждёт первый валидный пакет. Если BMS молчит 5 секунд — переход в FAULT. Это предотвращает езду с неисправной батареей.', addr: '—', code: 'uint32_t timeout = HAL_GetTick() + 5000;\nwhile (HAL_GetTick() < timeout) {\n    if (bms_packet_valid) {\n        bms_voltage = bms_data.voltage;\n        bms_current = bms_data.current;\n        return;  // готово\n    }\n    HAL_Delay(10);\n}\ngoto FAULT_BMS;' },
  IDLE:     { title: 'IDLE_LEVEL — ожидание посадки', desc: 'Мотор выключен (PWM = 0), но контур управления уже работает: IMU читается, угол вычисляется. Прошивка ждёт, пока угол наклона стабилизируется возле нуля и райдер поставит ногу. Условие выхода: |angle| < 2° И угловая скорость близка к нулю.', addr: '—', code: '// В главном цикле main()\nwhile (state == IDLE) {\n    float pitch = motor_state.imu_pitch_angle;\n    float rate  = motor_state.imu_pitch_rate;\n    if (fabsf(pitch) < 2.0f && fabsf(rate) < 5.0f) {\n        motor_state.Motor_Running = 1;\n        state = ARMED;\n    }\n}' },
  ARMED:    { title: 'ARMED — мотор активен', desc: 'Балансовый PD-регулятор начинает подавать Iq в мотор. Колесо стоит прямо, но ещё не едет. Переход в RUNNING случается при первом заметном перемещении (интеграл скорости колеса превысил порог) — этим отсекаются случайные срабатывания.', addr: '0x08013974', code: '// Активен PD контур\niq_target = -(Kp * angle + Kd * rate);\nif (fabsf(wheel_speed_kmh) > 0.5f) {\n    state = RUNNING;\n}' },
  RUNNING:  { title: 'RUNNING — нормальная работа', desc: 'Основной режим. FOC-ISR крутится на 20 кГц, телеметрия отправляется каждые 200 мс, супервизор проверяет пороги. В этом состоянии колесо проводит 99% времени эксплуатации.', addr: '0x08013974', code: '// Полный контур активен\nfoc_isr();           // 20 kHz\ntelemetry_task();    // 5 Hz\nsupervisor_check();  // 100 Hz' },
  TILTBACK: { title: 'TILTBACK — принудительное замедление', desc: 'Прошивка искусственно наклоняет педали назад, создавая негативный угол даже при нейтральной позе райдера. Это вынуждает снизить скорость. Триггеры: превышение скорости, высокая температура, низкий заряд. Автоматически снимается при исчезновении причины.', addr: '0x08018C2C', code: 'if (speed > speed_limit || temp > 60 || voltage < low_V) {\n    telemetry_state.alarm = 1;\n    // Смещение нулевой точки баланса\n    angle_setpoint = -5.0f;  // 5 градусов назад\n}' },
  FAULT:    { title: 'FAULT — аварийное отключение', desc: 'Мотор отключён: PWM = 0, все ключи закрыты. Причина — либо овертек (iq > 500 А), либо таймаут BMS. Выход из этого состояния только через перезагрузку питания — намеренно, чтобы райдер остановился и разобрался.', addr: '—', code: 'if (fabsf(iq_measured) > 500.0f) {\n    HAL_PWM_Set_Duty_Cycle(0, 0, 0);\n    motor_state.Error_Flag = 1;\n    motor_state.Motor_Running = 0;\n    while (1) {  // блокировка до перезагрузки\n        beep();\n        HAL_Delay(500);\n    }\n}' },
}

const Diagram = ({ current, onSelect, hover }) => {
  const w = 700, h = 540
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: '720px', display: 'block', margin: '0 auto' }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#2a2a2a" />
        </marker>
        <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#00ccff" />
        </marker>
        <filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {/* Group labels */}
      <text x="20" y="30" fontSize="9" fill="#2a2a2a" letterSpacing="3" fontFamily="Inter">BOOT SEQUENCE</text>
      <text x="280" y="310" fontSize="9" fill="#2a2a2a" letterSpacing="3" fontFamily="Inter">RUNTIME</text>
      <text x="440" y="420" fontSize="9" fill="#2a2a2a" letterSpacing="3" fontFamily="Inter">EXCEPTIONS</text>

      {/* Transitions */}
      {TRANSITIONS.map(([from, to], i) => {
        const a = STATES[from], b = STATES[to]
        const isActive = current === from || current === to
        const dx = b.x - a.x, dy = b.y - a.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const offset = 26
        const x1 = a.x + (dx / len) * offset
        const y1 = a.y + (dy / len) * offset
        const x2 = b.x - (dx / len) * (offset + 4)
        const y2 = b.y - (dy / len) * (offset + 4)
        // curve slightly if bidirectional
        const bidir = TRANSITIONS.some(([f, t]) => f === to && t === from)
        const perp = bidir ? { x: -dy / len * 8, y: dx / len * 8 } : { x: 0, y: 0 }
        const mx = (x1 + x2) / 2 + perp.x
        const my = (y1 + y2) / 2 + perp.y
        return (
          <path key={i} d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
            fill="none" stroke={isActive ? '#00ccff' : '#1e1e1e'} strokeWidth={isActive ? 1.5 : 1}
            markerEnd={isActive ? 'url(#arrow-active)' : 'url(#arrow)'} opacity={isActive ? 1 : 0.7} />
        )
      })}

      {/* States */}
      {Object.entries(STATES).map(([id, s]) => {
        const isCurrent = current === id
        const isHover = hover === id
        return (
          <g key={id} onClick={() => onSelect(id)} style={{ cursor: 'pointer' }}>
            <circle cx={s.x} cy={s.y} r={26}
              fill={isCurrent ? s.color + '33' : '#0e0e0e'}
              stroke={isCurrent ? s.color : (isHover ? s.color + '88' : '#1e1e1e')}
              strokeWidth={isCurrent ? 2 : 1}
              filter={isCurrent ? 'url(#glow)' : ''} />
            {isCurrent && <circle cx={s.x} cy={s.y} r={32} fill="none" stroke={s.color} strokeWidth="0.5" opacity="0.4">
              <animate attributeName="r" values="28;38;28" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="1.8s" repeatCount="indefinite" />
            </circle>}
            <text x={s.x} y={s.y + 2} textAnchor="middle" fontSize="9"
              fill={isCurrent ? s.color : (isHover ? '#aaa' : '#555')}
              fontFamily="JetBrains Mono, monospace" fontWeight="700">{s.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

const BootPlayer = () => {
  const [current, setCurrent] = useState('POR')
  const [playing, setPlaying] = useState(false)
  const [hover, setHover] = useState(null)
  const timerRef = useRef(null)

  const play = () => {
    setPlaying(true)
    setCurrent('POR')
    let i = 0
    const advance = () => {
      if (i >= BOOT_SEQ.length - 1) { setPlaying(false); return }
      const state = BOOT_SEQ[i]
      const dur = STATES[state].dur || 300
      timerRef.current = setTimeout(() => {
        i++
        setCurrent(BOOT_SEQ[i])
        advance()
      }, dur)
    }
    setCurrent(BOOT_SEQ[0])
    advance()
  }

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPlaying(false)
    setCurrent('POR')
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const info = STATE_DESC[current]

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
        <button onClick={play} disabled={playing}
          style={{ padding: '10px 22px', background: playing ? '#1a1a1a' : '#00ccff22', border: `1px solid ${playing ? '#2a2a2a' : '#00ccff44'}`, borderRadius: '8px', color: playing ? '#444' : '#00ccff', cursor: playing ? 'default' : 'pointer', fontSize: '12px', fontWeight: '700' }}>
          {playing ? '⟳ Загрузка...' : '▶ Проиграть загрузку'}
        </button>
        <button onClick={reset}
          style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #333', borderRadius: '8px', color: '#555', cursor: 'pointer', fontSize: '12px' }}>
          Сброс
        </button>
        {['IDLE', 'ARMED', 'RUNNING', 'TILTBACK', 'FAULT'].map(s => (
          <button key={s} onClick={() => { reset(); setCurrent(s) }}
            style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${STATES[s].color}44`, borderRadius: '6px', color: STATES[s].color + 'cc', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' }}>
            {STATES[s].label}
          </button>
        ))}
      </div>

      <Diagram current={current} onSelect={(id) => { reset(); setCurrent(id) }} hover={hover} />

      {info && (
        <div style={{ marginTop: '24px', background: '#0d0d0d', border: `1px solid ${STATES[current].color}33`, borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '9px', color: STATES[current].color, letterSpacing: '3px', marginBottom: '6px' }}>{STATES[current].label}</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>{info.title}</div>
            </div>
            {info.addr !== '—' && <span style={{ fontSize: '10px', color: '#2a4a6a', fontFamily: 'monospace' }}>{info.addr}</span>}
          </div>
          <div style={{ fontSize: '14px', color: '#999', lineHeight: 1.7, marginBottom: '16px' }}>{info.desc}</div>
          <pre style={{ background: '#080810', border: '1px solid #1a1a28', borderRadius: '6px', padding: '14px', fontSize: '12px', color: '#8ba', overflowX: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>
            {info.code}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function StateMachineChapter() {
  return (
    <ChapterLayout eyebrow="Глава IV" title="Состояния" subtitle="Жизненный цикл прошивки от POR до FAULT">
      <Section>
        <Prose>
          Прошивка ET Max — это не одна большая программа в цикле. Это конечный автомат с двенадцатью состояниями, и каждое имеет свой набор активных ISR, проверок и триггеров перехода. Между включением питания и поездкой колесо проходит через семь последовательных стадий загрузки, каждая с чёткой целью.
        </Prose>
        <Prose>
          Понимание этого автомата — ключ ко всему остальному. Когда в коде встречается проверка <InlineCode>motor_state.Motor_Running</InlineCode>, её значение зависит от того, в каком состоянии сейчас колесо. Если не знать переходов между состояниями, декомпиляция превращается в гадание.
        </Prose>
      </Section>

      <InteractivePanel title="Интерактивная диаграмма состояний · нажмите «Проиграть загрузку»">
        <BootPlayer />
      </InteractivePanel>

      <Section title="Три ошибки, которые выдают любительскую прошивку">
        <Prose>
          <strong style={{ color: '#ff3366' }}>1. Пропуск <InlineCode>IMU_WARM</InlineCode>.</strong> Самодельщики часто начинают читать гироскоп сразу после подачи питания. MPU6500 в первые 30 мс выдаёт сырой шум. Если на этих данных сразу откалибровать bias, ошибка сохранится до выключения.
        </Prose>
        <Prose>
          <strong style={{ color: '#ff9933' }}>2. Калибровка bias во время езды.</strong> Заманчиво «адаптивно» обновлять нулевой уровень гироскопа. Но если райдер наклонён вперёд стабильно (разгон), адаптация решит, что это новый ноль, и колесо начнёт требовать ещё большего наклона для той же скорости. Закончится CUTOUT.
        </Prose>
        <Prose>
          <strong style={{ color: '#ffcc00' }}>3. Отсутствие <InlineCode>BMS_WAIT</InlineCode> таймаута.</strong> Некоторые прошивки стартуют без проверки BMS. Если батарея неисправна и не отвечает по UART, колесо поедет «вслепую». Первая же крупная нагрузка выбьет защиту пакета, и это будет похоже на cutout, хотя причина совсем другая.
        </Prose>
      </Section>

      <Section title="Код автомата в прошивке">
        <Prose>
          Сам диспетчер состояний находится в функции <InlineCode>Logic_Settings_And_Buttons</InlineCode> по адресу <InlineCode>0x08013354</InlineCode>. Это не один большой switch, а серия проверок в главном цикле, которые меняют глобальные флаги.
        </Prose>
        <CodeBlock
          label="logic.c · диспетчер состояний (реконструкция)"
          address="0x08013354"
          code={`// Глобальный флаг состояния в RAM
volatile uint8_t system_state = STATE_POR;

void Logic_Settings_And_Buttons(void) {
    switch (system_state) {
    case STATE_BOOT_DONE:
        if (fabsf(motor_state.pitch) < 2.0f &&
            fabsf(motor_state.pitch_rate) < 5.0f) {
            system_state = STATE_IDLE_LEVEL;
        }
        break;

    case STATE_IDLE_LEVEL:
        // Детектор посадки: угол нарос или вес пришёл
        if (pedal_switch_active() || fabsf(motor_state.pitch) > 3.0f) {
            motor_state.Motor_Running = 1;  // включаем FOC
            system_state = STATE_ARMED;
        }
        break;

    case STATE_ARMED:
        if (fabsf(motor_state.wheel_speed_kmh) > 0.5f) {
            system_state = STATE_RUNNING;
        }
        // Детектор спешивания: вес ушёл
        if (!pedal_switch_active() &&
            fabsf(motor_state.wheel_speed_kmh) < 0.1f) {
            motor_state.Motor_Running = 0;
            system_state = STATE_IDLE_LEVEL;
        }
        break;

    case STATE_RUNNING:
        // Супервизор проверяет пороги и при срабатывании:
        if (telemetry_state.alarm_active) {
            system_state = STATE_TILTBACK;
        }
        if (motor_state.Error_Flag) {
            HAL_PWM_Set_Duty_Cycle(0, 0, 0);
            system_state = STATE_FAULT;
        }
        break;
    }
}`}
        />
      </Section>

      <Callout color="#00ccff" label="Ключевое наблюдение">
        Переход <InlineCode>IDLE → ARMED</InlineCode> — самый опасный момент в жизненном цикле. В этот момент ранее выключенные силовые ключи получают команду на замкнутый контур. Если в этот момент есть неисправность (например, пробитый нижний MOSFET), баг проявится именно сейчас, при первом ненулевом PWM. Поэтому прошивка перед переходом проверяет ADC на ток: если уже есть ток без PWM — значит, пробой, сразу в <InlineCode>FAULT</InlineCode>.
      </Callout>
    </ChapterLayout>
  )
}
