import { h } from 'preact'
import { useState, useEffect, useRef, useCallback } from 'preact/hooks'
import {
  riderCylinders, flowVelocity, pressureCoeff,
  estimateCdA, motorForce, aeroDrag, rollingResist, totalDrag,
  physicsVmax, leanAccel,
  RHO,
} from '../logic/aero'

// ---------------------------------------------------------------------------
// Canvas constants
// ---------------------------------------------------------------------------
const CW = 620        // canvas width  (px)
const CH = 380        // canvas height (px)
const SCALE = 142     // px per metre
const WX0 = 1.52      // world-x at canvas left edge (m)  → rider at x=0 ≈ 216px
const WY_TOP = CH / SCALE  // world-y at canvas top (≈ 2.68 m)

const w2c = (wx, wy) => [(wx + WX0) * SCALE, CH - wy * SCALE]
const c2w = (cx, cy) => [cx / SCALE - WX0, (CH - cy) / SCALE]

// Pressure → RGBA   (Cp > 0 = blue/stagnation, Cp < 0 = red/suction)
const cpColor = (Cp) => {
  if (Cp > 0.06) {
    const t = Math.min(1, Cp * 0.9)
    return [Math.round(10 + t * 10), Math.round(30 + t * 80), Math.round(20 + t * 210), Math.round(t * 160)]
  }
  if (Cp < -0.06) {
    const t = Math.min(1, -Cp * 0.38)
    return [Math.round(10 + t * 220), Math.round(10 + t * 50), Math.round(15 - t * 5), Math.round(t * 155)]
  }
  return [0, 0, 0, 0]
}

// ---------------------------------------------------------------------------
// Precompute pressure field into an ImageData buffer (slow, call on param change)
// ---------------------------------------------------------------------------
function buildPressureImageData(cylinders, U0) {
  const STEP = 4
  const buf = new Uint8ClampedArray(CW * CH * 4)

  for (let cy = 0; cy < CH; cy += STEP) {
    for (let cx = 0; cx < CW; cx += STEP) {
      const [wx, wy] = c2w(cx + STEP / 2, cy + STEP / 2)
      if (wy < 0) continue

      // Skip if inside a cylinder (will be covered by body draw)
      let inside = false
      for (const c of cylinders) {
        const dx = wx - c.x, dy = wy - c.y
        if (dx * dx + dy * dy < c.r * c.r) { inside = true; break }
      }
      if (inside) continue

      const { u, v } = flowVelocity(wx, wy, cylinders, U0)
      if (u === 0 && v === 0) continue
      const Cp = pressureCoeff(u, v, U0)
      const [r, g, b, a] = cpColor(Cp)
      if (a < 4) continue

      for (let dy = 0; dy < STEP && cy + dy < CH; dy++) {
        for (let dx = 0; dx < STEP && cx + dx < CW; dx++) {
          const idx = ((cy + dy) * CW + (cx + dx)) * 4
          buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = a
        }
      }
    }
  }
  return new ImageData(buf, CW, CH)
}

// ---------------------------------------------------------------------------
// Draw rider body silhouette (circles → filled body shapes)
// ---------------------------------------------------------------------------
function drawRiderBody(ctx, cylinders) {
  // Shadow / glow
  ctx.shadowColor = 'rgba(0,200,255,0.12)'
  ctx.shadowBlur = 8

  for (const c of cylinders) {
    const [px, py] = w2c(c.x, c.y)
    const pr = c.r * SCALE

    if (c.label === 'Колесо') {
      // Wheel: dark with rim detail
      ctx.fillStyle = '#111'
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(px, py, pr * 0.72, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(px, py, pr * 0.18, 0, Math.PI * 2)
      ctx.fillStyle = '#444'; ctx.fill()
    } else if (c.label === 'Корпус') {
      ctx.fillStyle = '#1a1a2a'
      ctx.strokeStyle = '#2a3a5a'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
    } else if (c.label === 'Голова') {
      ctx.fillStyle = '#c8a080'
      ctx.strokeStyle = '#a08060'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
    } else if (c.label === 'Рука') {
      ctx.fillStyle = '#3a4a6a'
      ctx.strokeStyle = '#2a3a5a'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
    } else {
      // Body / limb colour based on part
      const isUpper = ['Торс', 'Плечо', 'Таз'].includes(c.label)
      ctx.fillStyle = isUpper ? '#3a4a70' : '#2a3a58'
      ctx.strokeStyle = '#4a5a88'
      ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
    }
  }
  ctx.shadowBlur = 0
}

// ---------------------------------------------------------------------------
// Draw force balance chart onto a canvas
// ---------------------------------------------------------------------------
function drawForceChart(ctx, CW, CH, CdA, massKg, motorOpts) {
  const PAD = { l: 52, r: 16, t: 28, b: 36 }
  const W = CW - PAD.l - PAD.r
  const H = CH - PAD.t - PAD.b
  const vMax = 36   // m/s axis limit (≈ 130 km/h)
  const fMax = 550  // N axis limit

  const vx = (v) => PAD.l + (v / vMax) * W
  const fy = (f) => PAD.t + H - (f / fMax) * H

  ctx.clearRect(0, 0, CW, CH)
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, CW, CH)

  // Grid
  ctx.strokeStyle = '#181818'; ctx.lineWidth = 1
  for (let v = 0; v <= vMax; v += 5) {
    ctx.beginPath(); ctx.moveTo(vx(v), PAD.t); ctx.lineTo(vx(v), PAD.t + H); ctx.stroke()
  }
  for (let f = 0; f <= fMax; f += 100) {
    ctx.beginPath(); ctx.moveTo(PAD.l, fy(f)); ctx.lineTo(PAD.l + W, fy(f)); ctx.stroke()
  }

  // Axis labels
  ctx.fillStyle = '#444'; ctx.font = '10px Inter, sans-serif'
  ctx.textAlign = 'center'
  for (let v = 0; v <= vMax; v += 10) {
    ctx.fillText(`${(v * 3.6).toFixed(0)}`, vx(v), PAD.t + H + 18)
  }
  ctx.textAlign = 'right'
  for (let f = 0; f <= fMax; f += 100) {
    ctx.fillText(f, PAD.l - 6, fy(f) + 4)
  }

  ctx.fillStyle = '#555'; ctx.font = '9px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Скорость (км/ч)', PAD.l + W / 2, CH - 4)
  ctx.save(); ctx.translate(14, PAD.t + H / 2); ctx.rotate(-Math.PI / 2)
  ctx.fillText('Сила (Н)', 0, 0); ctx.restore()

  // Build curves
  const N = 300
  const speeds = Array.from({ length: N }, (_, i) => (i / (N - 1)) * vMax)

  const drawCurve = (pts, color, dashed = false, lw = 2) => {
    ctx.strokeStyle = color; ctx.lineWidth = lw
    ctx.setLineDash(dashed ? [5, 4] : [])
    ctx.beginPath()
    for (let i = 0; i < pts.length; i++) {
      const [v, f] = pts[i]
      if (i === 0) ctx.moveTo(vx(v), fy(Math.max(0, Math.min(fMax, f))))
      else ctx.lineTo(vx(v), fy(Math.max(0, Math.min(fMax, f))))
    }
    ctx.stroke(); ctx.setLineDash([])
  }

  // Motor peak force
  drawCurve(speeds.map(v => [v, motorForce(v, motorOpts)]), '#ff4444', false, 2.2)
  // Motor continuous (assume 50% of peak power)
  drawCurve(speeds.map(v => [v, motorForce(v, { ...motorOpts, peakTorqueNm: motorOpts.peakTorqueNm * 0.55, peakPowerW: motorOpts.peakPowerW * 0.45 })]), '#ff7744', true, 1.5)
  // Total drag at current CdA
  drawCurve(speeds.map(v => [v, totalDrag(v, CdA, massKg)]), '#00ccff', false, 2.2)
  // Total drag upright reference (CdA 0.45)
  if (CdA < 0.43) {
    drawCurve(speeds.map(v => [v, totalDrag(v, 0.45, massKg)]), '#0066aa', true, 1.5)
  }

  // V_max intersections
  const vMaxPhys = physicsVmax(CdA, massKg, motorOpts.peakPowerW)
  ctx.strokeStyle = '#00ccff88'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4])
  ctx.beginPath(); ctx.moveTo(vx(vMaxPhys), PAD.t); ctx.lineTo(vx(vMaxPhys), PAD.t + H); ctx.stroke()
  ctx.setLineDash([])

  // Firmware speed limit reference (typical 60 km/h = 16.67 m/s)
  const vFW = 16.67
  ctx.strokeStyle = '#66666688'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 5])
  ctx.beginPath(); ctx.moveTo(vx(vFW), PAD.t); ctx.lineTo(vx(vFW), PAD.t + H); ctx.stroke()
  ctx.setLineDash([])

  // Legend
  const leg = [
    ['#ff4444', 'Мотор (пик)', false],
    ['#ff7744', 'Мотор (непр.)', true],
    ['#00ccff', `Сопр. CdA=${CdA.toFixed(2)}`, false],
    CdA < 0.43 ? ['#0066aa', 'Сопр. CdA=0.45 (прямо)', true] : null,
  ].filter(Boolean)
  ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'left'
  leg.forEach(([color, label, dashed], i) => {
    const lx = PAD.l + 8 + (i % 2) * (W / 2)
    const ly = PAD.t + 12 + Math.floor(i / 2) * 14
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.setLineDash(dashed ? [4, 3] : [])
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 18, ly); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = color; ctx.fillText(label, lx + 22, ly + 3)
  })

  // V_max annotation
  ctx.fillStyle = '#00ccff'; ctx.font = 'bold 10px Inter, sans-serif'; ctx.textAlign = 'left'
  const annX = vx(vMaxPhys) + 4
  ctx.fillText(`${(vMaxPhys * 3.6).toFixed(0)} км/ч`, annX, PAD.t + 14)
  ctx.fillStyle = '#555'; ctx.font = '9px Inter, sans-serif'
  ctx.fillText('(физика)', annX, PAD.t + 25)

  ctx.fillStyle = '#555'; ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'left'
  ctx.fillText('60', vx(vFW) + 4, PAD.t + H - 6)
  ctx.fillText('прошивка', vx(vFW) + 4, PAD.t + H + 0)
}

// ---------------------------------------------------------------------------
// Particle system
// ---------------------------------------------------------------------------
const NPART = 120
const WORLD_LEFT = -WX0
const WORLD_RIGHT = (CW / SCALE) - WX0
const WORLD_TOP = WY_TOP

function spawnParticle(y) {
  return {
    x: WORLD_LEFT + Math.random() * 0.4,
    y: y ?? Math.random() * WORLD_TOP,
    age: Math.random(),
    stale: false,
  }
}

function initParticles() {
  return Array.from({ length: NPART }, (_, i) =>
    spawnParticle((i / NPART) * WORLD_TOP)
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const Readout = ({ label, value, unit, color = '#00ccff', sub }) => (
  <div style={{ minWidth: 80 }}>
    <div style={{ fontSize: 9, color: '#444', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 26, fontWeight: 900, color, fontFamily: 'Inter, sans-serif', letterSpacing: -1 }}>{value}</span>
      <span style={{ fontSize: 11, color: '#444' }}>{unit}</span>
    </div>
    {sub && <div style={{ fontSize: 9, color: `${color}99`, marginTop: 2 }}>{sub}</div>}
  </div>
)

const SliderRow = ({ label, value, min, max, step, unit, onChange, color = '#00ccff' }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontSize: 10, color: '#555', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'Inter, sans-serif' }}>
        {typeof value === 'number' ? value.toFixed(step < 1 ? 1 : 0) : value}{unit}
      </span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onInput={e => onChange(+e.target.value)}
      style={{ width: '100%', accentColor: color }} />
  </div>
)

export const AeroSimulator = () => {
  const [leanDeg,      setLeanDeg]      = useState(0)
  const [crouchFactor, setCrouchFactor] = useState(0)
  const [massKg,       setMassKg]       = useState(115)

  const flowCanvasRef  = useRef(null)
  const chartCanvasRef = useRef(null)
  const particlesRef   = useRef(initParticles())
  const pressureRef    = useRef(null)   // pre-computed ImageData
  const cylindersRef   = useRef([])
  const animRef        = useRef(null)
  const lastTRef       = useRef(null)

  const motorOpts = { peakTorqueNm: 80, peakPowerW: 8000, wheelR: 0.254 }

  // Recompute pressure field + cylinders when posture changes
  useEffect(() => {
    const cyls = riderCylinders(leanDeg, crouchFactor)
    cylindersRef.current = cyls
    pressureRef.current = buildPressureImageData(cyls, 1.0)
  }, [leanDeg, crouchFactor])

  // Redraw force balance chart when CdA or mass changes
  useEffect(() => {
    const canvas = chartCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const CdA = estimateCdA(leanDeg, crouchFactor)
    drawForceChart(ctx, canvas.width, canvas.height, CdA, massKg, motorOpts)
  }, [leanDeg, crouchFactor, massKg])

  // Animation loop: draw flow + particles
  useEffect(() => {
    const canvas = flowCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const frame = (t) => {
      const dt = lastTRef.current ? Math.min((t - lastTRef.current) / 1000, 0.05) : 0.016
      lastTRef.current = t

      // Background
      ctx.fillStyle = '#080808'
      ctx.fillRect(0, 0, CW, CH)

      // Pressure field
      if (pressureRef.current) ctx.putImageData(pressureRef.current, 0, 0)

      // Ground
      const [, groundY] = w2c(0, 0)
      ctx.fillStyle = '#141414'
      ctx.fillRect(0, groundY, CW, CH - groundY)
      ctx.strokeStyle = '#252525'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(CW, groundY); ctx.stroke()

      // Rider body
      drawRiderBody(ctx, cylindersRef.current)

      // Particles
      const cyls = cylindersRef.current
      const U0 = 1.0
      const parts = particlesRef.current
      ctx.save()
      for (const p of parts) {
        const { u, v } = flowVelocity(p.x, p.y, cyls, U0)
        if (u === 0 && v === 0) {
          Object.assign(p, spawnParticle())
          continue
        }
        p.x += u * dt * 1.4
        p.y += v * dt * 1.4
        p.age += dt

        if (p.x > WORLD_RIGHT || p.y < 0 || p.y > WORLD_TOP || p.x < WORLD_LEFT - 0.2) {
          Object.assign(p, spawnParticle())
          continue
        }

        const speed = Math.sqrt(u * u + v * v)
        const t = Math.min(1, Math.max(0, (speed - 0.5) / 2.5))
        // Colour: slow = dim blue, fast = bright cyan/white
        const alpha = 0.3 + t * 0.55
        ctx.fillStyle = `rgba(${Math.round(40 + t * 200)},${Math.round(150 + t * 100)},${Math.round(220)},${alpha.toFixed(2)})`
        const [px, py] = w2c(p.x, p.y)
        ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()

      // Labels
      ctx.fillStyle = '#333'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'left'
      ctx.fillText('← ветер', 8, 20)
      ctx.fillStyle = '#1a4a6a'; ctx.textAlign = 'right'
      ctx.fillText('низкое давление ↗', CW - 8, 20)
      ctx.fillStyle = '#1a3a6a'; ctx.textAlign = 'left'
      ctx.fillText('↙ высокое давление', 8, CH - 10)

      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const CdA    = estimateCdA(leanDeg, crouchFactor)
  const vMax   = physicsVmax(CdA, massKg, motorOpts.peakPowerW)
  const aMax   = leanAccel(Math.min(leanDeg, 25))
  const fAero60 = aeroDrag(16.67, CdA)
  const fRoll  = rollingResist(massKg)

  return (
    <div style={{ background: '#080808', color: '#ccc', padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        .aero-panel { background: #0e0e0e; border: 1px solid #1c1c1c; border-radius: 12px; padding: 18px; }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* ---- LEFT: CFD Canvas ---- */}
        <div>
          <div class="aero-panel" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#444', letterSpacing: 2, marginBottom: 10 }}>
              ВИЗУАЛИЗАЦИЯ ПОТОКА · 2D ПОТЕНЦИАЛЬНОЕ ТЕЧЕНИЕ · ВИД СБОКУ
            </div>
            <canvas ref={flowCanvasRef} width={CW} height={CH}
              style={{ display: 'block', borderRadius: 8, border: '1px solid #161616', width: '100%' }} />
            <div style={{ marginTop: 8, fontSize: 10, color: '#333', lineHeight: 1.7 }}>
              <span style={{ color: '#1a4a9a' }}>■</span> Высокое давление (торможение потока) &nbsp;
              <span style={{ color: '#9a2a1a' }}>■</span> Низкое давление (ускорение потока) &nbsp;
              <span style={{ color: '#1a4a5a' }}>•</span> Линии тока
            </div>
          </div>

          {/* Force balance chart */}
          <div class="aero-panel">
            <div style={{ fontSize: 10, color: '#444', letterSpacing: 2, marginBottom: 10 }}>
              БАЛАНС СИЛ · МОТОР vs АЭРОСОПРОТИВЛЕНИЕ
            </div>
            <canvas ref={chartCanvasRef} width={620} height={220}
              style={{ display: 'block', width: '100%', borderRadius: 6 }} />
          </div>
        </div>

        {/* ---- RIGHT: Controls + Readouts ---- */}
        <aside>
          {/* Key metrics */}
          <div class="aero-panel" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#444', letterSpacing: 2, marginBottom: 14 }}>ПАРАМЕТРЫ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 4 }}>
              <Readout label="CdA" value={CdA.toFixed(3)} unit="м²" color="#00ccff"
                sub={`${((CdA / 0.45) * 100).toFixed(0)}% от вертикали`} />
              <Readout label="V_max физика" value={(vMax * 3.6).toFixed(0)} unit="км/ч" color="#33ff99"
                sub="без ограничений прошивки" />
              <Readout label="a_max" value={(aMax / 9.81).toFixed(2)} unit="g" color="#ffcc00"
                sub={`при наклоне ${Math.min(leanDeg, 25).toFixed(0)}°`} />
              <Readout label="F_аэро@60" value={fAero60.toFixed(0)} unit="Н" color="#ff6644"
                sub={`+${fRoll.toFixed(0)} Н качение`} />
            </div>
          </div>

          {/* Controls */}
          <div class="aero-panel" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#444', letterSpacing: 2, marginBottom: 14 }}>ПОЗА ВСАДНИКА</div>
            <SliderRow label="Наклон вперёд" value={leanDeg} min={0} max={28} step={1}
              unit="°" onChange={setLeanDeg} color="#00ccff" />
            <SliderRow label="Пригнуться" value={crouchFactor * 100} min={0} max={100} step={1}
              unit="%" onChange={v => setCrouchFactor(v / 100)} color="#33ff99" />
            <SliderRow label="Масса система" value={massKg} min={80} max={160} step={5}
              unit=" кг" onChange={setMassKg} color="#ffcc00" />
          </div>

          {/* Insight box */}
          <div class="aero-panel" style={{ fontSize: 11, lineHeight: 1.7, color: '#666' }}>
            <div style={{ fontSize: 10, color: '#444', letterSpacing: 2, marginBottom: 10 }}>ФИЗИКА</div>
            <p style={{ marginBottom: 8 }}>
              <span style={{ color: '#00ccff' }}>Наклон</span> переносит центр масс вперёд —
              tan(θ)×g задаёт горизонтальное ускорение. При 25° это <strong style={{ color: '#ffcc00' }}>{(leanAccel(25) / 9.81).toFixed(2)}g</strong>.
            </p>
            <p style={{ marginBottom: 8 }}>
              <span style={{ color: '#33ff99' }}>Пригнуться</span> сжимает фронтальное сечение
              и снижает CdA. Разница 0.45→0.28 м² даёт +{(
                (physicsVmax(0.28, massKg, 8000) - physicsVmax(0.45, massKg, 8000)) * 3.6
              ).toFixed(0)} км/ч на физическом пределе.
            </p>
            <p style={{ color: '#444' }}>
              ⚠ Прошивка ограничивает скорость через tilt-back задолго до
              физического предела. График показывает механику без ограничений
              прошивки.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default AeroSimulator
