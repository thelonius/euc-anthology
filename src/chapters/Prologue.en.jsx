import { h } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { ChapterLayout, Prose, Callout, Section } from '../components/ChapterLayout'
import { wrapTerms } from '../glossary/wrapTerms'

const PendulumCanvas = () => {
  const canvasRef = useRef(null)
  const stateRef = useRef({ angle: 0.3, vel: 0, t: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId
    let lastT = performance.now()

    const draw = (now) => {
      const dt = Math.min((now - lastT) / 1000, 0.05)
      lastT = now
      const s = stateRef.current
      s.t += dt

      const g = 9.81, L = 1.0
      const Kp = 28, Kd = 5
      const torque = -(Kp * s.angle + Kd * s.vel)
      const acc = (g / L) * Math.sin(s.angle) + torque
      s.vel += acc * dt
      s.vel *= 0.999
      s.angle += s.vel * dt

      if (Math.floor(s.t * 0.3) % 2 === 0 && Math.abs(s.angle) < 0.05) {
        s.vel += (Math.random() - 0.5) * 0.8
      }

      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const cx = W / 2, cy = H * 0.72
      const r = 38
      const len = 140

      ctx.strokeStyle = '#1e1e1e'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx - 120, cy + r); ctx.lineTo(cx + 120, cy + r); ctx.stroke()

      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 15)
      gr.addColorStop(0, '#00ccff18')
      gr.addColorStop(1, 'transparent')
      ctx.fillStyle = gr
      ctx.beginPath(); ctx.arc(cx, cy, r + 15, 0, Math.PI * 2); ctx.fill()

      ctx.strokeStyle = '#00ccff'
      ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = '#1a3a4a'
      ctx.lineWidth = 1
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke()
      }

      const tx = cx + Math.sin(s.angle) * len
      const ty = cy - Math.cos(s.angle) * len

      ctx.strokeStyle = '#ffffff18'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 6])
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - len - 20); ctx.stroke()
      ctx.setLineDash([])

      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); ctx.stroke()

      const headR = 14
      ctx.fillStyle = '#e0e0e0'
      ctx.beginPath(); ctx.arc(tx, ty - headR, headR, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1a1a1a'
      ctx.beginPath(); ctx.arc(tx, ty - headR, headR - 3, 0, Math.PI * 2); ctx.fill()

      const deg = (s.angle * 180 / Math.PI).toFixed(1)
      const color = Math.abs(s.angle) < 0.08 ? '#33ff99' : Math.abs(s.angle) < 0.2 ? '#ffcc00' : '#ff3366'
      ctx.fillStyle = color
      ctx.font = '700 13px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${deg}°`, cx, cy + r + 22)

      if (Math.abs(s.angle) > 0.02) {
        const arrowDir = -Math.sign(s.angle)
        ctx.strokeStyle = '#ff336688'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx + arrowDir * (r + 10), cy - 10)
        ctx.lineTo(cx + arrowDir * (r + 30), cy - 10)
        ctx.stroke()
        ctx.fillStyle = '#ff3366'
        ctx.beginPath()
        ctx.moveTo(cx + arrowDir * (r + 35), cy - 10)
        ctx.lineTo(cx + arrowDir * (r + 25), cy - 15)
        ctx.lineTo(cx + arrowDir * (r + 25), cy - 5)
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }
    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas ref={canvasRef} width={320} height={280}
      style={{ width: '100%', maxWidth: '320px', display: 'block', margin: '0 auto' }} />
  )
}

export default function Prologue() {
  return (
    <ChapterLayout eyebrow="Prologue" title="The Fall" subtitle="Why the wheel rides">
      <div style={{
        borderLeft: '2px solid #2a2a2a',
        padding: '6px 0 6px 20px',
        margin: '0 0 40px 2px',
        maxWidth: '560px',
      }}>
        <div style={{ fontSize: '16px', color: '#aaa', fontStyle: 'italic', lineHeight: 1.6, marginBottom: '8px' }}>
          “Spirit turns its grief, the way feet turn the pedals.”
        </div>
        <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.5px' }}>
          Victor Pelevin, <em>A Sinistra</em> (2025)
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '48px', alignItems: 'start', marginBottom: '48px' }}>
        <div>
          <Prose>
            An electric unicycle is a questionable contraption from the standpoint of classical mechanics. One contact patch, no handlebar, no pedals in the ordinary sense. By rights it should fall over. People ride it anyway.
          </Prose>
          <Prose>
            Here is how it works. Inside the case sits an ARM processor (STM32F405) wired by SPI to an IMU running at 1 MHz. Twenty thousand times a second the processor reads the lean angle from the IMU and decides how much current to push into each of the three motor windings. Lean forward and the torque points forward, the wheel rolls under the rider. Lean back and the torque points back: braking on the move, or rolling backwards from a standstill.
          </Prose>
          <Prose>
            The interesting part is small: the entire "balance magic" amounts to a few kilobytes of C, the gcc-arm compiler, and a pair of coefficients Kp and Kd in SRAM at address 0x200000CC. Nothing else.
          </Prose>
        </div>
        <div style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: '16px', padding: '24px' }}>
          <div style={{ fontSize: '9px', color: '#333', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px', textAlign: 'center' }}>Controlled fall</div>
          <PendulumCanvas />
        </div>
      </div>

      <Callout color="#00ccff" label="Mechanics">
        Strictly speaking, the wheel does not balance in the sense of "holding position." It is always falling a little in the direction the rider leans, and the motor rolls the contact patch right under the falling center of mass. The firmware runs this loop at 20 kHz.
      </Callout>

      <Section title="What this anthology is">
        <Prose>
          A walkthrough of the Begode ET Max firmware (168 V, STM32F405), pulled apart in Ghidra and finished by hand in Thumb2. Each chapter takes a single functional block: IMU, balance, FOC, telemetry. For each block you get the firmware address, an annotated decompilation, and where it helps, an interactive Canvas simulation.
        </Prose>
        <Prose>
          The aim is that after reading, a person can take their own ET Max, open its firmware in IDA Pro or Ghidra, and recognize the functions discussed here. Everything else is practice.
        </Prose>
      </Section>

      <Section title="The journey">
        {[
          ['I · Hardware',          'STM32F405, TIM1+TIM8, ADC, SPI — anatomy of the controller', 'Part I · The Body'],
          ['II · Senses',           'MPU6500, accelerometer, gyroscope, complementary filter'],
          ['III · Awakening',       'What happens in the first two seconds after POR'],
          ['IV · States',           'Lifecycle state machine: POR → IDLE → RUNNING → FAULT', 'Part II · Architecture'],
          ['V · The Loop',          'Cycle-by-cycle timing of the 50-µs FOC ISR'],
          ['VI · The Map',          'The motor_state RAM struct, data flow between functions'],
          ['VII · Balance',         'Balance PD controller, Kp/Kd, building iq_target', 'Part III · Control'],
          ['VIII · The Flux',       'Field-Oriented Control, the Clarke and Park transforms'],
          ['IX · The Observer',     'Flux Observer, leaving the Hall sensors behind as speed rises'],
          ['X · Weakening',         'Field weakening, the limit geometry in the D-Q plane'],
          ['XI · Heat',             'Thermal model of the windings, tiltback thresholds', 'Part IV · Limits'],
          ['XII · The Voice',       'BLE telemetry, the 0x55AA protocol, the alarm system'],
          ['XIII · The Craft',      'SWD, ST-Link, dumping firmware and the reverse-engineering toolkit', 'Part V · Practice'],
        ].map(([title, desc, part]) => (
          <div key={title}>
            {part && <div style={{ fontSize: '9px', color: '#333', letterSpacing: '3px', marginTop: '18px', marginBottom: '6px', textTransform: 'uppercase' }}>{part}</div>}
            <div style={{ display: 'flex', gap: '20px', padding: '10px 0', borderBottom: '1px solid #141414', alignItems: 'baseline' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#bbb', minWidth: '150px' }}>{title}</div>
              <div style={{ fontSize: '13px', color: '#555' }}>{wrapTerms(desc)}</div>
            </div>
          </div>
        ))}
      </Section>
    </ChapterLayout>
  )
}
