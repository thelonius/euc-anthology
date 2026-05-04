import { h } from 'preact'
import { useState } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

const PERIPHERALS = [
  { id: 'batt',   label: 'Батарея 168V',  color: '#ff6633', category: 'power',  desc: 'Литиевый пак ~50 Ah, 168V номинал (до 201.6V заряженный). Внутреннее сопротивление ~0.12 Ом влияет на просадку напряжения при пиковом токе.', addr: '—' },
  { id: 'gate',   label: 'Gate Driver',   color: '#ff6633', category: 'power',  desc: 'Драйвер затвора MOSFET. Принимает 3.3V PWM сигналы от STM32 и формирует мощные импульсы для открытия/закрытия транзисторов. Содержит bootstrap-конденсаторы для верхних ключей.', addr: '—' },
  { id: 'mosfet', label: 'MOSFET 3-Phase',color: '#ff9933', category: 'power',  desc: '6 силовых MOSFET (верхний и нижний ключ на каждую фазу). PWM формируется TIM1 с аппаратной вставкой dead-time 571 нс через регистр BDTR, что исключает сквозной ток при коммутации.', addr: '0x40010000' },
  { id: 'motor',  label: 'BLDC Motor',    color: '#ffaa33', category: 'power',  desc: 'Бесщёточный мотор с постоянными магнитами. 24 магнитных полюса (12 пар), физически это 48 магнитов — по 2 на каждый полюс для усиления поля. Kv ≈ 14.5 RPM/V, Rs ≈ 45 мОм, Ld ≈ 0.18 мГн, Lq ≈ 0.22 мГн.', addr: '—' },
  { id: 'mcu',    label: 'STM32F405',     color: '#00ccff', category: 'system', desc: 'ARM Cortex-M4F, 168 МГц, FPU. 1 МБ flash, 192 КБ SRAM. Расширенные таймеры TIM1+TIM8 с dead-time. ADC с инжект. каналами. Весь FOC + баланс + телеметрия на одном чипе.', addr: '0x08000000' },
  { id: 'imu',    label: 'MPU6500 IMU',   color: '#33ff99', category: 'sense',  desc: 'SPI1 @ 1 МГц. 6DOF MEMS: акселерометр ±2g (16384 LSB/g), гироскоп ±250°/с (131 LSB/°/с). Читается каждые 50 мкс (20 кГц). 14 байт за транзакцию.', addr: '0x40013000' },
  { id: 'halls',  label: 'Hall Sensors',  color: '#cc88ff', category: 'sense',  desc: 'EXTI на внешних прерываниях. 3 датчика Холла → 6 дискретных позиций за оборот. Используются при старте и низкой скорости, пока Flux Observer не имеет достаточного back-EMF.', addr: '0x40010400' },
  { id: 'cur',    label: 'Current Shunts',color: '#ffcc00', category: 'sense',  desc: 'ADC1 с инжект. каналами, синхронизированными с TIM1 TRGO. Фазы A и B измеряются в середине PWM-периода. Фаза C = -(A+B). Разрешение: достаточно для PI-контура тока.', addr: '0x40012000' },
  { id: 'ble',    label: 'BLE Module',    color: '#00ccff', category: 'comms',  desc: 'USART1 PA9/PA10 @ 115200 бод. Пакет 0x55AA 20 байт каждые ~200 мс. Двойная роль: телеметрия (EUC World/WheelLog) + YMODEM bootloader для OTA-прошивки.', addr: '0x40011000' },
]

const CATS = { power: '#ff663322', sense: '#33ff9922', comms: '#00ccff22', system: '#88888822' }
const CAT_LABELS = { power: 'Силовая', sense: 'Сенсоры', comms: 'Связь', system: 'Система' }

const BlockDiagram = ({ selected, onSelect }) => {
  const blocks = [
    // Power stage
    { id: 'batt',  x: 10,  y: 40,  w: 90, h: 50, label: 'Батарея\n168V 50Ah', color: '#ff6633', cat: 'power' },
    { id: 'gate',  x: 10,  y: 120, w: 90, h: 50, label: 'Gate\nDriver', color: '#ff6633', cat: 'power' },
    { id: 'mosfet',x: 10, y: 200, w: 90, h: 50, label: 'MOSFET\n3-Phase', color: '#ff6633', cat: 'power' },
    { id: 'motor', x: 10,  y: 280, w: 90, h: 50, label: 'BLDC\nMotor', color: '#ff9933', cat: 'power' },
    // MCU
    { id: 'mcu',   x: 160, y: 100, w: 130, h: 200, label: 'STM32F405\nARM Cortex-M4F\n168 MHz', color: '#00ccff', cat: 'system' },
    // Sensors
    { id: 'imu',   x: 360, y: 40,  w: 90, h: 50, label: 'MPU6500\nIMU', color: '#33ff99', cat: 'sense' },
    { id: 'halls', x: 360, y: 120, w: 90, h: 50, label: 'Hall\nSensors ×3', color: '#33ff99', cat: 'sense' },
    { id: 'cur',   x: 360, y: 200, w: 90, h: 50, label: 'Current\nShunts', color: '#ffcc00', cat: 'sense' },
    // Comms
    { id: 'ble',   x: 360, y: 290, w: 90, h: 50, label: 'BLE\nModule', color: '#00ccff', cat: 'comms' },
  ]

  const lines = [
    ['batt', 'gate'], ['gate', 'mosfet'], ['mosfet', 'motor'],
    ['mcu', 'gate'], ['mcu', 'mosfet'],
    ['imu', 'mcu'], ['halls', 'mcu'], ['cur', 'mcu'], ['ble', 'mcu'],
  ]

  const getCenter = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

  return (
    <svg viewBox="0 0 480 360" style={{ width: '100%', maxHeight: '360px', display: 'block' }}>
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {lines.map(([a, b]) => {
        const ba = blocks.find(x => x.id === a), bb = blocks.find(x => x.id === b)
        if (!ba || !bb) return null
        const ca = getCenter(ba), cb = getCenter(bb)
        const isSel = selected === a || selected === b
        return <line key={`${a}-${b}`} x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}
          stroke={isSel ? '#00ccff' : '#2a2a2a'} strokeWidth={isSel ? 1.5 : 1}
          strokeDasharray={isSel ? '4 2' : '0'} />
      })}

      {blocks.map(b => {
        const isSel = selected === b.id
        return (
          <g key={b.id} onClick={() => onSelect(b.id === selected ? null : b.id)} style={{ cursor: 'pointer' }}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h}
              fill={isSel ? `${b.color}22` : '#111'} stroke={isSel ? b.color : '#282828'}
              strokeWidth={isSel ? 1.5 : 1} rx="6"
              filter={isSel ? 'url(#glow)' : ''} />
            {b.label.split('\n').map((line, i, arr) => (
              <text key={i} x={b.x + b.w / 2} y={b.y + b.h / 2 + (i - (arr.length - 1) / 2) * 14}
                textAnchor="middle" fontSize={i === 0 ? '10' : '9'} fill={isSel ? b.color : '#555'}
                fontWeight={i === 0 ? '700' : '400'} fontFamily="Inter, sans-serif">{line}</text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

export default function HardwareChapter() {
  const [selected, setSelected] = useState(null)
  const selPeri = selected ? PERIPHERALS.find(p => p.id === selected) || PERIPHERALS.find(p => selected === p.id) : null
  const selBlock = selected

  const periInfo = PERIPHERALS.find(p => p.id === selected)

  return (
    <ChapterLayout eyebrow="Глава I" title="Железо" subtitle="Анатомия контроллера моноколеса">
      <Section>
        <Prose>
          Центральный процессор ET Max — STM32F405RGT6: Cortex-M4F с аппаратным FPU, тактовая частота 168 МГц, 1 МБ flash, 192 КБ SRAM. Выбор F4-серии обусловлен наличием advanced-таймеров TIM1 и TIM8 с аппаратной генерацией комплементарных PWM и настраиваемым dead-time в регистре BDTR. Без этого управление трёхфазным мостом на 168 В потребовало бы внешней логики.
        </Prose>
        <Prose>
          Младшая модель RS C30 использует STM32F103C8T6 (Cortex-M3, 64 КБ flash, 20 КБ SRAM). Архитектура прошивки в основном та же, отличия в наборе периферии и разрядности FPU (у F103 её нет вообще, все вычисления целочисленные).
        </Prose>
      </Section>

      <InteractivePanel title="Блок-схема · нажмите на компонент">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          <BlockDiagram selected={selected} onSelect={setSelected} />
          <div>
            {periInfo ? (
              <div style={{ background: `${periInfo.color}11`, border: `1px solid ${periInfo.color}33`, borderRadius: '10px', padding: '20px' }}>
                <div style={{ fontSize: '9px', color: periInfo.color, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {CAT_LABELS[periInfo.category]}
                </div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>{periInfo.label}</div>
                <div style={{ fontSize: '11px', color: '#444', fontFamily: 'monospace', marginBottom: '14px' }}>{periInfo.addr}</div>
                <div style={{ fontSize: '14px', color: '#aaa', lineHeight: 1.7 }}>{periInfo.desc}</div>
              </div>
            ) : (
              <div style={{ color: '#333', fontSize: '13px', paddingTop: '40px', textAlign: 'center' }}>
                Выберите компонент на схеме
              </div>
            )}
          </div>
        </div>
      </InteractivePanel>

      <Section title="Dead-time: почему именно 571 нс">
        <Prose>
          В трёхфазном мосту верхний и нижний MOSFET одной фазы никогда не должны быть открыты одновременно. Если коммутация происходит без задержки, возникает сквозной ток: верхний ключ ещё не успел закрыться, а нижний уже проводит. На шине 168 В и при типичном Rds(on) ~4 мОм это даёт импульс порядка 20 кА, который разрушает транзисторы за десятки наносекунд.
        </Prose>
        <CodeBlock
          label="hal.c · TIM1 init (реверс-инжиниринг)"
          address="0x08000648"
          code={`// Dead-time = 571 нс @ 168 MHz = 96 тактов
// Значение записывается в TIMx_BDTR.DTG[7:0]
// При DTG[7:5]=0b100: DT = (32 + DTG[4:0]) × Tdtg
// Tdtg = 4/Fck = 23.8 нс → 96 × 5.95 нс ≈ 571 нс

TIM1->BDTR |= TIM_BDTR_DTG_4 | TIM_BDTR_DTG_2;  // 0b00100100
TIM1->BDTR |= TIM_BDTR_MOE;   // Main Output Enable`}
        />
        <Callout color="#ff6633" label="Компромисс">
          Значение 571 нс выбрано как компромисс между временем коммутации конкретных MOSFET (по даташиту ~150 нс с запасом) и искажениями формы тока. Чем больше dead-time, тем сильнее нелинейность вблизи нуля фазного тока — регулятор видит это как возмущение. В самодельных прошивках на том же железе иногда выставляют 400–450 нс ради КПД, но это уже балансирование на границе паспортных характеристик транзисторов и драйверов.
        </Callout>
      </Section>

      <Section title="Синхронизация ADC с PWM">
        <Prose>
          Ток в фазах нужно мерить строго в середине PWM-периода — когда все верхние ключи открыты одновременно. STM32 позволяет запускать инжектированное преобразование ADC по событию таймера (TRGO), без участия CPU.
        </Prose>
        <CodeBlock
          label="hal.c · ADC trigger setup"
          address="0x08012460"
          code={`// TIM1 генерирует TRGO в момент Update Event (начало периода PWM)
// ADC1 JEXTEN = 0b01 (Rising edge) + JEXTSEL = TIM1_TRGO
// Результат доступен в ADC1->JDR1 (Phase A) и JDR2 (Phase B)

ADC1->JSQR = ADC_JSQR_JL_0 | (PA0 << 9) | (PA1 << 15); // 2 conversion sequence
ADC1->CR2  |= ADC_CR2_JEXTEN_0 | ADC_CR2_JEXTSEL_0;     // TIM1 TRGO trigger
// Phase C = -(A + B) — нет нужды мерить третью фазу`}
        />
      </Section>

      <Section title="Карта памяти прошивки">
        {[
          ['0x08000000', 'Bootloader (YMODEM)', '#888'],
          ['0x08004000', 'Application start', '#00ccff'],
          ['0x08013974', 'Control_Motor_FOC_Update (ISR, 20 kHz)', '#ff3366'],
          ['0x08013D20', 'Control_Flux_Observer_Update', '#ff9933'],
          ['0x08013EF8', 'Sensors_IMU_Process_Raw', '#33ff99'],
          ['0x08018C2C', 'Control_Telemetry_Task', '#00ccff'],
          ['0x200000A0', 'motor_state (RAM struct)', '#cc88ff'],
        ].map(([addr, label, color]) => (
          <div key={addr} style={{ display: 'flex', gap: '16px', padding: '10px 0', borderBottom: '1px solid #141414', alignItems: 'center' }}>
            <code style={{ fontSize: '11px', color: '#2a4a6a', fontFamily: 'monospace', minWidth: '130px' }}>{addr}</code>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }}></div>
            <div style={{ fontSize: '13px', color: '#777' }}>{label}</div>
          </div>
        ))}
      </Section>
    </ChapterLayout>
  )
}
