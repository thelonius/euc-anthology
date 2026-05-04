import { h } from 'preact'
import { useState, useRef, useEffect } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock } from '../components/CodeBlock'
import { FormulaLegend } from '../components/FormulaLegend'

// ─────────────────────────────────────────────────────────────────────
// Helper: filled arrow head
// ─────────────────────────────────────────────────────────────────────
const drawArrow = (ctx, x0, y0, x1, y1, color, width = 2) => {
  const a = Math.atan2(y1 - y0, x1 - x0)
  const len = Math.hypot(x1 - x0, y1 - y0)
  if (len < 1) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  const ah = 9
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - Math.cos(a - 0.4) * ah, y1 - Math.sin(a - 0.4) * ah)
  ctx.lineTo(x1 - Math.cos(a + 0.4) * ah, y1 - Math.sin(a + 0.4) * ah)
  ctx.closePath(); ctx.fill()
}

// ─────────────────────────────────────────────────────────────────────
// Sim 1 — Saliency: inductance ellipse, V vector, di/dt response
// ─────────────────────────────────────────────────────────────────────
const SaliencySim = () => {
  const canvasRef = useRef(null)
  const [theta, setTheta] = useState(35)        // rotor angle, degrees
  const [vAngle, setVAngle] = useState(0)       // applied V angle in stator frame
  const [saliency, setSaliency] = useState(2.0) // Lq / Ld
  const [autoSpin, setAutoSpin] = useState(true)

  const thetaRef = useRef(35)
  const vAngleRef = useRef(0)
  const saliencyRef = useRef(2.0)
  const autoSpinRef = useRef(true)

  useEffect(() => { thetaRef.current = theta }, [theta])
  useEffect(() => { vAngleRef.current = vAngle }, [vAngle])
  useEffect(() => { saliencyRef.current = saliency }, [saliency])
  useEffect(() => { autoSpinRef.current = autoSpin }, [autoSpin])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId, lastT = performance.now()

    const loop = (now) => {
      const dt = Math.min((now - lastT) / 1000, 0.04)
      lastT = now

      if (autoSpinRef.current) {
        const next = (vAngleRef.current + 80 * dt) % 360
        vAngleRef.current = next
        setVAngle(Math.round(next))
      }

      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const cx = 200, cy = H / 2
      const R = 110
      const θ = thetaRef.current * Math.PI / 180
      const ψv = vAngleRef.current * Math.PI / 180
      const Ld = 1
      const Lq = saliencyRef.current

      // Stator outline
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, R + 30, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx, cy, R + 10, 0, Math.PI * 2); ctx.stroke()

      // Inductance / response ellipse — rotates with rotor
      // For unit V applied at angle α: di/dt-tip traces ellipse with
      // semi-axis (1/Ld) along d, (1/Lq) along q.
      const visualScale = 70
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(θ)
      ctx.strokeStyle = '#ff993333'; ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      const a = visualScale / Ld
      const b = visualScale / Lq
      ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()

      // Rotor disc
      ctx.fillStyle = '#0a0a0a'
      ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI * 2); ctx.stroke()

      // N / S poles
      const polePos = (a) => ({ x: cx + Math.cos(a) * 50, y: cy + Math.sin(a) * 50 })
      const nE = polePos(θ)
      const sE = polePos(θ + Math.PI)
      ctx.fillStyle = '#ff3366'; ctx.beginPath(); ctx.arc(nE.x, nE.y, 13, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#3366ff'; ctx.beginPath(); ctx.arc(sE.x, sE.y, 13, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Inter, sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('N', nE.x, nE.y); ctx.fillText('S', sE.x, sE.y)
      ctx.fillStyle = '#0a0a0a'
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill()

      // d / q axes
      const dx = cx + Math.cos(θ) * (R + 6)
      const dy = cy + Math.sin(θ) * (R + 6)
      const qx = cx + Math.cos(θ - Math.PI / 2) * (R + 6)
      const qy = cy + Math.sin(θ - Math.PI / 2) * (R + 6)
      ctx.strokeStyle = '#ffcc0066'; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke()
      ctx.strokeStyle = '#33ff9966'; ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(qx, qy); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 12px Inter, sans-serif'
      ctx.fillText('d', cx + Math.cos(θ) * (R + 22), cy + Math.sin(θ) * (R + 22))
      ctx.fillStyle = '#33ff99'
      ctx.fillText('q', cx + Math.cos(θ - Math.PI / 2) * (R + 22), cy + Math.sin(θ - Math.PI / 2) * (R + 22))

      // V vector (yellow)
      const Vlen = 90
      const Vex = cx + Math.cos(ψv) * Vlen
      const Vey = cy + Math.sin(ψv) * Vlen
      drawArrow(ctx, cx, cy, Vex, Vey, '#ffeb3b', 3)
      ctx.fillStyle = '#ffeb3b'; ctx.font = 'bold 12px Inter, sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('V', cx + Math.cos(ψv) * (Vlen + 14), cy + Math.sin(ψv) * (Vlen + 14))

      // di/dt vector (cyan): in rotor frame Vd/Ld, Vq/Lq, then back to stator
      const Vd = Math.cos(ψv - θ)
      const Vq = Math.sin(ψv - θ)
      const did = Vd / Ld
      const diq = Vq / Lq
      const diα = did * Math.cos(θ) - diq * Math.sin(θ)
      const diβ = did * Math.sin(θ) + diq * Math.cos(θ)
      const dilen = Math.hypot(diα, diβ) * visualScale
      const diAng = Math.atan2(diβ, diα)
      const Iex = cx + Math.cos(diAng) * dilen
      const Iey = cy + Math.sin(diAng) * dilen
      drawArrow(ctx, cx, cy, Iex, Iey, '#00ccff', 3)
      ctx.fillStyle = '#00ccff'
      ctx.fillText('di/dt', cx + Math.cos(diAng) * (dilen + 22), cy + Math.sin(diAng) * (dilen + 22))

      // Right pane — angle-deviation gauge
      const px = 430, pw = W - px - 20, py = 30, ph = H - 60
      let dev = (diAng - ψv) * 180 / Math.PI
      while (dev > 180) dev -= 360
      while (dev < -180) dev += 360

      ctx.fillStyle = '#888'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'left'
      ctx.fillText('УГОЛ ОТКЛОНЕНИЯ di/dt от V', px, py - 10)

      // gauge background
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(px, py, pw, ph)
      ctx.strokeStyle = '#1a1a1a'; ctx.strokeRect(px, py, pw, ph)

      // 0 line
      const midX = px + pw / 2
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(midX, py); ctx.lineTo(midX, py + ph); ctx.stroke()

      // ±45 ticks
      ctx.fillStyle = '#444'; ctx.font = '9px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ;[-90, -45, 0, 45, 90].forEach(v => {
        const x = midX + (v / 90) * (pw / 2 - 8)
        ctx.strokeStyle = '#222'
        ctx.beginPath(); ctx.moveTo(x, py + ph - 18); ctx.lineTo(x, py + ph - 12); ctx.stroke()
        ctx.fillText(`${v}°`, x, py + ph - 4)
      })

      // bar
      const dvBar = Math.max(-90, Math.min(90, dev))
      const barW = (dvBar / 90) * (pw / 2 - 8)
      const barColor = Math.abs(dvBar) < 1 ? '#444' : '#ff9933'
      ctx.fillStyle = barColor + '44'
      ctx.fillRect(midX, py + 30, barW, 26)
      ctx.fillStyle = barColor
      ctx.fillRect(midX, py + 30, barW > 0 ? barW : 0, 26)
      ctx.fillRect(midX + barW, py + 30, barW < 0 ? -barW : 0, 26)

      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${dev >= 0 ? '+' : ''}${dev.toFixed(1)}°`, midX, py + 88)

      ctx.fillStyle = '#666'; ctx.font = '10px Inter, sans-serif'
      ctx.fillText(
        Math.abs(dev) < 0.5
          ? 'V и di/dt параллельны → угол ротора недоступен'
          : 'мотор отвечает «вкось» → угол можно извлечь',
        midX, py + ph - 36
      )

      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div>
      <canvas ref={canvasRef} width={780} height={260}
        style={{ width: '100%', height: '260px', background: '#080808', borderRadius: '8px', display: 'block' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '16px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#555' }}>Угол ротора θ</label>
            <span style={{ fontSize: '10px', color: '#ff3366', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>{theta}°</span>
          </div>
          <input type="range" min="0" max="359" step="1" value={theta} onChange={e => setTheta(+e.target.value)}
            style={{ width: '100%', accentColor: '#ff3366' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#555' }}>Угол V</label>
            <span style={{ fontSize: '10px', color: '#ffeb3b', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>{vAngle}°</span>
          </div>
          <input type="range" min="0" max="359" step="1" value={vAngle} disabled={autoSpin} onChange={e => setVAngle(+e.target.value)}
            style={{ width: '100%', accentColor: '#ffeb3b', opacity: autoSpin ? 0.4 : 1 }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#555' }}>Lq / Ld</label>
            <span style={{ fontSize: '10px', color: '#00ccff', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>{saliency.toFixed(2)}</span>
          </div>
          <input type="range" min="1.0" max="3.0" step="0.05" value={saliency} onChange={e => setSaliency(+e.target.value)}
            style={{ width: '100%', accentColor: '#00ccff' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setAutoSpin(!autoSpin)}
          style={{ padding: '6px 12px', background: autoSpin ? '#33ff9922' : '#1a1a1a', border: `1px solid ${autoSpin ? '#33ff9944' : '#333'}`, borderRadius: '6px', color: autoSpin ? '#33ff99' : '#666', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>
          {autoSpin ? '⏸ Остановить вращение V' : '▶ Вращать V автоматически'}
        </button>
        <button onClick={() => setSaliency(1.0)}
          style={{ padding: '6px 12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#888', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>
          SPM (Lq/Ld = 1.0)
        </button>
        <button onClick={() => setSaliency(2.0)}
          style={{ padding: '6px 12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#888', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>
          IPM средний (2.0)
        </button>
        <button onClick={() => setSaliency(3.0)}
          style={{ padding: '6px 12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#888', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>
          IPM сильный (3.0)
        </button>
      </div>

      <div style={{ marginTop: '14px', fontSize: '11px', color: '#444', lineHeight: 1.6 }}>
        Прикладываем тестовый вектор напряжения V к покоящемуся мотору. Ток нарастает со скоростью di/dt = V / L,
        где L различна по осям ротора. У IPM (Lq &gt; Ld) ток растёт быстрее поперёк магнита, чем вдоль, и вектор di/dt
        отклоняется от V. По величине отклонения восстанавливается ориентация ротора. У SPM (Lq ≈ Ld) эллипс становится
        кругом, отклонение исчезает, и метод теряет источник информации.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Sim 2 — Closed-loop HFI tracker: carrier · iq response · PLL
// ─────────────────────────────────────────────────────────────────────
const HFITrackingSim = () => {
  const canvasRef = useRef(null)
  const [saliency, setSaliency] = useState(2.0)
  const [pllGain, setPllGain] = useState(40)
  const [running, setRunning] = useState(true)

  const saliencyRef = useRef(2.0)
  const pllGainRef = useRef(40)
  const runningRef = useRef(true)
  const kickRef = useRef(0)

  useEffect(() => { saliencyRef.current = saliency }, [saliency])
  useEffect(() => { pllGainRef.current = pllGain }, [pllGain])
  useEffect(() => { runningRef.current = running }, [running])

  // Persistent simulation state
  const stateRef = useRef({
    t: 0,
    θ_true: 0.6,
    θ_est: 0,
    pll_int: 0,
    err_lpf: 0,
    histIq: new Float32Array(400),
    histErr: new Float32Array(400),
    histTrue: new Float32Array(400),
    histEst: new Float32Array(400),
    histPtr: 0,
    convergeTime: -1,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId, lastT = performance.now()
    const carrierFreq = 8        // visual Hz (slowed for visibility)
    const subSteps = 8           // sub-steps per frame for clean integration

    const loop = (now) => {
      const dt = Math.min((now - lastT) / 1000, 0.05)
      lastT = now
      const S = stateRef.current

      if (runningRef.current) {
        const sub_dt = dt / subSteps
        for (let i = 0; i < subSteps; i++) {
          S.t += sub_dt

          // True rotor angle drifts slowly + sudden kicks
          S.θ_true += 0.15 * sub_dt
          if (kickRef.current !== 0) {
            S.θ_true += kickRef.current
            kickRef.current = 0
          }
          S.θ_true = ((S.θ_true % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

          // Carrier
          const ω_h = 2 * Math.PI * carrierFreq
          const carrier = Math.cos(ω_h * S.t)

          // Saliency factor: (1/Ld − 1/Lq). With Ld = 1, Lq = λ:
          const λ = saliencyRef.current
          const salFactor = (1 - 1 / λ)  // 0 when λ=1, 0.67 when λ=3

          // Angle error (wrapped to ±π for math, but PLL cares about sin(2θ_err))
          let θ_err = S.θ_true - S.θ_est
          while (θ_err > Math.PI) θ_err -= 2 * Math.PI
          while (θ_err < -Math.PI) θ_err += 2 * Math.PI

          // iq response in estimated frame, idealised closed-form
          const noise = (Math.random() - 0.5) * 0.04
          const iq_raw = salFactor * Math.sin(2 * θ_err) * carrier + noise

          // Demodulate by carrier
          const demod = iq_raw * carrier   // = 0.5·salFactor·sin(2θ_err)·(1+cos(2ω_h t)) + noise·carrier

          // Low-pass filter (1-pole) with cutoff well below 2·carrier
          const lpf_a = 1 - Math.exp(-sub_dt * 2 * Math.PI * 2)  // 2 Hz cutoff
          S.err_lpf += lpf_a * (demod - S.err_lpf)

          // PLL: drives sin(2θ_err) → 0
          const Kp = pllGainRef.current * 0.05
          const Ki = pllGainRef.current * 0.5
          S.pll_int += Ki * S.err_lpf * sub_dt
          const ω_est = Kp * S.err_lpf + S.pll_int
          S.θ_est += ω_est * sub_dt
          S.θ_est = ((S.θ_est % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

          // Convergence detector (within 5° for the first time after a kick)
          if (S.convergeTime < 0 && Math.abs(θ_err) < 5 * Math.PI / 180 && S.t > 0.3) {
            S.convergeTime = S.t
          }

          // Histories — once per frame, not per sub-step
          if (i === subSteps - 1) {
            S.histIq[S.histPtr] = iq_raw
            S.histErr[S.histPtr] = S.err_lpf
            S.histTrue[S.histPtr] = S.θ_true
            S.histEst[S.histPtr] = S.θ_est
            S.histPtr = (S.histPtr + 1) % 400
          }
        }
      }

      // ─── Rendering ───
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const stripeH = 70
      const stripeGap = 10
      const stripeW = W - 100
      const stripeX = 90

      const drawStripe = (yTop, label, color, getter, range) => {
        ctx.fillStyle = '#0b0b0b'
        ctx.fillRect(stripeX, yTop, stripeW, stripeH)
        ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1
        ctx.strokeRect(stripeX, yTop, stripeW, stripeH)

        // zero line
        const midY = yTop + stripeH / 2
        ctx.strokeStyle = '#181818'
        ctx.beginPath(); ctx.moveTo(stripeX, midY); ctx.lineTo(stripeX + stripeW, midY); ctx.stroke()

        // label
        ctx.fillStyle = color; ctx.font = 'bold 10px Inter, sans-serif'
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
        ctx.fillText(label, stripeX - 8, yTop + 14)

        // trace
        ctx.strokeStyle = color; ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let i = 0; i < 400; i++) {
          const idx = (stateRef.current.histPtr + i) % 400
          const v = getter(idx)
          const x = stripeX + (i / 399) * stripeW
          const y = midY - (v / range) * (stripeH / 2 - 4)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()

        // range label
        ctx.fillStyle = '#333'; ctx.font = '9px JetBrains Mono, monospace'
        ctx.textAlign = 'right'
        ctx.fillText(`±${range}`, stripeX - 8, yTop + stripeH - 4)
      }

      // Stripe 1: iq raw — carrier modulated by sin(2θ_err)
      drawStripe(20, 'iq raw', '#ff9933',
        i => S.histIq[i], 1.0)

      // Stripe 2: demodulated + LPF — error signal
      drawStripe(20 + stripeH + stripeGap, 'демод · LPF', '#ffcc00',
        i => S.histErr[i], 0.5)

      // Stripe 3: angles — true (white dashed) and est (cyan)
      const yTop = 20 + 2 * (stripeH + stripeGap)
      ctx.fillStyle = '#0b0b0b'
      ctx.fillRect(stripeX, yTop, stripeW, stripeH)
      ctx.strokeStyle = '#1a1a1a'; ctx.strokeRect(stripeX, yTop, stripeW, stripeH)

      ctx.fillStyle = '#ccc'; ctx.font = 'bold 10px Inter, sans-serif'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText('θ_true vs θ_est', stripeX - 8, yTop + 14)

      // True angle: white dashed
      ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
      ctx.beginPath()
      let lastY = null
      for (let i = 0; i < 400; i++) {
        const idx = (S.histPtr + i) % 400
        const v = S.histTrue[idx]
        const x = stripeX + (i / 399) * stripeW
        const y = yTop + stripeH - 4 - (v / (2 * Math.PI)) * (stripeH - 8)
        if (lastY !== null && Math.abs(y - lastY) > stripeH / 2) {
          ctx.moveTo(x, y)
        } else {
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        lastY = y
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Estimated angle: cyan
      ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 1.8
      ctx.beginPath()
      lastY = null
      for (let i = 0; i < 400; i++) {
        const idx = (S.histPtr + i) % 400
        const v = S.histEst[idx]
        const x = stripeX + (i / 399) * stripeW
        const y = yTop + stripeH - 4 - (v / (2 * Math.PI)) * (stripeH - 8)
        if (lastY !== null && Math.abs(y - lastY) > stripeH / 2) {
          ctx.moveTo(x, y)
        } else {
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        lastY = y
      }
      ctx.stroke()

      ctx.fillStyle = '#333'; ctx.font = '9px JetBrains Mono, monospace'
      ctx.textAlign = 'right'
      ctx.fillText('2π', stripeX - 8, yTop + 6)
      ctx.fillText('0', stripeX - 8, yTop + stripeH - 4)

      // legend
      ctx.fillStyle = '#fff'; ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'left'
      ctx.fillText('— θ_true', stripeX + stripeW - 110, yTop + 12)
      ctx.fillStyle = '#00ccff'
      ctx.fillText('— θ_est', stripeX + stripeW - 56, yTop + 12)

      // angle error readout
      let θ_err = S.θ_true - S.θ_est
      while (θ_err > Math.PI) θ_err -= 2 * Math.PI
      while (θ_err < -Math.PI) θ_err += 2 * Math.PI
      ctx.fillStyle = Math.abs(θ_err) < 0.1 ? '#33ff99' : '#ff9933'
      ctx.font = 'bold 11px JetBrains Mono, monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`Δθ = ${(θ_err * 180 / Math.PI).toFixed(1)}°`, stripeX + stripeW - 8, yTop + stripeH - 6)

      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  const kick = (delta) => { kickRef.current += delta; stateRef.current.convergeTime = -1 }

  return (
    <div>
      <canvas ref={canvasRef} width={780} height={260}
        style={{ width: '100%', height: '260px', background: '#080808', borderRadius: '8px', display: 'block' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '16px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#555' }}>Lq / Ld (явнополюсность)</label>
            <span style={{ fontSize: '10px', color: '#00ccff', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>{saliency.toFixed(2)}</span>
          </div>
          <input type="range" min="1.0" max="3.0" step="0.05" value={saliency} onChange={e => setSaliency(+e.target.value)}
            style={{ width: '100%', accentColor: '#00ccff' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#555' }}>Усиление PLL</label>
            <span style={{ fontSize: '10px', color: '#33ff99', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>{pllGain}</span>
          </div>
          <input type="range" min="5" max="120" step="1" value={pllGain} onChange={e => setPllGain(+e.target.value)}
            style={{ width: '100%', accentColor: '#33ff99' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => kick(Math.PI / 3)}
          style={{ padding: '6px 12px', background: '#ff993322', border: '1px solid #ff993344', borderRadius: '6px', color: '#ff9933', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>
          толчок θ +60°
        </button>
        <button onClick={() => kick(-Math.PI / 3)}
          style={{ padding: '6px 12px', background: '#ff993322', border: '1px solid #ff993344', borderRadius: '6px', color: '#ff9933', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>
          толчок θ −60°
        </button>
        <button onClick={() => kick(Math.PI)}
          style={{ padding: '6px 12px', background: '#ff336622', border: '1px solid #ff336644', borderRadius: '6px', color: '#ff3366', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>
          толчок θ +180° (полярность)
        </button>
        <button onClick={() => setRunning(!running)}
          style={{ padding: '6px 12px', background: running ? '#1a1a1a' : '#33ff9922', border: `1px solid ${running ? '#333' : '#33ff9944'}`, borderRadius: '6px', color: running ? '#888' : '#33ff99', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>
          {running ? '⏸ Пауза' : '▶ Запустить'}
        </button>
      </div>

      <div style={{ marginTop: '14px', fontSize: '11px', color: '#444', lineHeight: 1.6 }}>
        Поставьте Lq/Ld в 1.0: оранжевая дорожка iq потускнеет, демодулятор перестанет видеть ошибку, оценка угла «уплывёт».
        Толчок на 180° показывает фундаментальную особенность HFI: алгоритм видит sin(2θ_err) и не различает N от S — после такого толчка
        PLL «защёлкнется» в новом локе с обратной полярностью. Чтобы определить, где север, нужен отдельный этап на старте: например,
        короткий импульс по предполагаемой d-оси и наблюдение за лёгкой асимметрией от насыщения железа.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Chapter
// ─────────────────────────────────────────────────────────────────────
export default function HFIChapter() {
  return (
    <ChapterLayout eyebrow="Глава X" title="Инжекция" subtitle="HFI — датчик угла, спрятанный в самом моторе">
      <Section>
        <Prose>
          В предыдущей главе наблюдатель вытаскивал угол ротора из back-EMF. Метод работает только тогда, когда мотор уже вращается:
          без скорости нет наводки, нет наводки — нечего интегрировать. Прошивка ET Max обходит это датчиками Холла на старте.
          Существует и другой способ обойтись без Hall, который ловит угол даже на полностью неподвижном роторе.
          Идея в том, чтобы не слушать back-EMF, а самому подать высокочастотный пробный сигнал и слушать,
          как мотор отвечает на него. Метод называется HFI (High-Frequency Injection), и работает он на свойстве,
          о котором пока в этой антологии не говорилось: явнополюсности (saliency).
        </Prose>
      </Section>

      <Section title="Явнополюсность: индуктивность, которая зависит от угла">
        <Prose>
          Если магниты на роторе вмонтированы в железо (IPM, Interior Permanent Magnet), магнитный поток обмоток статора
          встречает разное сопротивление в зависимости от того, как стоит ротор. Вдоль магнита (ось d) поток упирается в неодимовый
          магнит и в эффективный воздушный зазор: индуктивность Ld мала. Поперёк (ось q) поток идёт по железу через зазоры между магнитами:
          индуктивность Lq заметно больше. Типичные значения для тягового IPM: Lq/Ld от 1.5 до 3.
        </Prose>
        <Prose>
          У SPM (Surface Permanent Magnet — магниты приклеены на поверхность) разница исчезает: поток везде проходит через один и тот же
          воздушный зазор плюс магнит. Lq ≈ Ld, отношение около 1.05–1.1. Хабовые моторы EUC, включая ET Max, относятся именно к SPM:
          такая конструкция дешевле, проще в сборке и даёт ровный момент. Цена: HFI на них почти не работает.
        </Prose>
        <Prose>
          Прикладываем тестовый вектор напряжения V и смотрим, как растёт ток. На покоящемся моторе сопротивление и back-EMF можно пренебречь,
          и di/dt = V/L. Но L зависит от того, в какую сторону мы прикладываем напряжение относительно ротора. Прикладываем вдоль d — ток нарастает быстро
          (Ld маленькая), вдоль q — медленно (Lq большая). Если приложить под углом, di/dt получится «вкось»: вектор отклика отклоняется от вектора V.
          Угол отклонения зависит от ориентации ротора, и по нему восстанавливается θ.
        </Prose>
      </Section>

      <InteractivePanel title="Эллипс отклика · откуда берётся отклонение di/dt от V">
        <SaliencySim />
      </InteractivePanel>

      <Section title="Несущая на оценочной оси d">
        <Prose>
          На практике никто не подаёт одиночный пробный импульс. Вместо этого в команды напряжения, выходящие из PI-регуляторов
          токового контура, добавляется небольшая высокочастотная синусоида — обычно 500–2000 Hz, амплитуда несколько вольт.
          Несущая накладывается на оценочную d-ось: то есть туда, куда контроллер думает, что смотрит ротор.
        </Prose>
        <CodeBlock
          label="инъекция несущей · добавка к выходу PI токов"
          code={`// Carrier injection at ω_h ≈ 1 kHz, V_h ≈ 5 V
// Добавляется к Vd_pi ПОСЛЕ обычного PI регулятора Id

#define HFI_FREQ_HZ      1000.0f
#define HFI_AMPLITUDE_V    5.0f
#define HFI_OMEGA   (2.0f * M_PI * HFI_FREQ_HZ)

static float hfi_phase = 0;

void Control_HFI_Inject(float dt) {
    hfi_phase += HFI_OMEGA * dt;
    if (hfi_phase > 2 * M_PI) hfi_phase -= 2 * M_PI;

    float vh = HFI_AMPLITUDE_V * cosf(hfi_phase);

    // На вход обратного Park добавляем несущую только по d
    motor_state->Vd_cmd = motor_state->Vd_pi + vh;
    motor_state->Vq_cmd = motor_state->Vq_pi;
    // ...далее: inverse Park, SVPWM, TIM1->CCRx
}`}
        />
        <FormulaLegend items={[
          ['ω_h', 'угловая частота несущей, рад/с. Для 1 кГц это 2π·1000 ≈ 6283 рад/с.'],
          ['V_h', 'амплитуда несущей в вольтах. Обычно 3–8 В: больше = лучше SNR, но громче свист и больше потери.'],
          ['hfi_phase', 'накопленная фаза несущей ω_h·t. Хранится по модулю 2π, чтобы не терять точность float со временем.'],
          ['Vd_pi, Vq_pi', 'выходы PI-регуляторов токов Id/Iq до инжекции. Это то, что просит обычный FOC.'],
          ['Vd_cmd, Vq_cmd', 'итоговые команды напряжения, которые уйдут в обратный Park и далее в SVPWM. Несущая прибавляется только к Vd.'],
        ]} />
        <Prose>
          Что происходит дальше, легче всего показать формулой. Пусть ошибка оценки угла θ_err = θ_true − θ_est. Если оценка точна (θ_err = 0),
          несущая попадает строго в d ротора, ток отвечает только по d, и в q-токе ничего не происходит. Если есть ошибка, часть несущей
          «протекает» в q-направление, и iq начинает осциллировать в такт с несущей. Амплитуда этой осцилляции и есть индикатор ошибки:
        </Prose>
        <CodeBlock
          label="математика отклика iq на несущей"
          code={`// Vd_inj = V_h · cos(ω_h · t),  Vq_inj = 0  (в оценочном dq)
//
// После прокручивания через невыровненную систему координат:
//   iq_response(t) ≈ ( V_h / (2·ω_h) ) · ( 1/Ld − 1/Lq ) · sin(2·θ_err) · cos(ω_h·t)
//
// Ключевые наблюдения:
//   1) Множитель (1/Ld − 1/Lq): обращается в ноль при Ld = Lq. Это формальное
//      объяснение, почему HFI требует явнополюсности.
//   2) Множитель sin(2·θ_err): для малой ошибки ≈ 2·θ_err — линейный сигнал
//      ошибки, идеальный вход для замкнутого регулятора.
//   3) Аргумент 2·θ_err: алгоритм не различает θ_err от θ_err + π. Север
//      и юг для HFI выглядят одинаково.

// Демодуляция: умножаем iq на cos(ω_h·t) и пропускаем через ФНЧ
//   demod = iq · cos(ω_h·t) → постоянная компонента 0.5·K·sin(2·θ_err)
//   + удвоенная гармоника несущей, которую снимает ФНЧ`}
        />
        <FormulaLegend items={[
          ['θ_true', 'настоящий электрический угол ротора, который мы хотим узнать.'],
          ['θ_est', 'текущая оценка угла, поддерживаемая PLL. То, на что ориентируется обратный Park.'],
          ['θ_err', 'θ_true − θ_est, ошибка оценки. Цель PLL — удерживать её около нуля.'],
          ['1/Ld − 1/Lq', 'разностный множитель, мера явнополюсности. У SPM ≈ 0, у IPM 0.3–0.7.'],
          ['sin(2·θ_err)', 'удвоенный аргумент: HFI «чует» ошибку, но не отличает θ от θ + π. Отсюда задача определения полярности на старте.'],
          ['cos(ω_h·t)', 'модуляция несущей в отклике. Снимается умножением на тот же cos и ФНЧ.'],
        ]} />
      </Section>

      <Section title="Замкнутая петля: PLL по углу">
        <Prose>
          Демодулированный сигнал ошибки скармливается классическому PLL: пропорциональный и интегральный коэффициенты
          вырабатывают оценку угловой скорости, оценка интегрируется в θ_est. PLL подкручивает свою оценку до тех пор,
          пока sin(2·θ_err) не обратится в ноль. С этого момента контур заперт, и θ_est отслеживает θ_true даже при медленном вращении и в покое.
        </Prose>
        <CodeBlock
          label="демодуляция и PLL"
          code={`static float pll_int = 0;
static float err_lpf = 0;

void Control_HFI_Demodulate_And_Track(float iq_measured, float dt) {
    // Demod: умножение на несущую той же фазы
    float carrier = cosf(hfi_phase);
    float demod = iq_measured * carrier;

    // ФНЧ 1-го порядка с частотой среза заметно ниже несущей
    float alpha = 1.0f - expf(-dt * 2.0f * M_PI * 50.0f);  // 50 Hz cutoff
    err_lpf += alpha * (demod - err_lpf);

    // PLL: гонит err_lpf к нулю
    const float Kp_pll = 200.0f;
    const float Ki_pll = 8000.0f;
    pll_int += Ki_pll * err_lpf * dt;
    float omega_est = Kp_pll * err_lpf + pll_int;

    motor_state->Rotor_Angle_HFI += omega_est * dt;
    // wraparound в [0, 2π)
}`}
        />
        <FormulaLegend items={[
          ['carrier', 'та же cos(ω_h·t), что использовалась при инжекции. Демодулятор должен умножать на ту же фазу.'],
          ['demod', 'произведение iq · carrier. Содержит постоянную часть ∝ sin(2·θ_err) плюс гармонику на 2·ω_h.'],
          ['α', 'коэффициент однополюсного ФНЧ. α = 1 − exp(−dt·2π·f_c), где f_c — частота среза в Гц.'],
          ['err_lpf', 'отфильтрованный сигнал ошибки. На локе ≈ 0, при толчке θ_true делает скачок и плавно возвращается.'],
          ['Kp_pll, Ki_pll', 'коэффициенты PLL. Kp задаёт скорость отклика, Ki убирает остаточный сдвиг и подхватывает медленное вращение.'],
          ['pll_int', 'интеграл ошибки. После лока удерживает оценку угловой скорости, даже если err_lpf обнулилась.'],
          ['omega_est', 'оценочная угловая скорость, которую интегрируем в θ_est.'],
        ]} />
      </Section>

      <InteractivePanel title="HFI в замкнутом контуре · карта несущей, демодулятора и PLL">
        <HFITrackingSim />
      </InteractivePanel>

      <Section title="Проблема полярности и как её обходят">
        <Prose>
          Зависимость отклика от sin(2·θ_err) даёт фундаментальную особенность: PLL одинаково охотно «защёлкивается»
          и на правильный угол, и на угол со сдвигом ровно на 180°. Геометрически это значит, что HFI само по себе не отличает
          северный полюс магнита от южного. Для FOC это критично: старт с 180°-ошибкой даст крутящий момент в обратную сторону.
        </Prose>
        <Prose>
          Решение из учебников — однократная процедура определения полярности до начала движения. Самый простой вариант:
          подать короткий положительный импульс по предполагаемой d-оси, потом такой же по отрицательной d-оси, и сравнить
          амплитуду отклика. Железо ротора немного насыщается полем магнита по «правильной» стороне, и индуктивность там
          оказывается чуть меньше, чем по «неправильной». Разница в 5–10% по амплитуде — этого достаточно, чтобы выбрать
          верную полярность за десяток миллисекунд.
        </Prose>
      </Section>

      <Section title="Цена решения">
        <Prose>
          У HFI есть два постоянно повторяющихся минуса. Первый: 1–2 кГц несущая попадает в железо мотора и в обмотки,
          и мотор начинает свистеть на этой частоте. Слышно даже в стоящей машине, и громко слышно, если мотор большой
          и без шумоизоляции. Промышленные приводы от этого спасаются ультразвуковой инъекцией (свыше 16 кГц), но для
          моторов с большой индуктивностью это тяжело: при той же амплитуде тока на высокой частоте нужен квадратично больший вольтаж.
        </Prose>
        <Prose>
          Второй минус: HFI забирает запас напряжения и динамики токового контура. Несущая на d-оси всегда
          присутствует и всегда отжирает несколько вольт от Vbus, которые иначе пошли бы в основной момент. На скоростях
          выше базовой это уже неприемлемо. Стандартная схема: HFI работает только на низких скоростях, на средних
          плавно подмешивается с наблюдателем, выше — выключается полностью.
        </Prose>
      </Section>

      <Callout color="#33ff99" label="Где HFI реально живёт">
        В индустриальных и автомобильных приводах с IPM-моторами — Tesla, серьёзная робототехника, аккумуляторный электроинструмент
        с прецизионным управлением. У этих моторов саркальная конструкция явно вытягивает Lq/Lq до 2× и выше, насыщение железа
        даёт большой полярный сигнал, и шум 1–2 кГц либо тонет в общем гуле машины, либо специально вынесен ультразвук.
      </Callout>

      <Callout color="#ff9933" label="Почему ET Max не использует HFI">
        Хабовый мотор ET Max — это SPM с поверхностными магнитами и Lq/Ld около 1.05. Для HFI это слишком близко к единице:
        полезный сигнал тонет в шуме АЦП, а свист на 1 кГц прямо под ногами наездника не нравится никому. Прошивка идёт
        по более простой схеме: три датчика Холла на старте до 5 км/ч, дальше Flux Observer на back-EMF. Из всех путей,
        которые рассмотрены в этой антологии, HFI остаётся теоретическим «а что если бы»: чтобы он стал практичным на EUC,
        пришлось бы менять конструкцию мотора.
      </Callout>
    </ChapterLayout>
  )
}
