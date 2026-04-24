import { h } from 'preact'
import { useState, useRef, useEffect } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

// Simulate Hall-based and Observer-based angle estimation
const AngleSim = () => {
  const canvasRef = useRef(null)
  const [rpm, setRpm] = useState(200)
  const [noise, setNoise] = useState(0.3)
  const rpmRef = useRef(200)
  const noiseRef = useRef(0.3)

  useEffect(() => { rpmRef.current = rpm }, [rpm])
  useEffect(() => { noiseRef.current = noise }, [noise])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId, lastT = performance.now()
    let trueAngle = 0          // radians
    let observerFluxA = 0, observerFluxB = 0
    const hist = []  // {t, trueA, hallA, obsA}
    let t = 0

    const loop = (now) => {
      const dt = Math.min((now - lastT) / 1000, 0.02)
      lastT = now
      t += dt

      const omega_mech = (rpmRef.current / 60) * 2 * Math.PI   // rad/s mechanical
      const pole_pairs = 12
      const omega_elec = omega_mech * pole_pairs               // rad/s electrical
      trueAngle += omega_elec * dt
      trueAngle %= 2 * Math.PI
      if (trueAngle < 0) trueAngle += 2 * Math.PI

      // Hall: 6 sectors, each 60° = π/3
      const hallSector = Math.floor(trueAngle / (Math.PI / 3))
      const hallAngle = hallSector * (Math.PI / 3) + Math.PI / 6  // center of sector

      // Observer: integrate back-EMF (model: V_phase ∝ ω·cos(θ))
      // emf_α = -ω·Ψ·sin(θ_true), emf_β = ω·Ψ·cos(θ_true)
      // With current sensor noise, at low ω the integrated flux is noisy
      const Psi = 1  // normalized flux linkage
      const n = noiseRef.current
      const emf_a = -omega_elec * Psi * Math.sin(trueAngle) + (Math.random() - 0.5) * n * 20
      const emf_b =  omega_elec * Psi * Math.cos(trueAngle) + (Math.random() - 0.5) * n * 20

      // Flux via integration with decay (first-order high-pass to prevent drift)
      const tau = 0.05  // time constant for drift correction
      observerFluxA += (emf_a - observerFluxA / tau) * dt
      observerFluxB += (emf_b - observerFluxB / tau) * dt

      let obsAngle = Math.atan2(observerFluxA, -observerFluxB)  // derived from flux orientation
      if (obsAngle < 0) obsAngle += 2 * Math.PI

      hist.push({ t, trueA: trueAngle, hallA: hallAngle, obsA: obsAngle })
      if (hist.length > 300) hist.shift()

      // Draw
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Left: rotating disc view
      const cx = 120, cy = H / 2, r = 68
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()

      // Hall sector lines
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        ctx.stroke()
      }

      // True angle (white dashed)
      ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(trueAngle) * r, cy + Math.sin(trueAngle) * r)
      ctx.stroke(); ctx.setLineDash([])

      // Hall (stepped, yellow)
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(hallAngle) * (r - 10), cy + Math.sin(hallAngle) * (r - 10))
      ctx.stroke()

      // Observer (smooth, cyan)
      ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(obsAngle) * (r - 5), cy + Math.sin(obsAngle) * (r - 5))
      ctx.stroke()

      // Legend
      ctx.font = '9px Inter'; ctx.textAlign = 'left'
      ctx.fillStyle = '#888'; ctx.fillText('True', cx - r, cy + r + 16)
      ctx.fillStyle = '#ffcc00'; ctx.fillText('Hall', cx - r + 40, cy + r + 16)
      ctx.fillStyle = '#00ccff'; ctx.fillText('Observer', cx - r + 78, cy + r + 16)

      // Right: angle error over time
      const px = 260, pw = W - px - 10, py = 10, ph = H - 20
      ctx.strokeStyle = '#141414'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(px, py + ph / 2); ctx.lineTo(px + pw, py + ph / 2); ctx.stroke()

      const normErr = (a) => {
        let e = a
        while (e >  Math.PI) e -= 2 * Math.PI
        while (e < -Math.PI) e += 2 * Math.PI
        return e
      }

      const maxErr = Math.PI / 3  // display range
      // Hall error (stepped)
      ctx.strokeStyle = '#ffcc00aa'; ctx.lineWidth = 1.5
      ctx.beginPath()
      hist.forEach((h, i) => {
        const err = normErr(h.hallA - h.trueA)
        const x = px + (i / 300) * pw
        const y = py + ph / 2 - (err / maxErr) * (ph / 2 - 6)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()

      // Observer error (smooth)
      ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 1.5
      ctx.beginPath()
      hist.forEach((h, i) => {
        const err = normErr(h.obsA - h.trueA)
        const x = px + (i / 300) * pw
        const y = py + ph / 2 - (err / maxErr) * (ph / 2 - 6)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()

      ctx.fillStyle = '#333'; ctx.font = '9px Inter'
      ctx.fillText('Ошибка угла vs время', px + 6, py + 12)
      ctx.fillText('+60°', px + 6, py + 18)
      ctx.fillText('−60°', px + 6, py + ph - 4)
      ctx.fillText('0', px + 6, py + ph / 2 + 10)

      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div>
      <canvas ref={canvasRef} width={780} height={200}
        style={{ width: '100%', height: '200px', background: '#080808', borderRadius: '8px', display: 'block' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#555' }}>Скорость мотора</label>
            <span style={{ fontSize: '11px', color: '#00ccff', fontWeight: '700', fontFamily: 'monospace' }}>
              {rpm} RPM · {(rpm * 0.15 * Math.PI * 2 * 60 / 1000).toFixed(1)} км/ч
            </span>
          </div>
          <input type="range" min="10" max="1500" step="10" value={rpm} onChange={e => setRpm(+e.target.value)}
            style={{ width: '100%', accentColor: '#00ccff' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#555' }}>Шум ADC/BEMF</label>
            <span style={{ fontSize: '11px', color: '#ff9933', fontWeight: '700' }}>{noise.toFixed(2)}</span>
          </div>
          <input type="range" min="0" max="1" step="0.05" value={noise} onChange={e => setNoise(+e.target.value)}
            style={{ width: '100%', accentColor: '#ff9933' }} />
        </div>
      </div>
      <div style={{ marginTop: '16px', fontSize: '11px', color: '#444', lineHeight: 1.6 }}>
        При низкой скорости back-EMF мала, наблюдатель тонет в шуме — Hall выигрывает.
        При высокой скорости Hall даёт грубые ступени (±30° погрешности между переключениями) — наблюдатель выигрывает.
        Прошивка переключается между ними около 5 км/ч с гистерезисом.
      </div>
    </div>
  )
}

// Visualizes back-EMF generation: rotating rotor induces sinusoidal voltage
// in 3 stationary stator coils. Amplitude ∝ speed.
const BackEMFSim = () => {
  const canvasRef = useRef(null)
  const [rpm, setRpm] = useState(400)
  const [showNoise, setShowNoise] = useState(true)
  const rpmRef = useRef(400)
  const noiseRef = useRef(true)
  useEffect(() => { rpmRef.current = rpm }, [rpm])
  useEffect(() => { noiseRef.current = showNoise }, [showNoise])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId, lastT = performance.now()
    let rotorAngle = 0
    const hist = { t: 0, a: [], b: [], c: [] }

    const loop = (now) => {
      const dt = Math.min((now - lastT) / 1000, 0.04)
      lastT = now
      const pole_pairs = 12
      const omega_mech = (rpmRef.current / 60) * 2 * Math.PI
      const omega_elec = omega_mech * pole_pairs
      rotorAngle += omega_elec * dt
      rotorAngle %= 2 * Math.PI

      // Back-EMF magnitude ∝ speed. Peak at rpm=1500 ≈ 100V
      const Ke = 100 / 1500   // V per RPM (normalised visual)
      const peak = Ke * rpmRef.current

      const emf_a = peak * Math.cos(rotorAngle)
      const emf_b = peak * Math.cos(rotorAngle - 2 * Math.PI / 3)
      const emf_c = peak * Math.cos(rotorAngle - 4 * Math.PI / 3)

      const noiseLevel = noiseRef.current ? 1.5 : 0  // constant V of ADC/shunt noise
      const n = () => (Math.random() - 0.5) * 2 * noiseLevel
      hist.t += dt
      hist.a.push(emf_a + n())
      hist.b.push(emf_b + n())
      hist.c.push(emf_c + n())
      if (hist.a.length > 200) { hist.a.shift(); hist.b.shift(); hist.c.shift() }

      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // --- Left: rotor + stator coils ---
      const cx = 140, cy = H / 2, R = 70, rotorR = 40

      // Stator circle
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, R + 15, 0, Math.PI * 2); ctx.stroke()

      // Three coils at 0°, 120°, 240° (electrical 0 of phase A is at top)
      const coilColors = ['#ff3366', '#33ff99', '#00ccff']
      const coilLabels = ['A', 'B', 'C']
      const coilAngles = [-Math.PI / 2, -Math.PI / 2 + 2 * Math.PI / 3, -Math.PI / 2 + 4 * Math.PI / 3]
      const currentEmfs = [emf_a, emf_b, emf_c]
      coilAngles.forEach((a, i) => {
        const px = cx + Math.cos(a) * (R + 15)
        const py = cy + Math.sin(a) * (R + 15)
        // Highlight coil proportionally to abs(emf)
        const intensity = Math.min(1, Math.abs(currentEmfs[i]) / 80)
        ctx.fillStyle = coilColors[i] + Math.floor(intensity * 200).toString(16).padStart(2, '0')
        ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = coilColors[i]; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = '#000'
        ctx.font = 'bold 12px JetBrains Mono, monospace'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(coilLabels[i], px, py)
        // Instantaneous EMF label
        ctx.fillStyle = coilColors[i]
        ctx.font = '9px JetBrains Mono, monospace'
        const labelX = px + Math.cos(a) * 22
        const labelY = py + Math.sin(a) * 22
        ctx.fillText(`${currentEmfs[i].toFixed(0)}V`, labelX, labelY)
      })

      // Rotor with magnetic poles
      const rotorEnd = (dir) => ({
        x: cx + Math.cos(rotorAngle + dir) * rotorR,
        y: cy + Math.sin(rotorAngle + dir) * rotorR,
      })
      // N pole (red)
      const nEnd = rotorEnd(0)
      ctx.strokeStyle = '#ff3366'; ctx.lineWidth = 8; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nEnd.x, nEnd.y); ctx.stroke()
      ctx.fillStyle = '#ff3366'
      ctx.font = 'bold 10px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('N', nEnd.x, nEnd.y)
      // S pole (blue)
      const sEnd = rotorEnd(Math.PI)
      ctx.strokeStyle = '#3366ff'; ctx.lineWidth = 8
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sEnd.x, sEnd.y); ctx.stroke()
      ctx.fillStyle = '#3366ff'
      ctx.fillText('S', sEnd.x, sEnd.y)
      // Rotor hub
      ctx.fillStyle = '#1a1a1a'
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.stroke()

      // --- Right: time-domain plot of EMFs ---
      const px0 = 280, pw = W - px0 - 10, ph = H - 40, py0 = 20

      // Grid + zero line
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1
      for (const v of [-100, -50, 0, 50, 100]) {
        const y = py0 + ph / 2 - (v / 120) * (ph / 2 - 6)
        ctx.beginPath(); ctx.moveTo(px0, y); ctx.lineTo(px0 + pw, y); ctx.stroke()
        ctx.fillStyle = '#333'; ctx.font = '9px JetBrains Mono, monospace'
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
        ctx.fillText(`${v}V`, px0 - 4, y)
      }

      // Noise floor band (visual cue)
      if (noiseRef.current) {
        const nY1 = py0 + ph / 2 - (noiseLevel / 120) * (ph / 2 - 6)
        const nY2 = py0 + ph / 2 + (noiseLevel / 120) * (ph / 2 - 6)
        ctx.fillStyle = '#ff993318'
        ctx.fillRect(px0, nY1, pw, nY2 - nY1)
        ctx.fillStyle = '#ff9933'
        ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.fillText('шум АЦП / датчиков', px0 + 6, nY1 - 6)
      }

      // Draw 3 phase EMFs
      const drawPhase = (arr, color) => {
        ctx.strokeStyle = color; ctx.lineWidth = 1.8
        ctx.beginPath()
        arr.forEach((v, i) => {
          const x = px0 + (i / 200) * pw
          const y = py0 + ph / 2 - (v / 120) * (ph / 2 - 6)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()
      }
      drawPhase(hist.a, coilColors[0])
      drawPhase(hist.b, coilColors[1])
      drawPhase(hist.c, coilColors[2])

      // Title + legend
      ctx.fillStyle = '#888'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'left'
      ctx.fillText('Фазные напряжения back-EMF во времени', px0 + 6, py0 - 6)
      coilLabels.forEach((l, i) => {
        ctx.fillStyle = coilColors[i]
        ctx.fillText(l, px0 + pw - 40 + i * 16, py0 - 6)
      })

      // Amplitude readout
      ctx.fillStyle = '#555'
      ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'left'
      const snr = peak / Math.max(0.1, noiseLevel)
      ctx.fillText(`пик: ${peak.toFixed(1)} V  ·  SNR: ${snr.toFixed(1)}x`, px0 + 6, H - 6)

      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div>
      <canvas ref={canvasRef} width={780} height={220}
        style={{ width: '100%', height: '220px', background: '#080808', borderRadius: '8px', display: 'block' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', marginTop: '14px', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#555' }}>Скорость ротора</label>
            <span style={{ fontSize: '10px', color: '#00ccff', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>
              {rpm} RPM · ~{(rpm * 0.254 * 2 * Math.PI / 60 / 12 * 3.6).toFixed(1)} км/ч
            </span>
          </div>
          <input type="range" min="10" max="1500" step="10" value={rpm} onChange={e => setRpm(+e.target.value)}
            style={{ width: '100%', accentColor: '#00ccff' }} />
        </div>
        <button onClick={() => setShowNoise(!showNoise)}
          style={{ padding: '8px 14px', background: showNoise ? '#ff993322' : '#1a1a1a', border: `1px solid ${showNoise ? '#ff993344' : '#333'}`, borderRadius: '6px', color: showNoise ? '#ff9933' : '#666', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>
          {showNoise ? 'Шум включён' : 'Шум выключен'}
        </button>
      </div>
      <div style={{ marginTop: '14px', fontSize: '11px', color: '#444', lineHeight: 1.6 }}>
        Амплитуда back-EMF пропорциональна скорости ротора. На низких RPM сигнал тонет в полосе шума АЦП (оранжевая область) — наблюдатель не может вычислить угол. При ~200 RPM и выше SNR становится достаточным для устойчивой работы.
      </div>
    </div>
  )
}

export default function FluxObserverChapter() {
  return (
    <ChapterLayout eyebrow="Глава IX" title="Наблюдатель" subtitle="Flux Observer и почему Hall-датчики недостаточны">
      <Section>
        <Prose>
          Преобразование Парка в FOC требует точного электрического угла ротора в каждый момент времени. От точности этого угла напрямую зависит, какая доля тока пойдёт в момент (Iq) и какая уйдёт в пустое намагничивание (Id). Ошибка угла в 30° означает, что ~13% тока теряется на нагрев обмоток без полезной работы. 60° — уже половина.
        </Prose>
        <Prose>
          Три датчика Холла, расположенных на статоре через 120° электрических, дают 6 различимых комбинаций — 6 секторов по 60°. Этого достаточно для грубой коммутации BLDC моторов старого типа (trapezoidal), но для синусоидального FOC такая дискретность даёт пилообразную ошибку угла ±30°, что приводит к пульсациям момента и падению КПД.
        </Prose>
      </Section>

      <InteractivePanel title="Hall vs Observer · интерактив">
        <AngleSim />
      </InteractivePanel>

      <Section title="Как работает наблюдатель">
        <Prose>
          Идея: у вращающегося мотора в обмотках наводится back-EMF — напряжение, пропорциональное скорости и повёрнутое относительно магнитного потока ротора. Когда N-полюс ротора проходит мимо катушки фазы A, магнитный поток через неё меняется максимально быстро, и по закону Фарадея наводится максимальное напряжение. Три катушки разнесены на 120°, поэтому получаются три синусоиды со сдвигом фаз.
        </Prose>
      </Section>

      <InteractivePanel title="Генерация back-EMF · как вращение становится напряжением">
        <BackEMFSim />
      </InteractivePanel>

      <Section title="Интеграл потока">
        <Prose>
          Имея три фазных напряжения, можно восстановить угол ротора: поток — это интеграл back-EMF, а направление вектора потока в α/β-плоскости совпадает с ориентацией магнита ротора. Формально:
        </Prose>
        <CodeBlock
          label="Flux Observer · математика"
          code={`// Back-EMF в стационарной α/β системе
e_α = V_α - R_s · i_α - L_s · (di_α/dt)
e_β = V_β - R_s · i_β - L_s · (di_β/dt)

// Интеграл back-EMF даёт поток
Ψ_α = ∫ e_α dt
Ψ_β = ∫ e_β dt

// Угол потока = угол ротора (для PMSM со встроенными магнитами с оговорками)
θ = atan2(Ψ_β, Ψ_α) - π/2`}
        />
        <Prose>
          Проблема чистого интегратора: любое смещение нуля в датчике тока или АЦП накапливается, и угол «уплывает» за секунды. Поэтому в прошивке ET Max используется <strong>первопорядковый фильтр высоких частот</strong> вместо идеального интегратора:
        </Prose>
        <CodeBlock
          label="foc.c · Flux Observer с HPF (0x08013D20)"
          address="0x08013D20"
          code={`// Вместо идеального ∫, используем 1st-order HP:
// dΨ/dt = e - Ψ/τ, где τ ≈ 50 мс (cutoff ~3 Hz)
// Это фильтрует DC offset и не даёт полю уплыть

#define TAU_FLUX 0.05f
static float flux_alpha = 0, flux_beta = 0;

void Control_Flux_Observer_Update(void) {
    int emf_a = ADC1_JDR_PHASE_A * 2 - flux_obs->offset_a;
    int emf_b = ADC2_JDR_PHASE_B * 2 - flux_obs->offset_b;

    // Clarke для EMF
    float e_alpha = emf_a;
    float e_beta  = (emf_a + 2 * emf_b) / SQRT3;

    // HPF интегратор (с утечкой)
    flux_alpha += (e_alpha - flux_alpha / TAU_FLUX) * DT;
    flux_beta  += (e_beta  - flux_beta  / TAU_FLUX) * DT;

    // Угол из вектора потока (atan2 из LUT)
    int angle_q15 = Math_Atan2_LUT(flux_beta, flux_alpha);
    motor_state->Rotor_Angle_Raw = (uint16_t)angle_q15;
}`}
        />
      </Section>

      <Section title="Переход Hall ⇄ Observer">
        <Prose>
          Проблема наблюдателя: при ω → 0, back-EMF → 0, и сигнал тонет в шуме АЦП. Поэтому при старте с места и до ~5 км/ч работает коммутация по Hall-датчикам. При разгоне прошивка плавно передаёт управление наблюдателю.
        </Prose>
        <CodeBlock
          label="logic.c · логика переключения"
          code={`// Hysteresis чтобы не прыгать между режимами
// Below 5 km/h: Hall only
// 5-8 km/h: blend between hall and observer
// Above 8 km/h: observer only

float speed_kmh = motor_state->wheel_speed_kmh;
float blend;

if (speed_kmh < 5.0f) {
    blend = 0.0f;  // 100% Hall
} else if (speed_kmh > 8.0f) {
    blend = 1.0f;  // 100% Observer
} else {
    blend = (speed_kmh - 5.0f) / 3.0f;  // linear blend 0..1
}

int hall_angle = HALL_LUT[hall_state];       // 0..65535
int obs_angle  = motor_state->Rotor_Angle_Raw;

// Угол в формате Q16 с учётом wraparound
int diff = (obs_angle - hall_angle + 32768) & 0xFFFF - 32768;
int final_angle = hall_angle + (int)(diff * blend);
motor_state->Rotor_Angle_Final = final_angle & 0xFFFF;`}
        />
      </Section>

      <Callout color="#00ccff" label="Зачем вообще ставить Hall, если есть Observer">
        Наблюдатель не запускается «из нуля» — ему нужен ненулевой back-EMF, то есть уже вращающийся ротор. Без Hall мотор стартует в произвольный момент, и первые обороты делаются «вслепую» (open-loop), что даёт рывки и низкий момент при трогании. С Hall старт получается плавным, и уже на первом обороте наблюдатель успевает синхронизироваться. В идеальных прошивках можно обойтись без Hall с помощью HFI (High-Frequency Injection) — подачи сигнала несущей частоты для оценки угла по индуктивности, но это заметно сложнее.
      </Callout>
    </ChapterLayout>
  )
}
