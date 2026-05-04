import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

const FIELDS = [
  { off: 0x04, size: 2, name: 'Drive_State',         type: 'u16',   freq: 20000, color: '#00ccff', writer: 'Control_Motor_FOC_Update', reader: 'Logic, Telemetry', desc: 'Текущее состояние драйвера FOC: 0 = off, 2 = transition, 10 = running.' },
  { off: 0x06, size: 2, name: 'Alarm_State',         type: 'u16',   freq: 5,     color: '#ff9933', writer: 'Control_Telemetry_Task',   reader: 'Balance, Logic',   desc: 'Байт тревоги. 1 = активен tiltback, 2 = критическая температура.' },
  { off: 0x08, size: 2, name: 'Motor_Running',       type: 'u16',   freq: 100,   color: '#33ff99', writer: 'Logic_Settings_And_Buttons', reader: 'FOC_Update',      desc: 'Глобальный разрешительный флаг: 1 — мотор активен, 0 — PWM выключен.' },
  { off: 0x0A, size: 2, name: 'Error_Flag',          type: 'u16',   freq: 0,     color: '#ff3366', writer: 'FOC_Update (on fault)',    reader: 'Logic',            desc: 'Защёлка аварии. После установки в 1 сбрасывается только перезагрузкой.' },
  { off: 0x0C, size: 4, name: 'Rotor_Angle_Raw',     type: 'u32',   freq: 20000, color: '#00ccff', writer: 'Flux_Observer_Update',     reader: 'Park, InvPark',    desc: 'Электрический угол ротора 0..65535 = 0..360°. Обновляется каждый ISR.' },
  { off: 0x10, size: 4, name: 'I_Alpha_Beta',        type: 'i16×2', freq: 20000, color: '#00ccff', writer: 'Clarke_Transform',         reader: 'Park_Transform',   desc: 'Упакованные токи в стационарной α/β системе. [15:0] = α, [31:16] = β.' },
  { off: 0x14, size: 2, name: 'I_D_Measured',        type: 'i16',   freq: 20000, color: '#00ccff', writer: 'Park_Transform',           reader: 'PI_D',             desc: 'Измеренный ток по оси D (намагничивающий). В нормальном режиме ≈ 0.' },
  { off: 0x16, size: 2, name: 'I_Q_Measured',        type: 'i16',   freq: 20000, color: '#00ccff', writer: 'Park_Transform',           reader: 'PI_Q, Supervisor', desc: 'Ток по оси Q — тяговый. Это то, что регулирует PD баланса.' },
  { off: 0x18, size: 2, name: 'iq_target',           type: 'i16',   freq: 20000, color: '#00ccff', writer: 'Balance_PD',               reader: 'PI_Q',             desc: 'Целевой ток Q. Результат PD контура баланса.' },
  { off: 0x1A, size: 2, name: 'id_target',           type: 'i16',   freq: 1000,  color: '#33ff99', writer: 'Field_Weakening_Ctrl',     reader: 'PI_D',             desc: 'Целевой ток D. В основном 0, уходит в минус при ослаблении поля.' },
  { off: 0x1C, size: 4, name: 'imu_pitch_packed',    type: 'pack32',freq: 20000, color: '#cc88ff', writer: 'IMU_Fusion_Step',          reader: 'Balance_PD',       desc: 'Упаковка: [31:16] = угол × 100, [15:0] = скорость × 10. Одно слово — полный вектор.' },
  { off: 0x20, size: 4, name: 'V_alpha_beta',        type: 'i16×2', freq: 20000, color: '#00ccff', writer: 'InvPark',                  reader: 'SVPWM',            desc: 'Упакованные напряжения в α/β. Входят в модуль SVPWM.' },
  { off: 0x24, size: 2, name: 'V_D_Output',          type: 'i16',   freq: 20000, color: '#00ccff', writer: 'PI_D',                     reader: 'InvPark',          desc: 'Выход PI регулятора оси D.' },
  { off: 0x26, size: 2, name: 'V_Q_Output',          type: 'i16',   freq: 20000, color: '#00ccff', writer: 'PI_Q',                     reader: 'InvPark',          desc: 'Выход PI регулятора оси Q.' },
  { off: 0x2C, size: 2, name: 'EUC_Balance_Kp',      type: 'u16',   freq: 0,     color: '#ff6633', writer: 'BLE_command_handler',      reader: 'Balance_PD',       desc: 'Жёсткость педалей (Hardness). Меняется из приложения, между ISR.' },
  { off: 0x2E, size: 2, name: 'EUC_Balance_Kd',      type: 'u16',   freq: 0,     color: '#ff6633', writer: 'BLE_command_handler',      reader: 'Balance_PD',       desc: 'Демпфирование (Damping). Пара к Kp.' },
  { off: 0x30, size: 2, name: 'FW_Target',           type: 'i16',   freq: 1000,  color: '#33ff99', writer: 'Field_Weakening_Ctrl',     reader: 'PI_D target',      desc: 'Требуемое ослабление поля, нормированное.' },
  { off: 0x32, size: 2, name: 'FW_Filter',           type: 'i16',   freq: 1000,  color: '#33ff99', writer: 'Field_Weakening_Ctrl',     reader: 'FW_ramp',          desc: 'Сглаженный FW_Target через slew-rate limiter.' },
  { off: 0x34, size: 4, name: 'motor_temp',          type: 'float', freq: 100,   color: '#ffcc00', writer: 'ADC_temp_handler',         reader: 'Thermal_Ctrl',     desc: 'Температура корпуса мотора, °C. Из NTC на статоре.' },
  { off: 0x38, size: 4, name: 'v_bus',               type: 'float', freq: 1000,  color: '#33ff99', writer: 'ADC_Vbat_handler',         reader: 'V-limit, FW',      desc: 'Напряжение на шине батареи, V. Критично для ограничения модуляции.' },
  { off: 0x3C, size: 4, name: 'current_batt',        type: 'float', freq: 1000,  color: '#33ff99', writer: 'Power_Calc',               reader: 'Telemetry',        desc: 'Ток от батареи (не фазный). Вычисляется из P=Vbus·Ibus.' },
  { off: 0x40, size: 4, name: 'wheel_speed_kmh',     type: 'float', freq: 1000,  color: '#33ff99', writer: 'Flux_integration',         reader: 'Supervisor, BLE',  desc: 'Скорость колеса. Интеграл угловой скорости × радиус × перевод.' },
  { off: 0x48, size: 2, name: 'pwm_duty',            type: 'i16',   freq: 20000, color: '#00ccff', writer: 'FOC_Update',               reader: 'PWM_write',        desc: 'Промежуточное значение duty для диагностики. Магнитуда вектора.' },
  { off: 0x4A, size: 2, name: 'mode',                type: 'u16',   freq: 0,     color: '#ff6633', writer: 'Button_Handler',           reader: 'Logic',            desc: 'Режим: 0 = Soft (40 км/ч), 1 = Medium (50), 2 = Hard (60).' },
]

const FieldCell = ({ field, selected, onSelect }) => {
  const [pulseKey, setPulseKey] = useState(0)
  const isPulsing = field.freq > 0

  useEffect(() => {
    if (!isPulsing) return
    // Simulate write events at the given frequency (capped for visual clarity)
    const displayFreq = Math.min(field.freq, 20)
    const interval = 1000 / displayFreq
    const id = setInterval(() => setPulseKey(k => k + 1), interval)
    return () => clearInterval(id)
  }, [field.freq, isPulsing])

  return (
    <div onClick={() => onSelect(field.off === selected ? null : field.off)}
      style={{
        background: selected === field.off ? `${field.color}22` : '#0a0a0a',
        border: `1px solid ${selected === field.off ? field.color : '#1a1a1a'}`,
        borderRadius: '6px',
        padding: '8px 10px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.15s',
      }}>
      {isPulsing && (
        <div key={pulseKey} style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: field.color,
          opacity: 0.25,
          animation: 'cellPulse 0.4s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <code style={{ fontSize: '9px', color: '#2a4a6a', fontFamily: 'monospace' }}>
            +0x{field.off.toString(16).toUpperCase().padStart(2, '0')}
          </code>
          <code style={{ fontSize: '8px', color: '#333', fontFamily: 'monospace' }}>{field.type}</code>
        </div>
        <div style={{ fontSize: '11px', fontWeight: '700', color: selected === field.off ? field.color : '#aaa', marginBottom: '3px' }}>
          {field.name}
        </div>
        <div style={{ fontSize: '8px', color: '#444', letterSpacing: '1px' }}>
          {field.freq === 0 ? 'ON-EVENT' : field.freq >= 1000 ? `${field.freq / 1000} kHz` : `${field.freq} Hz`}
        </div>
      </div>
    </div>
  )
}

const RAMViewer = () => {
  const [selected, setSelected] = useState(null)
  const sel = FIELDS.find(f => f.off === selected)

  return (
    <div>
      <style>{`
        @keyframes cellPulse {
          0% { opacity: 0.5; }
          100% { opacity: 0; }
        }
      `}</style>

      <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#333', letterSpacing: '2px' }}>motor_state @ 0x200000A0</div>
            <div style={{ fontSize: '14px', color: '#aaa', marginTop: '2px' }}>Главная структура состояния · ~84 байта SRAM</div>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '9px' }}>
            <LegendDot color="#00ccff" label="20 kHz (ISR)" />
            <LegendDot color="#33ff99" label="1 kHz" />
            <LegendDot color="#ffcc00" label="100 Hz" />
            <LegendDot color="#ff9933" label="5 Hz" />
            <LegendDot color="#ff6633" label="On event" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {FIELDS.map(f => (
            <FieldCell key={f.off} field={f} selected={selected} onSelect={setSelected} />
          ))}
        </div>
      </div>

      {sel && (
        <div style={{ background: '#0d0d0d', border: `1px solid ${sel.color}44`, borderRadius: '10px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '9px', color: sel.color, letterSpacing: '3px', marginBottom: '4px' }}>
                0x{(0x200000A0 + sel.off).toString(16).toUpperCase()} · {sel.type} · {sel.size} байт
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>{sel.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px' }}>ЧАСТОТА ОБНОВЛЕНИЯ</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: sel.color }}>
                {sel.freq === 0 ? 'on-event' : sel.freq >= 1000 ? `${sel.freq / 1000} kHz` : `${sel.freq} Hz`}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '14px', color: '#aaa', lineHeight: 1.7, marginBottom: '16px' }}>{sel.desc}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '9px', color: '#ff3366', letterSpacing: '2px', marginBottom: '4px' }}>ПИШЕТ</div>
              <code style={{ fontSize: '12px', color: '#ddd', fontFamily: 'JetBrains Mono, monospace' }}>{sel.writer}</code>
            </div>
            <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '9px', color: '#33ff99', letterSpacing: '2px', marginBottom: '4px' }}>ЧИТАЕТ</div>
              <code style={{ fontSize: '12px', color: '#ddd', fontFamily: 'JetBrains Mono, monospace' }}>{sel.reader}</code>
            </div>
          </div>
        </div>
      )}

      {!sel && (
        <div style={{ textAlign: 'center', color: '#333', fontSize: '12px', padding: '30px 0' }}>
          Нажмите на поле, чтобы увидеть кто его пишет и читает
        </div>
      )}
    </div>
  )
}

const LegendDot = ({ color, label }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#555' }}>
    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }}></span>
    {label}
  </span>
)

export default function RAMMapChapter() {
  return (
    <ChapterLayout eyebrow="Глава VI" title="Карта" subtitle="RAM-структура motor_state и потоки данных между функциями">
      <Section>
        <Prose>
          Все остальные главы говорят об алгоритмах — как считать угол, как выработать ток, как проверить безопасность. Эта глава — о том, где эти значения физически живут. В прошивке ET Max есть одна глобальная структура по адресу <InlineCode>0x200000A0</InlineCode>, через которую все функции обмениваются состоянием. Около 84 байт, примерно 25 полей. Каждое — либо вход для одной функции, либо выход для другой.
        </Prose>
        <Prose>
          При реверсе прошивки эту структуру восстанавливают в первую очередь. Без неё декомпилированный код выглядит как <InlineCode>*(int*)(DAT_xxx + 0x14)</InlineCode> везде, и понять, что происходит, невозможно. После именования полей — код становится читаемым почти как исходник.
        </Prose>
      </Section>

      <InteractivePanel title="Живая карта motor_state · пульс = запись в память">
        <RAMViewer />
      </InteractivePanel>

      <Section title="Потоки данных за один ISR">
        <Prose>
          Посмотрите на цепочку обновлений в пределах одного срабатывания ISR. Она образует строгий порядок, и если бы кто-то из участников вдруг прочитал чужое значение до его записи — получили бы один такт старых данных, что на 20 кГц уже заметно как джиттер.
        </Prose>
        <CodeBlock
          label="foc.c · последовательность записей в motor_state"
          address="0x08013974"
          code={`void Control_Motor_FOC_Update(void) {
    // 1. Угол ротора из Flux Observer
    motor_state->Rotor_Angle_Raw = Control_Flux_Observer_Angle();

    // 2. Сырые токи фаз → Clarke α/β
    motor_state->I_Alpha_Beta_Vector = Clarke(ADC_Get_Phase_Currents());

    // 3. Park: α/β → D/Q (требует угол из шага 1)
    motor_state->I_D_Q_Vector = Math_Park_Inverse(
        motor_state->Rotor_Angle_Raw,
        motor_state->I_Alpha_Beta_Vector);
    // I_D_Measured и I_Q_Measured — это I_D_Q_Vector в упакованной форме

    // 4. Баланс: угол IMU → желаемый iq
    motor_state->imu_raw_pitch_rate_angle = Control_IMU_Fusion_Step();
    // (iq_target вычисляется ниже, не кэшируется в memory)

    // 5. PI контуры: D и Q независимо
    motor_state->V_Q_Output = Math_PI_Controller(
        iq_target,
        motor_state->I_Q_Measured, PTR_PI_STRUCT_Q_AXIS);
    motor_state->V_D_Output = Math_PI_Controller(
        motor_state->Field_Weakening_Target * 23.0f,
        motor_state->I_D_Measured, PTR_PI_STRUCT_D_AXIS);

    // 6. V-limit и SVPWM (требует Vd, Vq из шага 5)
    motor_state->V_D_Q_Vector = Control_SVPWM_Modulation_Limit(...);

    // 7. Запись CCR (это уже не RAM, это регистры TIM1)
}`}
        />
      </Section>

      <Section title="Выравнивание и упаковка">
        <Prose>
          Обратите внимание на поля типа <InlineCode>pack32</InlineCode>: это два 16-битных значения, упакованных в одно 32-битное слово. Например, <InlineCode>imu_pitch_packed</InlineCode> содержит угол и угловую скорость в одном LDR. Это не экономия памяти (SRAM на F405 192 КБ — избыток), это экономия инструкций: одно чтение вместо двух. При 20 кГц ISR каждая инструкция важна.
        </Prose>
        <CodeBlock
          label="motor_state struct layout (C)"
          code={`#pragma pack(push, 1)
typedef struct {
    uint32_t magic;                     // +0x00
    uint16_t Drive_State;               // +0x04
    uint16_t Alarm_State;               // +0x06
    uint16_t Motor_Running;             // +0x08
    uint16_t Error_Flag;                // +0x0A
    uint32_t Rotor_Angle_Raw;           // +0x0C
    int16_t  I_Alpha;                   // +0x10
    int16_t  I_Beta;                    // +0x12
    int16_t  I_D_Measured;              // +0x14
    int16_t  I_Q_Measured;              // +0x16
    int16_t  iq_target;                 // +0x18
    int16_t  id_target;                 // +0x1A
    int16_t  imu_pitch_angle_x100;      // +0x1C  (packed)
    int16_t  imu_pitch_rate_x10;        // +0x1E  (packed with above)
    int16_t  V_alpha, V_beta;           // +0x20, +0x22
    int16_t  V_D_Output, V_Q_Output;    // +0x24, +0x26
    uint32_t _reserved;                 // +0x28
    uint16_t EUC_Balance_Kp;            // +0x2C
    uint16_t EUC_Balance_Kd;            // +0x2E
    int16_t  Field_Weakening_Target;    // +0x30
    int16_t  Field_Weakening_Filter;    // +0x32
    float    motor_temp;                // +0x34
    float    v_bus;                     // +0x38
    float    current_batt;              // +0x3C
    float    wheel_speed_kmh;           // +0x40
    void*    motor_ctrl_params;         // +0x44
    int16_t  pwm_duty;                  // +0x48
    uint16_t mode;                      // +0x4A
} motor_state_t;
#pragma pack(pop)

volatile motor_state_t *motor_state = (void*)0x200000A0;`}
        />
      </Section>

      <Callout color="#00ccff" label="Почему volatile">
        Структура помечена <InlineCode>volatile</InlineCode> не просто так. Её читают и пишут из разных контекстов: ISR (20 кГц FOC), другой ISR (1 кГц IMU), главный цикл (state machine), BLE-команды. Без <InlineCode>volatile</InlineCode> компилятор оптимизировал бы повторные чтения в регистр, и ISR увидел бы устаревшее значение Kp после его обновления из приложения. Именно такие баги — причина загадочных «иногда колесо ведёт себя странно после настройки».
      </Callout>

      <Section title="Как реверсить такую структуру">
        <Prose>
          В Ghidra восстановление структуры начинается с поиска точки, куда все ссылаются. Находим <InlineCode>0x200000A0</InlineCode> (либо по первому LDR с базовым адресом, либо по Cross-References). Создаём struct. Затем методично: берём каждое использование <InlineCode>*(base + 0x??)</InlineCode>, смотрим на соседний код, догадываемся о семантике поля, даём ему имя. Сначала очевидные (IMU данные пишутся сразу после чтения SPI), потом по распространению.
        </Prose>
        <Prose>
          Правило: одно поле в день. Не больше. Если быстрее — значит, додумываешь, а не анализируешь. За месяц работы такая структура становится полностью расшифрованной, и дальше разбор остальных функций идёт в разы быстрее.
        </Prose>
      </Section>
    </ChapterLayout>
  )
}
