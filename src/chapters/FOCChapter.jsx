import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'
import FocSimulator from '../components/FocSimulator'

const TransformViz = () => {
  const canvasRef = useRef(null)
  const tRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId, lastT = performance.now()
    const ia_hist = [], ib_hist = [], ic_hist = [], alpha_hist = [], beta_hist = [], id_hist = [], iq_hist = []

    const loop = (now) => {
      const dt = (now - lastT) / 1000
      lastT = now
      tRef.current += dt

      const t = tRef.current
      const angle = t * 3.0  // electrical angle
      const Iq = 150, Id = -30

      // Inverse Park → alpha/beta
      const cosa = Math.cos(angle), sina = Math.sin(angle)
      const alpha = Id * cosa - Iq * sina
      const beta  = Id * sina + Iq * cosa

      // Inverse Clarke → a, b, c
      const ia = alpha
      const ib = -0.5 * alpha + (Math.sqrt(3) / 2) * beta
      const ic = -0.5 * alpha - (Math.sqrt(3) / 2) * beta

      ia_hist.push(ia); ib_hist.push(ib); ic_hist.push(ic)
      alpha_hist.push(alpha); beta_hist.push(beta)
      id_hist.push(Id); iq_hist.push(Iq)
      const MAX = 200
      if (ia_hist.length > MAX) { ia_hist.shift(); ib_hist.shift(); ic_hist.shift(); alpha_hist.shift(); beta_hist.shift(); id_hist.shift(); iq_hist.shift() }

      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const panelW = W / 3
      const drawPanel = (offsetX, title, series, scale) => {
        const cx = offsetX + panelW / 2, ph = H
        ctx.strokeStyle = '#141414'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(offsetX, ph / 2); ctx.lineTo(offsetX + panelW - 4, ph / 2); ctx.stroke()
        ctx.fillStyle = '#222'; ctx.font = '8px Inter'; ctx.textAlign = 'left'
        ctx.fillText(title, offsetX + 6, 14)

        series.forEach(({ data, color, label }) => {
          ctx.strokeStyle = color; ctx.lineWidth = 1.5
          ctx.beginPath()
          data.forEach((v, i) => {
            const x = offsetX + (i / MAX) * (panelW - 4)
            const y = ph / 2 - v / scale * (ph / 2 - 20)
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          })
          ctx.stroke()
        })
        ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(offsetX + panelW - 4, 0); ctx.lineTo(offsetX + panelW - 4, ph); ctx.stroke()
      }

      drawPanel(0, 'Фазы A/B/C (3-phase)', [
        { data: ia_hist, color: '#ff3366', label: 'A' },
        { data: ib_hist, color: '#33ff99', label: 'B' },
        { data: ic_hist, color: '#00ccff', label: 'C' },
      ], 200)

      drawPanel(panelW, 'α/β (Clarke, стационар)', [
        { data: alpha_hist, color: '#ff9933', label: 'α' },
        { data: beta_hist,  color: '#cc66ff', label: 'β' },
      ], 200)

      drawPanel(panelW * 2, 'D/Q (Park, вращ. кадр)', [
        { data: id_hist, color: '#ffcc00', label: 'D (поток)' },
        { data: iq_hist, color: '#00ccff', label: 'Q (момент)' },
      ], 200)

      // Labels
      const labels3 = [['A', '#ff3366'], ['B', '#33ff99'], ['C', '#00ccff']]
      labels3.forEach(([l, c], i) => {
        ctx.fillStyle = c; ctx.font = '9px Inter'; ctx.textAlign = 'left'
        ctx.fillText(l, 8 + i * 24, H - 6)
      })
      const labelsAB = [['α', '#ff9933'], ['β', '#cc66ff']]
      labelsAB.forEach(([l, c], i) => {
        ctx.fillStyle = c; ctx.font = '9px Inter'
        ctx.fillText(l, panelW + 8 + i * 20, H - 6)
      })
      const labelsDQ = [['D', '#ffcc00'], ['Q', '#00ccff']]
      labelsDQ.forEach(([l, c], i) => {
        ctx.fillStyle = c; ctx.font = '9px Inter'
        ctx.fillText(l, panelW * 2 + 8 + i * 20, H - 6)
      })

      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas ref={canvasRef} width={780} height={160}
      style={{ width: '100%', height: '160px', background: '#080808', borderRadius: '8px', display: 'block' }} />
  )
}

// Geometric visualization of Clarke and Park transforms.
// Shows the SAME current vector in three coordinate systems side-by-side.
const ClarkeParkGeometry = () => {
  const canvasRef = useRef(null)
  const [iq, setIq] = useState(150)
  const [id, setId] = useState(0)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1.5)  // rad/s of electrical rotation
  const stateRef = useRef({ iq: 150, id: 0, paused: false, speed: 1.5, angle: 0 })

  useEffect(() => { stateRef.current.iq = iq }, [iq])
  useEffect(() => { stateRef.current.id = id }, [id])
  useEffect(() => { stateRef.current.paused = paused }, [paused])
  useEffect(() => { stateRef.current.speed = speed }, [speed])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId, lastT = performance.now()

    const arrow = (x1, y1, x2, y2, color, width = 2) => {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const ah = 8
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - Math.cos(angle - 0.4) * ah, y2 - Math.sin(angle - 0.4) * ah)
      ctx.lineTo(x2 - Math.cos(angle + 0.4) * ah, y2 - Math.sin(angle + 0.4) * ah)
      ctx.closePath(); ctx.fill()
    }

    const loop = (now) => {
      const dt = Math.min((now - lastT) / 1000, 0.04)
      lastT = now
      const s = stateRef.current
      if (!s.paused) s.angle += s.speed * dt
      const angle = s.angle

      // Forward Park: from (Id, Iq) rotating frame to (α, β) stationary
      const cosT = Math.cos(angle), sinT = Math.sin(angle)
      const alpha = s.id * cosT - s.iq * sinT
      const beta  = s.id * sinT + s.iq * cosT
      // Inverse Clarke: from (α, β) to (a, b, c)
      const ia = alpha
      const ib = -0.5 * alpha + (Math.sqrt(3) / 2) * beta
      const ic = -0.5 * alpha - (Math.sqrt(3) / 2) * beta

      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const panelW = W / 3
      const r = Math.min(panelW, H) * 0.35     // base radius for vector scale
      const SCALE = r / 250                     // px per amp

      // ────── PANEL 1: Phase frame (a, b, c at 120°) ──────
      const cx1 = panelW * 0.5, cy = H * 0.55

      ctx.fillStyle = '#999'; ctx.font = 'bold 11px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Фазная (a, b, c)', cx1, 22)
      ctx.fillStyle = '#444'; ctx.font = '9px Inter, sans-serif'
      ctx.fillText('три оси · 120° между ними', cx1, 38)

      const phaseAxes = [
        { angle: -Math.PI / 2,                 color: '#ff3366', label: 'a', val: ia },
        { angle: -Math.PI / 2 + 2 * Math.PI / 3, color: '#33ff99', label: 'b', val: ib },
        { angle: -Math.PI / 2 + 4 * Math.PI / 3, color: '#00ccff', label: 'c', val: ic },
      ]
      // Faint axes
      phaseAxes.forEach(p => {
        ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1; ctx.setLineDash([2, 4])
        const ex = cx1 + Math.cos(p.angle) * r * 1.2
        const ey = cy + Math.sin(p.angle) * r * 1.2
        const ex2 = cx1 + Math.cos(p.angle + Math.PI) * r * 0.4
        const ey2 = cy + Math.sin(p.angle + Math.PI) * r * 0.4
        ctx.beginPath(); ctx.moveTo(ex2, ey2); ctx.lineTo(ex, ey); ctx.stroke()
        ctx.setLineDash([])
        // Axis label
        ctx.fillStyle = p.color + 'aa'; ctx.font = 'bold 11px Inter, sans-serif'
        ctx.fillText(p.label, ex + Math.cos(p.angle) * 14, ey + Math.sin(p.angle) * 14 + 3)
      })
      // Projections on each axis
      phaseAxes.forEach(p => {
        const len = p.val * SCALE
        const ex = cx1 + Math.cos(p.angle) * len
        const ey = cy + Math.sin(p.angle) * len
        if (Math.abs(p.val) > 1) {
          arrow(cx1, cy, ex, ey, p.color, 3)
          ctx.fillStyle = p.color; ctx.font = '10px JetBrains Mono, monospace'
          ctx.textAlign = 'left'
          ctx.fillText(`${p.val.toFixed(0)}A`, ex + 6, ey)
        }
      })

      // ────── PANEL 2: Stationary frame (α, β) ──────
      const cx2 = panelW * 1.5

      ctx.fillStyle = '#999'; ctx.font = 'bold 11px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Стационарная (α, β)', cx2, 22)
      ctx.fillStyle = '#444'; ctx.font = '9px Inter, sans-serif'
      ctx.fillText('Clarke · вектор вращается', cx2, 38)

      // Cartesian axes
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx2 - r * 1.2, cy); ctx.lineTo(cx2 + r * 1.2, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx2, cy - r * 1.1); ctx.lineTo(cx2, cy + r * 1.1); ctx.stroke()
      ctx.fillStyle = '#666'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'left'
      ctx.fillText('α', cx2 + r * 1.2 + 4, cy + 4)
      ctx.textAlign = 'center'
      ctx.fillText('β', cx2, cy - r * 1.15)

      // Original phase axes faint underlay (so you see how a aligns with β-axis convention)
      // Actually a is along +β (top) by convention here.
      // Vector
      const ax = cx2 + alpha * SCALE
      const ay = cy - beta * SCALE
      // Projections (dotted)
      ctx.strokeStyle = '#ff993344'; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(ax, cy); ctx.lineTo(ax, ay); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx2, ay); ctx.lineTo(ax, ay); ctx.stroke()
      ctx.setLineDash([])
      // Axis projections
      arrow(cx2, cy, ax, cy, '#ff993399', 1.5)   // α component
      arrow(cx2, cy, cx2, ay, '#ff993399', 1.5)  // β component
      // Main vector
      arrow(cx2, cy, ax, ay, '#ff9933', 3)
      // Labels
      ctx.fillStyle = '#ff9933'; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'left'
      ctx.fillText(`α=${alpha.toFixed(0)}`, ax + 8, cy + (alpha > 0 ? -6 : 14))
      ctx.fillText(`β=${beta.toFixed(0)}`, cx2 + 6, ay - (beta > 0 ? 6 : -14))

      // ────── PANEL 3: Rotating frame (d, q) ──────
      const cx3 = panelW * 2.5

      ctx.fillStyle = '#999'; ctx.font = 'bold 11px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Вращающаяся (d, q)', cx3, 22)
      ctx.fillStyle = '#444'; ctx.font = '9px Inter, sans-serif'
      ctx.fillText('Park · вектор стоит', cx3, 38)

      // d-axis: rotates with rotor (angle), q-axis 90° ahead
      const dAxAngle = -angle    // visual: rotation reversed because canvas y is down
      const qAxAngle = -angle - Math.PI / 2

      // Faint outer circle (rotor angle indicator)
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx3, cy, r * 1.05, 0, Math.PI * 2); ctx.stroke()

      // Rotor angle indicator (small mark on circle)
      const dx = cx3 + Math.cos(dAxAngle) * r * 1.05
      const dy = cy + Math.sin(dAxAngle) * r * 1.05
      ctx.fillStyle = '#ffcc0044'
      ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2); ctx.fill()

      // Rotating axes
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 4])
      ctx.beginPath(); ctx.moveTo(cx3, cy); ctx.lineTo(cx3 + Math.cos(dAxAngle) * r * 1.1, cy + Math.sin(dAxAngle) * r * 1.1); ctx.stroke()
      ctx.strokeStyle = '#33ff99'
      ctx.beginPath(); ctx.moveTo(cx3, cy); ctx.lineTo(cx3 + Math.cos(qAxAngle) * r * 1.1, cy + Math.sin(qAxAngle) * r * 1.1); ctx.stroke()
      ctx.setLineDash([])
      // Axis labels (at axis tips)
      ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('D', cx3 + Math.cos(dAxAngle) * (r * 1.2), cy + Math.sin(dAxAngle) * (r * 1.2) + 4)
      ctx.fillStyle = '#33ff99'
      ctx.fillText('Q', cx3 + Math.cos(qAxAngle) * (r * 1.2), cy + Math.sin(qAxAngle) * (r * 1.2) + 4)

      // Vector components in rotating frame: by definition Id and Iq, constants
      // Position of vector tip: id * d̂ + iq * q̂
      const tx = cx3 + s.id * SCALE * Math.cos(dAxAngle) + s.iq * SCALE * Math.cos(qAxAngle)
      const ty = cy + s.id * SCALE * Math.sin(dAxAngle) + s.iq * SCALE * Math.sin(qAxAngle)

      // Component projections along rotating axes
      const idEndX = cx3 + s.id * SCALE * Math.cos(dAxAngle)
      const idEndY = cy + s.id * SCALE * Math.sin(dAxAngle)
      const iqEndX = cx3 + s.iq * SCALE * Math.cos(qAxAngle)
      const iqEndY = cy + s.iq * SCALE * Math.sin(qAxAngle)

      ctx.strokeStyle = '#ffcc0066'; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(idEndX, idEndY); ctx.lineTo(tx, ty); ctx.stroke()
      ctx.strokeStyle = '#33ff9966'
      ctx.beginPath(); ctx.moveTo(iqEndX, iqEndY); ctx.lineTo(tx, ty); ctx.stroke()
      ctx.setLineDash([])

      // Component arrows
      if (Math.abs(s.id) > 1) arrow(cx3, cy, idEndX, idEndY, '#ffcc00bb', 1.5)
      if (Math.abs(s.iq) > 1) arrow(cx3, cy, iqEndX, iqEndY, '#33ff99bb', 1.5)

      // Main vector (cyan, same as α/β panel — same physical current!)
      arrow(cx3, cy, tx, ty, '#00ccff', 3)

      // Labels
      ctx.fillStyle = '#ffcc00'; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'left'
      ctx.fillText(`Id=${s.id.toFixed(0)}`, 6 + cx3 - panelW / 2 + 4, H - 28)
      ctx.fillStyle = '#33ff99'
      ctx.fillText(`Iq=${s.iq.toFixed(0)}`, 6 + cx3 - panelW / 2 + 4, H - 14)

      // Panel separators
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(panelW, 14); ctx.lineTo(panelW, H - 4); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(panelW * 2, 14); ctx.lineTo(panelW * 2, H - 4); ctx.stroke()

      // Bottom note: rotor angle
      ctx.fillStyle = '#444'; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'center'
      const angDeg = ((s.angle * 180 / Math.PI) % 360 + 360) % 360
      ctx.fillText(`угол ротора θ = ${angDeg.toFixed(0)}°`, W / 2, H - 6)

      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div>
      <canvas ref={canvasRef} width={780} height={280}
        style={{ width: '100%', height: '280px', background: '#080808', borderRadius: '10px', display: 'block' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '14px', marginTop: '14px', alignItems: 'end' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#555' }}>Iq (момент)</label>
            <span style={{ fontSize: '10px', color: '#33ff99', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>{iq} A</span>
          </div>
          <input type="range" min="-300" max="300" step="5" value={iq}
            onChange={e => setIq(+e.target.value)} style={{ width: '100%', accentColor: '#33ff99' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#555' }}>Id (поле)</label>
            <span style={{ fontSize: '10px', color: '#ffcc00', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>{id} A</span>
          </div>
          <input type="range" min="-200" max="200" step="5" value={id}
            onChange={e => setId(+e.target.value)} style={{ width: '100%', accentColor: '#ffcc00' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#555' }}>Скорость вращения</label>
            <span style={{ fontSize: '10px', color: '#00ccff', fontWeight: '700' }}>{speed.toFixed(1)} рад/с</span>
          </div>
          <input type="range" min="0" max="6" step="0.1" value={speed}
            onChange={e => setSpeed(+e.target.value)} style={{ width: '100%', accentColor: '#00ccff' }} />
        </div>
        <button onClick={() => setPaused(p => !p)}
          style={{ padding: '10px 14px', background: paused ? '#ff993322' : '#1a1a1a', border: `1px solid ${paused ? '#ff993344' : '#333'}`, borderRadius: '6px', color: paused ? '#ff9933' : '#888', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
          {paused ? '▶ Старт' : '⏸ Пауза'}
        </button>
      </div>
      <div style={{ marginTop: '14px', fontSize: '11px', color: '#444', lineHeight: 1.7 }}>
        Один и тот же физический ток показан в трёх системах координат. В фазной (a, b, c) — три синусоиды;
        в стационарной (α, β) — единый вектор, который вращается со скоростью ротора;
        в вращающейся (d, q) — этот же вектор, но в системе, которая сама крутится вместе с ротором, и потому вектор стоит на месте. Именно поэтому FOC работает с PI-регулятором — d/q-токи постоянны при постоянной нагрузке.
      </div>
    </div>
  )
}

export default function FOCChapter() {
  const [showSim, setShowSim] = useState(false)

  return (
    <div>
      <ChapterLayout eyebrow="Глава IV" title="Поток" subtitle="Field-Oriented Control и три системы координат">
        <Section>
          <Prose>
            На выходе балансового PD-регулятора есть желаемое значение <InlineCode>Iq_target</InlineCode>. Задача FOC — добиться того, чтобы именно такой ток протекал в обмотке, создающей крутящий момент, при любой скорости вращения ротора.
          </Prose>
          <Prose>
            Прямое управление напряжениями фаз здесь неэффективно: при вращении ротора требуемая форма напряжения меняется со скоростью и нагрузкой, простая синусоида с фиксированной амплитудой не подходит. FOC решает проблему переносом всех расчётов в систему координат, которая сама вращается вместе с ротором. В такой системе установившиеся токи выглядят как постоянные — их можно регулировать обычным PI-регулятором, будто в коллекторном двигателе постоянного тока.
          </Prose>
        </Section>

        <InteractivePanel title="Три системы координат · живой сигнал">
          <TransformViz />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '16px', fontSize: '11px', color: '#555' }}>
            <div><span style={{ color: '#ff3366' }}>A/B/C</span> — то, что течёт через обмотки. Синусоиды, сдвинутые на 120°. ШИМ управляет ими.</div>
            <div><span style={{ color: '#ff9933' }}>α/β</span> — преобразование Кларке. Три фазы → два ортогональных тока. Из трёх переменных — две (третья зависима).</div>
            <div><span style={{ color: '#00ccff' }}>D/Q</span> — преобразование Парка. Вращающийся кадр. D и Q — постоянные токи при постоянном режиме.</div>
          </div>
        </InteractivePanel>

        <InteractivePanel title="Геометрия преобразований Clarke и Park · один вектор, три представления">
          <ClarkeParkGeometry />
        </InteractivePanel>

        <Section title="Математика преобразований">
          <CodeBlock
            label="foc.js · Clarke transform"
            code={`// Clarke: 3-phase → 2-phase stationary (α, β)
// ia + ib + ic = 0, поэтому ic = -(ia + ib)
export const clarke = (ia, ib, ic) => {
    const alpha = ia;
    const beta = (ia + 2 * ib) / Math.sqrt(3);
    return { alpha, beta };
};

// Park: stationary → rotating (d, q)
// angle = electrical rotor angle (от Flux Observer)
export const park = (alpha, beta, angle) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        d:  alpha * cos + beta * sin,   // flux component
        q: -alpha * sin + beta * cos,   // torque component
    };
};`}
          />
          <CodeBlock
            label="foc.c · PI-регуляторы токов (из прошивки ET Max)"
            address="0x08013974"
            code={`// Q-axis PI controller (регулирует тяговый ток)
pi_out = Math_PI_Controller(
    (int)*PTR_RAM_TARGET_IQ,     // target  (от балансировки)
    (int)motor_state->I_Q_Measured, // measured (от ADC)
    PTR_PI_STRUCT_Q_AXIS          // Kp=0.12, Ki=0.03
);
motor_state->V_Q_Output = pi_out;  // → Vq (напряжение)

// D-axis PI controller (регулирует поток / field weakening)
pi_out = Math_PI_Controller(
    (int)(short)(motor_state->Field_Weakening_Target * 23.0f),
    (int)motor_state->I_D_Measured,
    PTR_PI_STRUCT_D_AXIS
);
motor_state->V_D_Output = pi_out;  // → Vd

// Inverse Park + Inverse Clarke → Vα, Vβ → Va, Vb, Vc
// → SVPWM duty cycles для TIM1 ch1/ch2/ch3`}
          />
        </Section>

        <Section title="Flux Observer: где ротор?">
          <Prose>
            Для работы преобразования Парка нужен точный угол ротора в каждый момент времени. Датчики Холла дают только 6 дискретных позиций за оборот — слишком грубо при 20 кГц. Поэтому при скорости выше ~5 км/ч прошивка переходит на Flux Observer.
          </Prose>
          <Prose>
            Flux Observer интегрирует ЭДС (обратную электродвижущую силу) фаз: <InlineCode>Flux = ∫(V − R·I) dt</InlineCode>. Из потока через atan2 получаем угол. Это чистая математика, без лишних датчиков.
          </Prose>
          <CodeBlock
            label="foc.c · Flux Observer (реконструкция из 0x08013D20)"
            address="0x08013D20"
            code={`// emf_a = Vphase_a − Rs * ia (back-EMF phase A)
int emf_a = ADC1_JDR_PHASE_A * 2 - flux_obs->offset_a;
int emf_b = ADC2_JDR_PHASE_B * 2 - flux_obs->offset_b;

// Integrate: flux += emf * dt
flux_obs->flux_alpha += emf_a;
flux_obs->flux_beta  += (emf_a + 2 * emf_b) / SQRT3_CONST;

// Angle from flux vector
int angle = Math_Atan2_LUT(flux_obs->flux_beta, flux_obs->flux_alpha);
// Результат в формате Q15 (0..65535 = 0..360°)
motor_state->Rotor_Angle_Raw = (uint16_t)angle;`}
          />
        </Section>

        <Callout color="#00ccff" label="SVPWM">
          После вычисления Vd и Vq прошивка применяет <strong>Space Vector PWM</strong> — алгоритм модуляции, который максимально использует доступное напряжение шины (168V), создавая плавный вращающийся вектор. Функция <InlineCode>Control_SVPWM_Modulation_Limit</InlineCode> по адресу <InlineCode>0x00014C00</InlineCode> ограничивает вектор при насыщении, используя таблицу обратных квадратных корней.
        </Callout>
      </ChapterLayout>

      <div style={{ borderTop: '1px solid #141414' }}>
        <div style={{ padding: '20px 48px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button onClick={() => setShowSim(s => !s)}
            style={{ padding: '14px 28px', background: showSim ? '#ff336622' : '#00ccff22', border: `1px solid ${showSim ? '#ff336644' : '#00ccff44'}`, borderRadius: '10px', color: showSim ? '#ff3366' : '#00ccff', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
            {showSim ? 'Скрыть симулятор' : 'Открыть интерактивный FOC симулятор →'}
          </button>
          {!showSim && <span style={{ fontSize: '12px', color: '#333' }}>Полная физика мотора: Clarke/Park, PI-контуры, field weakening, race mode</span>}
        </div>
        {showSim && (
          <div style={{ height: 'calc(100vh - 200px)', borderTop: '1px solid #1a1a1a' }}>
            <FocSimulator />
          </div>
        )}
      </div>
    </div>
  )
}
