import { h } from 'preact'
import { useState, useRef, useEffect } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

// ISR phases with cycle counts for F405 (with FPU, single-precision float hardware)
// and F103 (no FPU, soft-float everything takes ~10x longer for floats)
const PHASES = [
  { id: 'entry',    label: 'ISR entry',          desc: 'Сохранение регистров r0-r3, lr, xPSR в stack. Tail-chaining NVIC.',             f405: 12,  f103: 12,  color: '#444' },
  { id: 'adc',      label: 'ADC JDR read',       desc: 'Два LDR из ADC1->JDR1/JDR2. Данные уже там (triggered TIM1 TRGO).',             f405: 8,   f103: 8,   color: '#ffcc00' },
  { id: 'angle',    label: 'Rotor angle',        desc: 'Чтение Flux Observer state или Hall декодер (ниже 5 км/ч).',                     f405: 20,  f103: 20,  color: '#cc88ff' },
  { id: 'clarke',   label: 'Clarke transform',   desc: 'α = ia, β = (ia + 2·ib)/√3. Две операции, константа из flash.',                   f405: 15,  f103: 90,  color: '#ff9933' },
  { id: 'park',     label: 'Park transform',     desc: 'sin/cos из LUT (256 точек), 4 mul + 2 add/sub. id, iq → постоянные при постоянной работе.', f405: 45, f103: 380, color: '#00ccff' },
  { id: 'pi_q',     label: 'PI Q-axis',          desc: 'err = target_iq − iq_measured, integral += err, vq = Kp·err + Ki·integral. Clamp.', f405: 40, f103: 250, color: '#33ff99' },
  { id: 'pi_d',     label: 'PI D-axis',          desc: 'То же для оси D. Target = 0 (или FW_target при ослаблении поля).',              f405: 40,  f103: 250, color: '#33ff99' },
  { id: 'vlimit',   label: 'V-limit (SVPWM)',    desc: 'Проверка |V|² < V_bus² и масштабирование через LUT обратных корней при необходимости.', f405: 35, f103: 180, color: '#ff6633' },
  { id: 'invpark',  label: 'Inv Park',           desc: 'α = Vd·cos − Vq·sin, β = Vd·sin + Vq·cos. Те же cos/sin что и в Park.',          f405: 30,  f103: 220, color: '#00ccff' },
  { id: 'svpwm',    label: 'SVPWM sector+duty',  desc: 'Определение сектора (1-6), расчёт T1, T2, T0 из α, β. Трёхфазные duty.',         f405: 80,  f103: 340, color: '#ff6633' },
  { id: 'write',    label: 'Write TIM CCR',      desc: 'Три STR в TIM1->CCR1/CCR2/CCR3. Новые duties применятся со следующим update-event.', f405: 10, f103: 10, color: '#888' },
  { id: 'balance',  label: 'Balance PD',         desc: 'iq_target = -(Kp·pitch + Kd·rate). Происходит здесь же в ISR, не в main.',       f405: 30,  f103: 180, color: '#cc88ff' },
  { id: 'exit',     label: 'ISR exit',           desc: 'Восстановление регистров, BX lr. ~12 тактов с учётом branch prediction.',         f405: 15,  f103: 15,  color: '#444' },
]

const TOTAL_F405 = PHASES.reduce((s, p) => s + p.f405, 0)
const TOTAL_F103 = PHASES.reduce((s, p) => s + p.f103, 0)

const Timeline = ({ mcu, freqKHz, hover, onHover }) => {
  const key = mcu === 'F405' ? 'f405' : 'f103'
  const mcuFreq = mcu === 'F405' ? 168 : 72  // MHz
  const period_us = 1000 / freqKHz           // 50 μs at 20 kHz
  const budget_cycles = period_us * mcuFreq  // 8400 at F405/20kHz
  const active_cycles = PHASES.reduce((s, p) => s + p[key], 0)
  const idle_cycles = budget_cycles - active_cycles
  const load_pct = (active_cycles / budget_cycles) * 100
  const overload = active_cycles > budget_cycles

  const w = 760, h = 90, marginL = 8
  const drawable_w = w - marginL - 8
  const scale = drawable_w / budget_cycles  // px per cycle

  let cursor = 0
  const segments = PHASES.map(p => {
    const seg = { id: p.id, label: p.label, cycles: p[key], start: cursor, color: p.color }
    cursor += p[key]
    return seg
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555', marginBottom: '8px', fontFamily: 'JetBrains Mono, monospace' }}>
        <span>0 мкс</span>
        <span style={{ color: overload ? '#ff3366' : (load_pct > 50 ? '#ff9933' : '#33ff99'), fontWeight: '700' }}>
          {active_cycles} тактов · {(active_cycles / mcuFreq).toFixed(2)} мкс · {load_pct.toFixed(1)}% загрузки
        </span>
        <span>{period_us.toFixed(1)} мкс (конец периода)</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', display: 'block' }}>
        {/* Budget frame */}
        <rect x={marginL} y={20} width={drawable_w} height={36} fill="#080808" stroke="#1a1a1a" strokeWidth="1" rx="4" />

        {/* Segments (active work) */}
        {segments.map(s => {
          const x = marginL + s.start * scale
          const segW = Math.max(0.5, s.cycles * scale)
          const isHover = hover === s.id
          return (
            <g key={s.id} onMouseEnter={() => onHover(s.id)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={20} width={segW} height={36}
                fill={isHover ? s.color : s.color + '88'}
                stroke={isHover ? '#fff' : 'none'} strokeWidth="1" />
              {segW > 30 && (
                <text x={x + segW / 2} y={43} textAnchor="middle" fontSize="8"
                  fill={isHover ? '#000' : '#000'} fontFamily="JetBrains Mono, monospace" fontWeight="700">
                  {s.label.split(' ')[0]}
                </text>
              )}
            </g>
          )
        })}

        {/* Idle region */}
        {!overload && (
          <rect x={marginL + active_cycles * scale} y={20} width={idle_cycles * scale} height={36}
            fill="url(#idle-stripes)" opacity="0.3" />
        )}
        <defs>
          <pattern id="idle-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#0a0a0a" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#1e1e1e" strokeWidth="2" />
          </pattern>
        </defs>

        {/* Overload marker */}
        {overload && (
          <g>
            <line x1={marginL + drawable_w} y1={15} x2={marginL + drawable_w} y2={62} stroke="#ff3366" strokeWidth="2" strokeDasharray="3 3" />
            <text x={marginL + drawable_w + 4} y={38} fontSize="10" fill="#ff3366" fontFamily="JetBrains Mono, monospace" fontWeight="700">OVERLOAD!</text>
          </g>
        )}

        {/* Tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const x = marginL + drawable_w * t
          const us = (period_us * t).toFixed(1)
          return (
            <g key={t}>
              <line x1={x} y1={56} x2={x} y2={62} stroke="#333" strokeWidth="1" />
              <text x={x} y={75} textAnchor="middle" fontSize="8" fill="#444" fontFamily="JetBrains Mono, monospace">{us}μs</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function ISRAnatomyChapter() {
  const [mcu, setMcu] = useState('F405')
  const [freqKHz, setFreqKHz] = useState(20)
  const [hover, setHover] = useState(null)

  const mcuFreq = mcu === 'F405' ? 168 : 72
  const period_us = 1000 / freqKHz
  const active_cycles = PHASES.reduce((s, p) => s + p[mcu === 'F405' ? 'f405' : 'f103'], 0)
  const active_us = active_cycles / mcuFreq
  const load = (active_us / period_us) * 100

  return (
    <ChapterLayout eyebrow="Глава V" title="Цикл" subtitle="Что происходит за одно срабатывание FOC-ISR на частоте 20 кГц">
      <Section>
        <Prose>
          При частоте ISR 20 кГц на всю работу отведено 50 микросекунд. Ровно 50 мкс между двумя срабатываниями — и ни одного такта больше. Если ISR не успел завершиться до следующего update-event TIM1, нарушится детерминированность управления: PWM будет обновляться с джиттером, PI-регулятор увидит нестационарную задержку, и колесо начнёт физически «нервничать» в виде зуда педалей.
        </Prose>
        <Prose>
          На STM32F405 @ 168 МГц в эти 50 мкс помещается 8400 тактов CPU. Их хватает на всё с огромным запасом: типичный цикл занимает ~2 мкс, то есть 4-5% бюджета. Остальные 95% ядро проводит в главном цикле, обрабатывая телеметрию, логику состояний и отрисовку LED.
        </Prose>
      </Section>

      <InteractivePanel title="Хронометраж одного ISR · наведите на сегмент">
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#0a0a0a', borderRadius: '8px', padding: '4px' }}>
            <button onClick={() => setMcu('F405')}
              style={{ padding: '8px 18px', background: mcu === 'F405' ? '#00ccff22' : 'transparent', border: 'none', color: mcu === 'F405' ? '#00ccff' : '#555', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
              F405 (168 MHz + FPU)
            </button>
            <button onClick={() => setMcu('F103')}
              style={{ padding: '8px 18px', background: mcu === 'F103' ? '#ff993322' : 'transparent', border: 'none', color: mcu === 'F103' ? '#ff9933' : '#555', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
              F103 (72 MHz soft-float)
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '10px', color: '#555' }}>Частота ISR: {freqKHz} кГц · период {period_us.toFixed(1)} мкс</label>
            </div>
            <input type="range" min="5" max="40" step="1" value={freqKHz}
              onChange={e => setFreqKHz(+e.target.value)}
              style={{ width: '100%', accentColor: load > 80 ? '#ff3366' : '#00ccff' }} />
          </div>
        </div>

        <Timeline mcu={mcu} freqKHz={freqKHz} hover={hover} onHover={setHover} />

        <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px', marginBottom: '6px' }}>АКТИВНО</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#ff9933' }}>{active_us.toFixed(2)} <span style={{ fontSize: '11px', color: '#555' }}>мкс</span></div>
          </div>
          <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px', marginBottom: '6px' }}>ЗАГРУЗКА CPU</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: load > 80 ? '#ff3366' : load > 40 ? '#ffcc00' : '#33ff99' }}>
              {load.toFixed(1)}<span style={{ fontSize: '11px', color: '#555' }}>%</span>
            </div>
          </div>
          <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px', marginBottom: '6px' }}>ЗАПАС</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#00ccff' }}>
              {Math.max(0, period_us - active_us).toFixed(1)} <span style={{ fontSize: '11px', color: '#555' }}>мкс</span>
            </div>
          </div>
        </div>

        {hover && (
          <div style={{ marginTop: '20px', background: '#0d0d0d', border: `1px solid ${PHASES.find(p => p.id === hover).color}44`, borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: PHASES.find(p => p.id === hover).color }}>
                {PHASES.find(p => p.id === hover).label}
              </span>
              <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>
                {PHASES.find(p => p.id === hover)[mcu === 'F405' ? 'f405' : 'f103']} тактов · {(PHASES.find(p => p.id === hover)[mcu === 'F405' ? 'f405' : 'f103'] / mcuFreq).toFixed(2)} мкс
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#aaa', lineHeight: 1.6 }}>
              {PHASES.find(p => p.id === hover).desc}
            </div>
          </div>
        )}
      </InteractivePanel>

      <Section title="F405 vs F103: цена FPU">
        <Prose>
          Разница между двумя чипами — это не только тактовая частота. F405 имеет аппаратный FPU (Floating Point Unit), который выполняет `VMUL.F32`, `VADD.F32` и другие операции за 1 такт. F103 не имеет FPU: любая операция с float разворачивается компилятором в вызов программной библиотеки (`__aeabi_fmul`, `__aeabi_fadd`), и каждая такая операция занимает 60-100+ тактов.
        </Prose>
        <Prose>
          Это объясняет, почему RS C30 (на F103) работает с ISR на частоте 16 кГц, а не 20 кГц: запас по тактам скромнее. Переключитесь на F103 в интерактиве выше — загрузка вырастет с ~4% до ~38%. Всё ещё приемлемо, но уже нет роскоши «почти весь CPU свободен».
        </Prose>
        <Callout color="#ff9933" label="Практическое следствие">
          Если вы пишете свою прошивку для STM32F103, выбор между float и fixed-point math — это решение на уровне архитектуры. Либо вся мат-часть в Q15 (16-битные дробные), либо ISR на 10 кГц вместо 20 кГц, либо критичные операции переписывать на ассемблере.
        </Callout>
      </Section>

      <Section title="Главный цикл vs ISR">
        <Prose>
          Не всё происходит в ISR. Балансовый контур и FOC — да, потому что они должны быть детерминированы с частотой 20 кГц. А вот телеметрия, логика переходов состояний, обработка BMS, LED-эффекты — это работа главного цикла, который выполняется между срабатываниями ISR. Главный цикл может иногда задерживаться, и ничего страшного не случится: колесо продолжит балансировать.
        </Prose>
        <CodeBlock
          label="main.c · разделение времени"
          code={`// FOC ISR: 20 kHz (TIM1 update-event → ADC JEOC → DMA → ISR)
// Приоритет: 0 (максимальный)
void TIM1_UP_IRQHandler(void) {
    Control_Motor_FOC_Update();  // всё, что в интерактиве выше
    TIM1->SR &= ~TIM_SR_UIF;
}

// Telemetry task: 5 Hz (SysTick-based)
// Приоритет: 8
// Отправка BLE пакета, чтение BMS, проверка порогов
void Control_Telemetry_Task(void) { ... }

// Main loop: низший приоритет
// Крутит state machine, обработку кнопок, LED
int main(void) {
    system_init();
    while (1) {
        Logic_Settings_And_Buttons();
        LED_Effects_Update();
        if (telemetry_due) { Control_Telemetry_Task(); telemetry_due = 0; }
        // __WFI();  // опционально: спать до следующего прерывания
    }
}`}
        />
      </Section>

      <Callout color="#00ccff" label="Почему 20 кГц, а не 40">
        Теоретически можно было бы поднять частоту ISR до 40 кГц — запас по CPU на F405 это позволяет. Но PWM-частота тоже 20 кГц, и она выбрана выше слышимого диапазона (чтобы колесо не свистело) и ниже точки, где потери переключения в MOSFET становятся критичными. Дальнейшее повышение частоты PWM привело бы к росту тепловыделения на ключах без выигрыша в качестве управления.
      </Callout>
    </ChapterLayout>
  )
}
