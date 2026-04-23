import { h } from 'preact'
import { useState, useRef, useEffect } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

const DQSim = () => {
  const canvasRef = useRef(null)
  const [speedKmh, setSpeedKmh] = useState(30)
  const [torqueRef, setTorqueRef] = useState(70)
  const [fwEnabled, setFwEnabled] = useState(true)
  const speedRef = useRef(30), trqRef = useRef(70), fwRef = useRef(true)

  useEffect(() => { speedRef.current = speedKmh }, [speedKmh])
  useEffect(() => { trqRef.current = torqueRef }, [torqueRef])
  useEffect(() => { fwRef.current = fwEnabled }, [fwEnabled])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    const draw = () => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Motor parameters (normalized for visualization)
      const V_bus = 168      // V
      const R_s = 0.045      // Ohm
      const L = 0.0002       // H
      const Psi = 0.025      // flux linkage
      const pole_pairs = 12
      const wheel_r = 0.254

      const speed_kmh = speedRef.current
      const omega_mech = (speed_kmh / 3.6) / wheel_r
      const omega_elec = omega_mech * pole_pairs  // rad/s electrical

      // Normalized max current
      const I_max = 400       // A (phase peak)
      // Voltage limit: |V| <= V_bus/sqrt(3) (for SVPWM)
      const V_max = V_bus / Math.sqrt(3)

      // In DQ: Vd ≈ -ω·L·Iq, Vq ≈ R·Iq + ω·L·Id + ω·Ψ
      // At max speed without FW: Vq max is limited by V_max
      // Voltage circle: (R·Id - ω·L·Iq)² + (R·Iq + ω·L·Id + ω·Ψ)² <= V_max²
      // At higher ω, the center of the voltage-feasible set shifts in -Id direction

      const cx = W * 0.5, cy = H * 0.55
      const scale = Math.min(W, H * 2) * 0.22  // pixels per amp (scaled)

      // Draw axes
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx - 200, cy); ctx.lineTo(cx + 200, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy - 180); ctx.lineTo(cx, cy + 180); ctx.stroke()
      ctx.fillStyle = '#888'; ctx.font = '11px Inter'
      ctx.fillText('Id (flux)', cx + 150, cy - 6)
      ctx.fillText('Iq (torque)', cx + 6, cy - 160)
      ctx.fillText('−Id →', cx - 180, cy + 18)

      // Current limit circle (constant I_max)
      ctx.strokeStyle = '#ff3366'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.arc(cx, cy, I_max * scale / 100, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#ff336688'
      ctx.fillText('I_max', cx + I_max * scale / 100 + 4, cy - 4)

      // Voltage limit locus: ellipse centered at (-Psi/L, 0) in DQ
      // Radius scales with V_max / (ω·L)  — shrinks with speed
      const v_radius = omega_elec > 1 ? V_max / (omega_elec * L) : 9999
      const v_center_id = -Psi / L   // center shifts into -Id
      const vr_px = v_radius * scale / 100

      // Voltage circle in DQ plane
      ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(cx + v_center_id * scale / 100, cy, vr_px, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = '#00ccff88'
      ctx.fillText(`|V| = V_max/ω·L`, cx + v_center_id * scale / 100 - 40, cy - vr_px - 4)

      // Operating point
      const iq_requested = (trqRef.current / 100) * I_max
      let id = 0, iq = iq_requested

      if (fwRef.current && omega_elec > 1) {
        // Project into voltage circle from current target
        // Find closest feasible point on/inside voltage circle
        const dq_dist = Math.sqrt(Math.pow(0 - v_center_id, 2) + Math.pow(iq, 2))
        if (dq_dist > v_radius) {
          // Need field weakening: move Id toward center of voltage circle
          // Project (0, iq) along -Id direction until |(id-center, iq)| == v_radius
          // (id - center)² + iq² = r²
          // id = center - sqrt(r² - iq²) if r² > iq²
          if (v_radius * v_radius > iq * iq) {
            id = v_center_id + Math.sqrt(v_radius * v_radius - iq * iq)
            if (id > 0) id = 0
          } else {
            iq = v_radius * Math.sign(iq_requested)
            id = v_center_id
          }
        }
      } else if (!fwRef.current && omega_elec > 1) {
        // Without FW: just limit Vq
        const v_needed = omega_elec * Psi + omega_elec * L * iq * 0 + 0.045 * iq
        if (Math.abs(v_needed) > V_max) {
          iq = iq * V_max / Math.abs(v_needed)
        }
      }

      // Also limit by I_max circle
      const imag = Math.sqrt(id * id + iq * iq)
      if (imag > I_max) {
        id = id * I_max / imag
        iq = iq * I_max / imag
      }

      // Draw requested (target) point
      const tx = cx + 0 * scale / 100
      const ty = cy - iq_requested * scale / 100
      ctx.fillStyle = '#ffcc0044'
      ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI * 2); ctx.stroke()

      // Draw actual operating point
      const ox = cx + id * scale / 100
      const oy = cy - iq * scale / 100
      ctx.fillStyle = '#33ff99'
      ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 15; ctx.shadowColor = '#33ff99'
      ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0

      // Arrow from target to actual
      if (Math.abs(id) > 2) {
        ctx.strokeStyle = '#ff9933aa'; ctx.lineWidth = 1; ctx.setLineDash([2, 2])
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(ox, oy); ctx.stroke()
        ctx.setLineDash([])
      }

      // Labels
      ctx.fillStyle = '#ffcc00'; ctx.font = '10px Inter'
      ctx.fillText(`Запрос (Id=0, Iq=${iq_requested.toFixed(0)})`, 12, 20)
      ctx.fillStyle = '#33ff99'
      ctx.fillText(`Реально: Id=${id.toFixed(0)}, Iq=${iq.toFixed(0)}`, 12, 36)
      ctx.fillStyle = '#aaa'
      ctx.fillText(`ω_elec = ${omega_elec.toFixed(0)} rad/s`, 12, 52)

      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div>
      <canvas ref={canvasRef} width={760} height={360}
        style={{ width: '100%', height: '360px', background: '#080808', borderRadius: '10px', display: 'block' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '16px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#555' }}>Скорость</label>
            <span style={{ fontSize: '11px', color: '#00ccff', fontWeight: '700' }}>{speedKmh} км/ч</span>
          </div>
          <input type="range" min="0" max="90" step="1" value={speedKmh} onChange={e => setSpeedKmh(+e.target.value)}
            style={{ width: '100%', accentColor: '#00ccff' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#555' }}>Запрос момента</label>
            <span style={{ fontSize: '11px', color: '#ffcc00', fontWeight: '700' }}>{torqueRef}%</span>
          </div>
          <input type="range" min="0" max="100" step="1" value={torqueRef} onChange={e => setTorqueRef(+e.target.value)}
            style={{ width: '100%', accentColor: '#ffcc00' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={() => setFwEnabled(!fwEnabled)}
            style={{ width: '100%', padding: '10px', background: fwEnabled ? '#33ff9922' : '#ff333322',
              border: `1px solid ${fwEnabled ? '#33ff9955' : '#ff333355'}`, borderRadius: '8px',
              color: fwEnabled ? '#33ff99' : '#ff6666', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
            {fwEnabled ? 'FW включено' : 'FW выключено'}
          </button>
        </div>
      </div>
      <div style={{ marginTop: '16px', fontSize: '11px', color: '#444', lineHeight: 1.6 }}>
        Жёлтая точка — запрос от балансового регулятора (Id=0, Iq=запрос).
        Зелёная точка — реальная рабочая точка, скорректированная с учётом пределов напряжения и тока.
        Красный круг — ограничение по току (|I|&lt;I_max). Синий круг — допустимая область по напряжению |V|&lt;V_max, сужается с ростом скорости.
      </div>
    </div>
  )
}

export default function FieldWeakeningChapter() {
  return (
    <ChapterLayout eyebrow="Глава X" title="Ослабление" subtitle="Field weakening — как колесо едет выше базовой скорости">
      <Section>
        <Prose>
          У мотора ET Max параметры: Kv = 14.5 RPM/V, 12 пар полюсов, радиус колеса 0.254 м. На номинальном напряжении 168 В без нагрузки он должен крутиться со скоростью 168 · 14.5 = 2436 RPM, что на колесе даёт ~38 км/ч. Это так называемая «базовая скорость» — выше неё простой FOC ехать не сможет, потому что back-EMF уравняется с напряжением батареи.
        </Prose>
        <Prose>
          Однако ET Max уверенно едет 60-80 км/ч. Как? Через ослабление поля: подачей отрицательного тока по оси D, который создаёт магнитный поток против поля постоянных магнитов, частично гася его. Уменьшение эффективного магнитного потока снижает back-EMF, и мотор может крутиться быстрее.
        </Prose>
      </Section>

      <InteractivePanel title="D-Q плоскость · геометрия ограничений">
        <DQSim />
      </InteractivePanel>

      <Section title="Геометрическая интерпретация">
        <Prose>
          Всё управление FOC можно изобразить точкой на плоскости (Id, Iq). На этой плоскости действуют два жёстких ограничения:
        </Prose>
        <Prose>
          <strong style={{ color: '#ff3366' }}>Круг тока</strong>: |I| ≤ I_max. Фазный ток не может превышать паспортный лимит — иначе MOSFET или обмотка сгорят. Круг не меняется со скоростью.
        </Prose>
        <Prose>
          <strong style={{ color: '#00ccff' }}>Круг напряжения</strong>: |V| ≤ V_bus/√3 (для SVPWM). В DQ-координатах выражается через токи: центр круга смещён в отрицательную часть оси D на величину −Ψ/L, а радиус равен V_max/(ω·L). При увеличении скорости радиус уменьшается — круг напряжения сжимается, и в какой-то момент он перестаёт включать точку (0, Iq_max).
        </Prose>
        <Prose>
          Если запрошенная точка вышла за пределы обоих кругов — нужно сдвинуть её к ближайшей допустимой. Для максимального момента при данной скорости используется стратегия MTPA (Maximum Torque Per Ampere) ниже базовой скорости и MTPV (Maximum Torque Per Volt) выше базовой.
        </Prose>
      </Section>

      <Section title="Реализация в прошивке">
        <CodeBlock
          label="foc.c · Field Weakening controller (0x08013974)"
          address="0x08013974"
          code={`// Упрощённая стратегия: сравнить требуемое |V| с доступным |V_max|
// и подать отрицательный Id когда не хватает запаса

void Field_Weakening_Update(void) {
    // Текущий модуль напряжения на выходе PI контуров
    int16_t vd = motor_state->V_D_Output;
    int16_t vq = motor_state->V_Q_Output;
    int32_t v_mag_sq = vd * vd + vq * vq;

    // Максимально допустимый модуль (квадрат, чтобы избежать sqrt)
    int32_t v_max = (int32_t)(motor_state->v_bus * V_MAX_RATIO);
    int32_t v_max_sq = v_max * v_max;

    int32_t headroom_sq = v_max_sq - v_mag_sq;

    if (headroom_sq < V_FW_THRESHOLD) {
        // Недостаточно запаса — увеличиваем ослабление
        motor_state->Field_Weakening_Filter += FW_STEP;
    } else {
        // Запас есть — плавно уменьшаем ослабление
        motor_state->Field_Weakening_Filter -= FW_RELAX_STEP;
        if (motor_state->Field_Weakening_Filter < 0)
            motor_state->Field_Weakening_Filter = 0;
    }

    // Slew-rate limit, чтобы не было рывков
    motor_state->Field_Weakening_Target = Math_Slew_Rate_Limiter(
        motor_state->Field_Weakening_Filter, 300);

    // Target для PI_D регулятора: отрицательный!
    motor_state->id_target = -(int16_t)(
        motor_state->Field_Weakening_Target * 23.0f);
}`}
        />
        <Callout color="#ff9933" label="Почему slew-rate limiter">
          Ослабление поля нельзя включать и выключать мгновенно. Резкое изменение Id → резкое изменение крутящего момента → ступенчатое возмущение для балансового контура → райдер чувствует «клевок». Slew-rate limiter ограничивает скорость изменения до ~300 единиц в секунду (в нормированных единицах прошивки). На слайдере это выглядит как плавный вход в FW при превышении базовой скорости.
        </Callout>
      </Section>

      <Section title="Цена скорости">
        <Prose>
          Field weakening — это не «бесплатная» скорость. Отрицательный Id протекает через обмотки и создаёт I²R потери без какой-либо полезной работы. На 80 км/ч с Id = −200 А и Rs = 45 мОм это ~5.4 кВт тепла в обмотках, дополнительно к рабочим потерям. Поэтому максимальная скорость на моноколесе — это время до перегрева мотора, а не физический предел электромагнитной системы.
        </Prose>
        <Prose>
          Практика: штатный режим Hard позволяет 60 км/ч, но удерживать эту скорость больше 3-5 минут опасно — температура мотора уйдёт за 75°C и включится температурный tiltback.
        </Prose>
      </Section>
    </ChapterLayout>
  )
}
