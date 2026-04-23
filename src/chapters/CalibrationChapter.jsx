import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

const TOTAL = 2200
const SPEEDS = [
  { v: 0.1,  label: '0.1×' },
  { v: 0.25, label: '¼×' },
  { v: 0.5,  label: '½×' },
  { v: 1.0,  label: '1×'  },
  { v: 2.0,  label: '2×'  },
  { v: 4.0,  label: '4×'  },
]

const BootTimeline = () => {
  const [t, setT] = useState(0)           // ms since POR
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1.0)
  const [dragging, setDragging] = useState(false)
  const tRef = useRef(0)
  const rRef = useRef(false)
  const speedRef = useRef(1.0)
  const svgRef = useRef(null)

  useEffect(() => { rRef.current = running }, [running])
  useEffect(() => { speedRef.current = speed }, [speed])

  useEffect(() => {
    let animId, last = performance.now()
    const loop = (now) => {
      if (rRef.current) {
        tRef.current += (now - last) * speedRef.current
        if (tRef.current > TOTAL) { tRef.current = TOTAL; setRunning(false) }
        setT(tRef.current)
      }
      last = now
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  const phases = [
    { start: 0,    end: 20,   name: 'POR',           desc: 'Reset handler, SystemInit',         color: '#555' },
    { start: 20,   end: 50,   name: 'CLOCK',         desc: 'HSE → PLL 168 MHz',                 color: '#555' },
    { start: 50,   end: 150,  name: 'PERIPH',        desc: 'TIM, ADC, SPI, USART, GPIO',        color: '#888' },
    { start: 150,  end: 1150, name: 'IMU_WARM',      desc: 'Ожидание стабилизации MPU6500',     color: '#33ff99' },
    { start: 1150, end: 1550, name: 'GYRO_BIAS',     desc: 'Усреднение 200 выборок гироскопа',  color: '#33ff99' },
    { start: 1550, end: 1750, name: 'ADC_OFFSET',    desc: 'Замер нулевого уровня токовых шунтов', color: '#ffcc00' },
    { start: 1750, end: 2050, name: 'BMS_HANDSHAKE', desc: 'Первый валидный пакет от BMS',      color: '#ffcc00' },
    { start: 2050, end: 2200, name: 'IDLE',          desc: 'Готов к посадке райдера',           color: '#00ccff' },
  ]

  const current = phases.find(p => t >= p.start && t < p.end) || phases[phases.length - 1]
  const W = 760
  const scale = (W - 20) / TOTAL

  const start = () => {
    if (tRef.current >= TOTAL - 1) { tRef.current = 0; setT(0) }
    setRunning(true)
  }
  const pause = () => setRunning(false)
  const reset = () => { tRef.current = 0; setT(0); setRunning(false) }

  // Convert pointer X (in pixels) to simulation time (ms)
  const pointerToTime = (clientX) => {
    if (!svgRef.current) return 0
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = ((clientX - rect.left) / rect.width) * W
    const ms = ((svgX - 10) / scale)
    return Math.max(0, Math.min(TOTAL, ms))
  }

  const onPointerDown = (e) => {
    e.preventDefault()
    setRunning(false)
    setDragging(true)
    const ms = pointerToTime(e.clientX)
    tRef.current = ms; setT(ms)
    svgRef.current.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!dragging) return
    const ms = pointerToTime(e.clientX)
    tRef.current = ms; setT(ms)
  }
  const onPointerUp = (e) => {
    setDragging(false)
    if (svgRef.current?.hasPointerCapture?.(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId)
    }
  }
  const jumpToPhase = (p) => { tRef.current = p.start; setT(p.start); setRunning(false) }

  const finished = t >= TOTAL - 1

  return (
    <div>
      {/* Header with current stage + controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '16px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '10px', color: '#333', letterSpacing: '2px', marginBottom: '4px' }}>ТЕКУЩАЯ СТАДИЯ</div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: current.color }}>{current.name}</div>
          <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>{current.desc}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {running ? (
            <button onClick={pause}
              style={{ padding: '10px 18px', background: '#ff993322', border: '1px solid #ff993344', borderRadius: '8px', color: '#ff9933', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
              ⏸ Пауза
            </button>
          ) : (
            <button onClick={start}
              style={{ padding: '10px 18px', background: '#00ccff22', border: '1px solid #00ccff44', borderRadius: '8px', color: '#00ccff', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
              {finished ? '⟳ Заново' : t > 0 ? '▶ Продолжить' : '▶ Включить питание'}
            </button>
          )}
          <button onClick={reset}
            style={{ padding: '10px 14px', background: 'transparent', border: '1px solid #333', borderRadius: '8px', color: '#666', cursor: 'pointer', fontSize: '12px' }}>
            Сброс
          </button>
        </div>
      </div>

      {/* Speed control row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '14px' }}>
        <div style={{ fontSize: '9px', color: '#444', letterSpacing: '2px' }}>СКОРОСТЬ ВОСПРОИЗВЕДЕНИЯ</div>
        <div style={{ display: 'flex', gap: '4px', background: '#0a0a0a', padding: '3px', borderRadius: '6px', border: '1px solid #1e1e1e' }}>
          {SPEEDS.map(sp => (
            <button key={sp.v} onClick={() => setSpeed(sp.v)}
              style={{
                padding: '5px 10px',
                background: speed === sp.v ? '#00ccff22' : 'transparent',
                border: `1px solid ${speed === sp.v ? '#00ccff44' : 'transparent'}`,
                borderRadius: '4px',
                color: speed === sp.v ? '#00ccff' : '#555',
                cursor: 'pointer', fontSize: '10px', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace',
              }}>
              {sp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time readout */}
      <div style={{ fontSize: '10px', color: '#444', fontFamily: 'monospace', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
        <span>t = 0 мс (POR)</span>
        <span style={{ color: '#00ccff', fontWeight: '700', fontSize: '13px' }}>
          t = {t.toFixed(0)} мс {dragging && <span style={{ color: '#ff9933', marginLeft: '8px' }}>⇔ перетаскивание</span>}
        </span>
        <span>t = 2200 мс (READY)</span>
      </div>

      {/* Interactive SVG timeline */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} 80`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ width: '100%', display: 'block', cursor: dragging ? 'grabbing' : 'pointer', userSelect: 'none', touchAction: 'none' }}>
        {/* Tick marks */}
        {[0, 500, 1000, 1500, 2000].map(ms => {
          const x = 10 + ms * scale
          return (
            <g key={ms} style={{ pointerEvents: 'none' }}>
              <line x1={x} y1={48} x2={x} y2={54} stroke="#333" strokeWidth="1" />
              <text x={x} y={67} textAnchor="middle" fontSize="8" fill="#444" fontFamily="monospace">{ms} мс</text>
            </g>
          )
        })}

        {/* Phases — clickable to jump */}
        {phases.map(p => {
          const x = 10 + p.start * scale
          const w = (p.end - p.start) * scale
          const active = t >= p.start && t < p.end
          const done = t >= p.end
          return (
            <g key={p.name} onClick={(e) => { e.stopPropagation(); jumpToPhase(p) }} style={{ cursor: 'pointer' }}>
              <rect x={x} y={12} width={w - 1} height={32} rx="3"
                fill={active ? p.color + '44' : done ? p.color + '22' : '#0a0a0a'}
                stroke={active ? p.color : done ? p.color + '66' : '#1e1e1e'}
                strokeWidth={active ? 1.5 : 1} />
              {w > 40 && (
                <text x={x + w / 2} y={31} textAnchor="middle" fontSize="9"
                  fill={active ? p.color : (done ? '#888' : '#444')}
                  fontFamily="JetBrains Mono, monospace" fontWeight={active ? '700' : '400'}
                  style={{ pointerEvents: 'none' }}>
                  {p.name}
                </text>
              )}
            </g>
          )
        })}

        {/* Playhead (also as a draggable handle visually) */}
        <g style={{ pointerEvents: 'none' }}>
          <line x1={10 + t * scale} y1={6} x2={10 + t * scale} y2={50}
            stroke="#00ccff" strokeWidth={dragging ? 2 : 1.5} />
          <circle cx={10 + t * scale} cy={6} r={dragging ? 5 : 4}
            fill="#00ccff" stroke="#0a0a0a" strokeWidth="1" />
          {dragging && (
            <circle cx={10 + t * scale} cy={6} r="10" fill="none" stroke="#00ccff" strokeWidth="1" opacity="0.4">
              <animate attributeName="r" values="8;14;8" dur="0.8s" repeatCount="indefinite" />
            </circle>
          )}
        </g>
      </svg>

      {/* Hint row */}
      <div style={{ fontSize: '10px', color: '#333', marginTop: '10px', textAlign: 'center', lineHeight: 1.5 }}>
        Нажмите на стадию, чтобы перейти к её началу. Перетащите по шкале — для ручного скраббинга.
      </div>
    </div>
  )
}

const GyroBiasSim = () => {
  const canvasRef = useRef(null)
  const [samples, setSamples] = useState(0)
  const [bias, setBias] = useState({ x: 0, y: 0, z: 0 })
  const [running, setRunning] = useState(false)
  const dataRef = useRef({ x: [], y: [], z: [] })

  const start = () => {
    setSamples(0)
    setBias({ x: 0, y: 0, z: 0 })
    dataRef.current = { x: [], y: [], z: [] }
    setRunning(true)
  }

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      // Real gyro bias is typically ±5 to ±20 LSB (out of ±32768)
      // Plus noise of ±2 LSB
      const trueBiasX = 12, trueBiasY = -7, trueBiasZ = 3
      const sx = trueBiasX + (Math.random() - 0.5) * 4
      const sy = trueBiasY + (Math.random() - 0.5) * 4
      const sz = trueBiasZ + (Math.random() - 0.5) * 4
      dataRef.current.x.push(sx)
      dataRef.current.y.push(sy)
      dataRef.current.z.push(sz)
      const n = dataRef.current.x.length
      setSamples(n)
      setBias({
        x: dataRef.current.x.reduce((s, v) => s + v, 0) / n,
        y: dataRef.current.y.reduce((s, v) => s + v, 0) / n,
        z: dataRef.current.z.reduce((s, v) => s + v, 0) / n,
      })
      if (n >= 200) setRunning(false)
    }, 10)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const data = dataRef.current
    if (data.x.length === 0) {
      ctx.fillStyle = '#333'
      ctx.font = '11px Inter'; ctx.textAlign = 'center'
      ctx.fillText('Нажмите «Запустить калибровку»', W / 2, H / 2)
      return
    }

    // Grid
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1
    for (const v of [-20, -10, 0, 10, 20]) {
      const y = H / 2 - v * (H / 2 - 10) / 25
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      ctx.fillStyle = '#333'; ctx.font = '8px monospace'
      ctx.fillText(`${v}`, 4, y - 2)
    }

    const plot = (arr, color, avg) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      arr.forEach((v, i) => {
        const x = (i / 200) * W
        const y = H / 2 - v * (H / 2 - 10) / 25
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.globalAlpha = 1

      // Running average
      ctx.strokeStyle = color; ctx.lineWidth = 2
      ctx.beginPath()
      let sum = 0
      arr.forEach((v, i) => {
        sum += v
        const runAvg = sum / (i + 1)
        const x = (i / 200) * W
        const y = H / 2 - runAvg * (H / 2 - 10) / 25
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    plot(data.x, '#00ccff', bias.x)
    plot(data.y, '#33ff99', bias.y)
    plot(data.z, '#ffcc00', bias.z)
  }, [samples, bias])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', color: '#333', letterSpacing: '2px' }}>
          {samples === 0 ? 'ОЖИДАЕТ СТАРТА' : samples >= 200 ? 'ЗАВЕРШЕНО' : `ВЫБОРКА ${samples} / 200`}
        </div>
        <button onClick={start} disabled={running}
          style={{ padding: '8px 16px', background: running ? '#1a1a1a' : '#33ff9922', border: `1px solid ${running ? '#2a2a2a' : '#33ff9944'}`, borderRadius: '6px', color: running ? '#444' : '#33ff99', cursor: running ? 'default' : 'pointer', fontSize: '11px', fontWeight: '700' }}>
          {running ? 'Калибровка...' : 'Запустить калибровку'}
        </button>
      </div>
      <canvas ref={canvasRef} width={780} height={180}
        style={{ width: '100%', height: '180px', background: '#080808', borderRadius: '8px', display: 'block' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '14px' }}>
        {[
          { axis: 'X', val: bias.x, color: '#00ccff' },
          { axis: 'Y', val: bias.y, color: '#33ff99' },
          { axis: 'Z', val: bias.z, color: '#ffcc00' },
        ].map(({ axis, val, color }) => (
          <div key={axis} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px' }}>GYRO {axis} BIAS</div>
            <div style={{ fontSize: '20px', fontWeight: '900', color, marginTop: '4px', fontFamily: 'monospace' }}>
              {val > 0 ? '+' : ''}{val.toFixed(2)}
            </div>
            <div style={{ fontSize: '9px', color: '#444' }}>LSB @ ±250°/с</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CalibrationChapter() {
  return (
    <ChapterLayout eyebrow="Глава III" title="Пробуждение" subtitle="Что происходит в первые две секунды после подачи питания">
      <Section>
        <Prose>
          Между моментом, когда вы нажимаете кнопку включения, и моментом, когда колесо готово принять вес райдера, проходит примерно 2 секунды. За это время выполняется строгая последовательность действий, каждое из которых критично для корректной работы. Пропуск любой стадии приводит к неверному поведению — чаще всего к cutout на первой же нагрузке.
        </Prose>
      </Section>

      <InteractivePanel title="Хронология загрузки · от POR до READY">
        <BootTimeline />
      </InteractivePanel>

      <Section title="Самая важная стадия — GYRO_BIAS">
        <Prose>
          MEMS-гироскоп MPU6500 имеет ненулевое показание в состоянии покоя. Это называется <strong>нулевым смещением</strong> или bias. Причина — особенности технологии MEMS: крохотная масса, подвешенная на пружинах, не сидит идеально в центре. Величина bias обычно ±20 LSB (из ±32768), но меняется от экземпляра к экземпляру и плавает с температурой.
        </Prose>
        <Prose>
          Если подать на балансовый регулятор сырые показания гироскопа, он будет реагировать на несуществующее вращение — колесо начнёт ехать само по себе. Поэтому при каждом включении прошивка берёт 200 выборок за ~400 мс и вычисляет среднее — это и есть новый «ноль» для гироскопа.
        </Prose>
      </Section>

      <InteractivePanel title="Симулятор калибровки нулевого смещения гироскопа">
        <GyroBiasSim />
      </InteractivePanel>

      <Section title="Код калибровки">
        <CodeBlock
          label="sensors.c · gyro bias calibration"
          address="0x08013354"
          code={`// Константы
#define CALIB_SAMPLES  200
#define CALIB_DELAY_MS 2     // 2 мс между выборками = 500 Гц сэмплинг
#define MAX_CALIB_STDDEV 50  // если колесо шевелили — отбраковать

int32_t gyro_bias_x = 0, gyro_bias_y = 0, gyro_bias_z = 0;

int Calibrate_Gyro_Bias(void) {
    int32_t sum_x = 0, sum_y = 0, sum_z = 0;
    int32_t samples_x[CALIB_SAMPLES], samples_y[CALIB_SAMPLES], samples_z[CALIB_SAMPLES];

    for (int i = 0; i < CALIB_SAMPLES; i++) {
        int16_t gx, gy, gz;
        mpu_read_gyro(&gx, &gy, &gz);
        samples_x[i] = gx; samples_y[i] = gy; samples_z[i] = gz;
        sum_x += gx; sum_y += gy; sum_z += gz;
        HAL_Delay(CALIB_DELAY_MS);
    }

    int32_t avg_x = sum_x / CALIB_SAMPLES;
    int32_t avg_y = sum_y / CALIB_SAMPLES;
    int32_t avg_z = sum_z / CALIB_SAMPLES;

    // Проверка: если колесо двигалось во время калибровки,
    // разброс будет большой — лучше повторить
    int32_t stddev_sq = 0;
    for (int i = 0; i < CALIB_SAMPLES; i++) {
        int32_t d = samples_x[i] - avg_x;
        stddev_sq += d * d;
    }
    stddev_sq /= CALIB_SAMPLES;
    if (stddev_sq > MAX_CALIB_STDDEV * MAX_CALIB_STDDEV) {
        return -1;  // retry
    }

    gyro_bias_x = avg_x;
    gyro_bias_y = avg_y;
    gyro_bias_z = avg_z;
    return 0;
}

// В рабочем цикле:
int16_t gyro_rate_x = raw_gx - gyro_bias_x;
int16_t gyro_rate_y = raw_gy - gyro_bias_y;`}
        />
      </Section>

      <Section title="ADC offset — не менее критично">
        <Prose>
          Токовые шунты с операционником выдают при нулевом токе не 0 В, а половину опорного напряжения (обычно ~1.65 В при V_ref 3.3 В). В АЦП это соответствует коду ~2048 из 4096. Реальное значение может плавать ±30 единиц из-за offset операционника, смещения нуля АЦП и термодрейфа. Эти ~30 единиц соответствуют примерно 5-10 А ложного тока.
        </Prose>
        <Prose>
          Без корректной калибровки offset FOC будет считать, что через обмотки постоянно течёт несуществующий ток, и будет пытаться его «скомпенсировать» выдачей противоположного — в итоге реальный ток возникнет там, где его не должно быть. На старте калибровка проводится при принудительно выключенном мосте MOSFET, когда физически ток через шунты невозможен.
        </Prose>
        <CodeBlock
          label="hal.c · ADC offset calibration"
          code={`void Calibrate_ADC_Offset(void) {
    // Убедиться что все ключи закрыты
    HAL_PWM_Set_Duty_Cycle(0, 0, 0);
    HAL_Delay(10);  // дать ёмкостям разрядиться

    int32_t sum_a = 0, sum_b = 0;
    const int N = 100;
    for (int i = 0; i < N; i++) {
        // Принудительно запустить injected conversion
        ADC1->CR2 |= ADC_CR2_JSWSTART;
        while (!(ADC1->SR & ADC_SR_JEOC));
        sum_a += ADC1->JDR1;
        sum_b += ADC1->JDR2;
        ADC1->SR &= ~ADC_SR_JEOC;
    }
    current_offset_a = sum_a / N;
    current_offset_b = sum_b / N;
    // Теперь в каждом ISR: i_phase = (ADC_raw - offset) * GAIN
}`}
        />
      </Section>

      <Callout color="#ff9933" label="Почему именно 200 выборок">
        По закону больших чисел, стандартное отклонение среднего уменьшается как 1/√N. Для 200 выборок с шумом ±2 LSB итоговая точность нуля получается ±0.14 LSB. При чувствительности гироскопа 131 LSB/°/с, это эквивалентно ~0.001 °/с — пренебрежимо мало. Большее количество выборок уже не даёт значимого выигрыша, зато заметно удлиняет загрузку.
      </Callout>
    </ChapterLayout>
  )
}
