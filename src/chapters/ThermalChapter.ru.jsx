import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

// Two-mass thermal model: winding and iron (stator core)
// dT_w/dt = (P - (T_w - T_iron)/R_wi) / C_w
// dT_i/dt = ((T_w - T_iron)/R_wi - (T_i - T_amb)/R_ia) / C_i
const ThermalSim = () => {
  const canvasRef = useRef(null)
  const [current, setCurrent] = useState(100)   // A
  const [ambient, setAmbient] = useState(25)
  const [Tw, setTw] = useState(25)
  const [Ti, setTi] = useState(25)
  const [running, setRunning] = useState(false)
  const [tiltback, setTiltback] = useState(false)
  const stateRef = useRef({ Tw: 25, Ti: 25, history: [], t: 0, running: false })
  const paramsRef = useRef({ current: 100, ambient: 25 })

  useEffect(() => { paramsRef.current = { current, ambient } }, [current, ambient])
  useEffect(() => { stateRef.current.running = running }, [running])

  useEffect(() => {
    stateRef.current.Tw = ambient
    stateRef.current.Ti = ambient
    setTw(ambient); setTi(ambient)
    stateRef.current.history = []
    stateRef.current.t = 0
  }, [ambient])

  useEffect(() => {
    let animId, last = performance.now()
    const Rs = 0.045                    // Ω (winding resistance per phase)
    const C_w = 800                     // J/K (winding thermal capacity)
    const C_i = 5000                    // J/K (iron/stator)
    const R_wi = 0.15                   // K/W (winding-to-iron)
    const R_ia = 1.2                    // K/W (iron-to-ambient, natural convection)

    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05) * 30  // 30x speedup
      last = now

      if (stateRef.current.running) {
        const s = stateRef.current
        const { current: I, ambient: amb } = paramsRef.current

        // Heat generation: I²R per phase × 3 phases (for balanced 3-phase system)
        // Actual: 1.5 × I_peak² × Rs for sinusoidal
        const P = 1.5 * I * I * Rs   // Watts

        // Thermal dynamics
        const q_wi = (s.Tw - s.Ti) / R_wi
        const q_ia = (s.Ti - amb) / R_ia
        s.Tw += (P - q_wi) / C_w * dt
        s.Ti += (q_wi - q_ia) / C_i * dt

        s.t += dt
        s.history.push({ t: s.t, Tw: s.Tw, Ti: s.Ti })
        if (s.history.length > 500) s.history.shift()

        setTw(s.Tw); setTi(s.Ti)

        if (s.Tw > 75) {
          setTiltback(true)
        } else if (s.Tw < 55) {
          setTiltback(false)
        }
      }

      // Draw
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        const W = canvas.width, H = canvas.height
        ctx.clearRect(0, 0, W, H)

        // Grid
        ctx.strokeStyle = '#141414'; ctx.lineWidth = 1
        for (const T of [25, 50, 75, 100]) {
          const y = H - (T / 110) * (H - 20) - 10
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
          ctx.fillStyle = '#333'; ctx.font = '9px monospace'
          ctx.fillText(`${T}°C`, 4, y - 2)
        }

        // Tiltback threshold
        const y60 = H - (60 / 110) * (H - 20) - 10
        const y75 = H - (75 / 110) * (H - 20) - 10
        ctx.strokeStyle = '#ff993344'; ctx.setLineDash([4, 3])
        ctx.beginPath(); ctx.moveTo(0, y60); ctx.lineTo(W, y60); ctx.stroke()
        ctx.strokeStyle = '#ff333644'
        ctx.beginPath(); ctx.moveTo(0, y75); ctx.lineTo(W, y75); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#ff993388'; ctx.font = '9px Inter'
        ctx.fillText('Tiltback start @ 60°C', W - 150, y60 - 4)
        ctx.fillStyle = '#ff333688'
        ctx.fillText('Critical @ 75°C', W - 110, y75 - 4)

        // Plot
        const h = stateRef.current.history
        if (h.length > 1) {
          const MAX_T = 120  // seconds shown
          const dtx = W / MAX_T

          // Winding
          ctx.strokeStyle = '#ff6633'; ctx.lineWidth = 2
          ctx.beginPath()
          h.forEach((p, i) => {
            const x = p.t * dtx
            const y = H - (p.Tw / 110) * (H - 20) - 10
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          })
          ctx.stroke()

          // Iron
          ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2
          ctx.beginPath()
          h.forEach((p, i) => {
            const x = p.t * dtx
            const y = H - (p.Ti / 110) * (H - 20) - 10
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          })
          ctx.stroke()

          // Current temp indicator
          const lastH = h[h.length - 1]
          const x = lastH.t * dtx
          ctx.fillStyle = '#ff6633'
          ctx.beginPath(); ctx.arc(x, H - (lastH.Tw / 110) * (H - 20) - 10, 4, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = '#ffcc00'
          ctx.beginPath(); ctx.arc(x, H - (lastH.Ti / 110) * (H - 20) - 10, 4, 0, Math.PI * 2); ctx.fill()
        }

        // Legend
        ctx.fillStyle = '#ff6633'; ctx.font = '10px Inter'
        ctx.fillText('Обмотка (winding)', 40, 18)
        ctx.fillStyle = '#ffcc00'
        ctx.fillText('Статор (iron)', 180, 18)
      }

      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  const reset = () => {
    const s = stateRef.current
    s.Tw = paramsRef.current.ambient
    s.Ti = paramsRef.current.ambient
    s.history = []; s.t = 0
    setTw(s.Tw); setTi(s.Ti)
    setTiltback(false)
    setRunning(false)
  }

  const power = 1.5 * current * current * 0.045

  return (
    <div>
      <canvas ref={canvasRef} width={780} height={220}
        style={{ width: '100%', height: '220px', background: '#080808', borderRadius: '8px', display: 'block' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginTop: '16px' }}>
        <div style={{ background: '#0d0d0d', border: '1px solid #ff663344', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px' }}>WINDING</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: Tw > 75 ? '#ff3366' : Tw > 60 ? '#ff9933' : '#ff6633' }}>{Tw.toFixed(1)}°</div>
        </div>
        <div style={{ background: '#0d0d0d', border: '1px solid #ffcc0044', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px' }}>IRON</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#ffcc00' }}>{Ti.toFixed(1)}°</div>
        </div>
        <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px' }}>POWER LOSS</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#888' }}>{power.toFixed(0)}<span style={{ fontSize: '11px', color: '#444' }}> W</span></div>
        </div>
        <div style={{ background: tiltback ? '#ff333622' : '#0d0d0d', border: `1px solid ${tiltback ? '#ff333666' : '#1a1a1a'}`, borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px' }}>TILTBACK</div>
          <div style={{ fontSize: '14px', fontWeight: '900', color: tiltback ? '#ff3366' : '#444', marginTop: '8px' }}>{tiltback ? 'АКТИВНО' : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '14px', marginTop: '16px', alignItems: 'end' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#555' }}>Фазный ток (RMS)</label>
            <span style={{ fontSize: '10px', color: '#ff6633', fontWeight: '700' }}>{current} A</span>
          </div>
          <input type="range" min="0" max="300" value={current} onChange={e => setCurrent(+e.target.value)} style={{ width: '100%', accentColor: '#ff6633' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#555' }}>Окружающая</label>
            <span style={{ fontSize: '10px', color: '#00ccff', fontWeight: '700' }}>{ambient}°C</span>
          </div>
          <input type="range" min="0" max="40" value={ambient} onChange={e => setAmbient(+e.target.value)} style={{ width: '100%', accentColor: '#00ccff' }} />
        </div>
        <button onClick={() => setRunning(r => !r)} style={{ padding: '10px 18px', background: running ? '#ff336622' : '#00ccff22', border: `1px solid ${running ? '#ff336644' : '#00ccff44'}`, borderRadius: '8px', color: running ? '#ff3366' : '#00ccff', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
          {running ? 'Стоп' : 'Запустить'}
        </button>
        <button onClick={reset} style={{ padding: '10px 14px', background: 'transparent', border: '1px solid #333', borderRadius: '8px', color: '#666', cursor: 'pointer', fontSize: '12px' }}>Сброс</button>
      </div>
    </div>
  )
}

export default function ThermalChapter() {
  return (
    <ChapterLayout eyebrow="Глава XII" title="Тепло" subtitle="Тепловая модель мотора и пороги температурного tiltback">
      <Section>
        <Prose>
          Потери в моторе состоят из двух больших групп: медные (I²R в обмотках статора) и железные (вихревые токи и гистерезис в магнитопроводе). Для моноколеса на типичных режимах езды медные доминируют: при 100 А фазного тока и Rs = 45 мОм мгновенная мощность потерь ~ 1350 Вт на три фазы. Эти 1350 Вт превращаются в тепло прямо внутри обмотки, которая не имеет активного охлаждения — только теплопроводность через лак к статору и дальше через корпус в воздух.
        </Prose>
        <Prose>
          У EUC-моторов есть одна важная особенность: компактный хаб с герметичным корпусом — тепловое сопротивление к среде высокое. 1 кВт в обмотке на долгой прямой дороге нагреет её до неприемлемых температур за несколько минут, даже если статор остаётся холодным.
        </Prose>
      </Section>

      <InteractivePanel title="Двухмассовая тепловая модель · включите ток и наблюдайте">
        <ThermalSim />
      </InteractivePanel>

      <Section title="Модель: две тепловые массы">
        <Prose>
          Упрощённая тепловая модель мотора имеет два узла: обмотка (малая теплоёмкость ~800 Дж/К, быстрый нагрев) и статор/железо (большая теплоёмкость ~5000 Дж/К, медленный нагрев). Между ними — тепловое сопротивление R_wi ≈ 0.15 К/Вт. От статора к среде — R_ia ≈ 1.2 К/Вт (естественная конвекция).
        </Prose>
        <CodeBlock
          label="thermal.c · двухмассовая модель"
          code={`// Параметры тепловой модели (определены эмпирически)
#define C_WINDING   800.0f    // J/K, теплоёмкость медной обмотки
#define C_IRON     5000.0f    // J/K, теплоёмкость магнитопровода
#define R_WI          0.15f   // K/W, winding-to-iron
#define R_IA          1.2f    // K/W, iron-to-ambient

static float T_winding = 25.0f;
static float T_iron    = 25.0f;

// Вызывается каждые 10 мс из главного цикла
void Thermal_Model_Update(float dt) {
    float I_rms = motor_state.I_Q_Measured / SQRT2;  // iq_peak → iq_rms
    float P_copper = 1.5f * I_rms * I_rms * R_S;     // трёхфазные потери

    float q_wi = (T_winding - T_iron) / R_WI;         // ток тепла в железо
    float q_ia = (T_iron - T_ambient) / R_IA;         // ток тепла в воздух

    T_winding += (P_copper - q_wi) / C_WINDING * dt;
    T_iron    += (q_wi - q_ia)     / C_IRON    * dt;

    motor_state.motor_temp = T_winding;  // для телеметрии и tiltback
}`}
        />
      </Section>

      <Section title="Почему tiltback с 60°C, а не с 90°C">
        <Prose>
          Эмаль обмоточного провода (класс H) выдерживает 180°C непрерывно. Почему же tiltback начинается с 60°C? Дело в запасе и инерции нагрева. Тепловая постоянная времени обмотки τ = C_w · R_wi ≈ 120 секунд. При потерях 2 кВт обмотка нагревается со скоростью около 2.5°C в секунду.
        </Prose>
        <Prose>
          Если tiltback включится при 90°C, у райдера остаётся ~36 секунд на замедление, прежде чем обмотка достигнет 180°C. Для большой высокоскоростной трассы этого мало. 60°C даёт запас более минуты — достаточно для безопасного замедления даже на полной скорости с последующим остыванием до 40°C.
        </Prose>
        <CodeBlock
          label="foc.c · thermal tiltback"
          code={`// В Control_Telemetry_Task
if (motor_state.motor_temp > 60.0f) {
    // Плавное снижение максимально допустимого тока
    float derate = 1.0f - (motor_state.motor_temp - 60.0f) / 15.0f;
    derate = fmaxf(0.3f, fminf(1.0f, derate));
    motor_state.max_phase_current = (int16_t)(SOFT_CURRENT_LIMIT * derate);

    // При 75°C — принудительный tiltback (наклон педалей назад)
    if (motor_state.motor_temp > 75.0f) {
        telemetry_state.alarm_active = 1;
    }
}`}
        />
      </Section>

      <Callout color="#ff9933" label="NTC на корпусе ≠ температура обмотки">
        Важный нюанс: датчик температуры (NTC-термистор) физически установлен на внешней поверхности статора или на плате, а не внутри обмотки. Обмотка за счёт малой теплоёмкости может быть на 20-40°C горячее, чем показывает датчик, особенно при пиковых нагрузках. Поэтому хорошая прошивка не доверяет только показаниям NTC, а также рассчитывает температуру обмотки из интеграла I²R (как в коде выше) и использует максимум двух значений для принятия решения о tiltback.
      </Callout>

      <Section title="Охлаждение — обратная сторона">
        <Prose>
          Постоянная времени остывания равна тепловой постоянной обмотки: ~2 минуты до возврата к близкой к статору температуре. После интенсивной нагрузки моторы остывают заметно дольше, чем греются, потому что при остановке нет потерь в меди, но и тепло продолжает перетекать из обмотки в статор и затем в воздух только через пассивную конвекцию.
        </Prose>
        <Prose>
          Практическое следствие: после длинного подъёма или скоростного участка лучше дать колесу постоять 2-3 минуты, чем сразу продолжать в том же режиме. Иначе температура обмотки накапливается от предыдущего эпизода и tiltback случится раньше, чем обычно.
        </Prose>
      </Section>
    </ChapterLayout>
  )
}
