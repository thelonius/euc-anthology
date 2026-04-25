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

      // Pedagogical per-unit model. Numbers are normalised to I_max for clarity.
      // Real ET Max parameters give a similar geometry but with cluttered scaling.
      const speed_kmh = speedRef.current
      const speed_norm = Math.min(1, speed_kmh / 90)   // 0..1 over 0..90 km/h

      // Center of voltage circle in (Id, Iq) plane, units of I_max:
      // shifts into −Id direction by Ψ/(L·I_max). Fixed value for visual clarity.
      const v_center_x = -0.40
      // Voltage circle radius (in I_max units): shrinks linearly with speed.
      // At 0 km/h huge → no constraint; at 90 km/h ~0.55 → constrains everything.
      const v_radius = 1.6 - speed_norm * 1.05

      // Geometry of canvas
      const cx = W * 0.5, cy = H * 0.55
      const PU = Math.min(W, H) * 0.32   // pixels per unit (1 pu = I_max)

      const toPx = (x, y) => [cx + x * PU, cy - y * PU]

      // Axes
      ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(40, cy); ctx.lineTo(W - 40, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, 30); ctx.lineTo(cx, H - 50); ctx.stroke()

      // Grid at 0.25 pu intervals
      ctx.strokeStyle = '#141414'
      for (const v of [0.25, 0.5, 0.75, 1.0, 1.25]) {
        ctx.beginPath(); ctx.arc(cx, cy, v * PU, 0, Math.PI * 2); ctx.stroke()
      }

      // Axis labels
      ctx.fillStyle = '#999'; ctx.font = '11px Inter, sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('Id (поле)', cx + 8, 28)
      ctx.fillText('+Id →', W - 80, cy - 8)
      ctx.fillText('Iq (момент)', cx + 8, 28 + 14); ctx.fillStyle = '#666'
      ctx.fillText('← −Id (FW)', 40, cy - 8)

      // Tick marks (0.5, 1.0)
      ctx.fillStyle = '#444'; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'center'
      for (const t of [-1, -0.5, 0.5, 1]) {
        ctx.fillText(`${t}`, cx + t * PU, cy + 14)
        ctx.fillText(`${t}`, cx - 14, cy - t * PU)
      }
      ctx.fillStyle = '#555'; ctx.fillText('I_max', cx - 30, cy - 1.1 * PU)

      // ─── Current limit circle (radius = 1.0 pu = I_max) ───
      ctx.strokeStyle = '#ff3366aa'; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4])
      ctx.beginPath(); ctx.arc(cx, cy, PU, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#ff3366'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'left'
      ctx.fillText('|I| ≤ I_max', cx + PU * 0.71 + 6, cy - PU * 0.71 - 6)

      // ─── Voltage limit circle ───
      const [vcx_px, vcy_px] = toPx(v_center_x, 0)
      ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 1.8
      ctx.beginPath(); ctx.arc(vcx_px, vcy_px, v_radius * PU, 0, Math.PI * 2); ctx.stroke()
      // Light fill
      ctx.fillStyle = '#00ccff10'
      ctx.beginPath(); ctx.arc(vcx_px, vcy_px, v_radius * PU, 0, Math.PI * 2); ctx.fill()
      // Center marker
      ctx.fillStyle = '#00ccff'; ctx.beginPath(); ctx.arc(vcx_px, vcy_px, 2, 0, Math.PI * 2); ctx.fill()
      ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(`|V| ≤ V_max  (r = ${v_radius.toFixed(2)})`,
        vcx_px, vcy_px - v_radius * PU - 8)
      // Center label
      ctx.fillStyle = '#00ccff88'; ctx.font = '9px Inter, sans-serif'
      ctx.fillText('центр: −Ψ/L', vcx_px, vcy_px + 14)

      // ─── Determine operating point ───
      const iq_target = (trqRef.current / 100)   // pu of I_max
      let id_actual = 0, iq_actual = iq_target

      // Distance from voltage-circle centre to (0, iq_target)
      const dq_dist = Math.sqrt(v_center_x * v_center_x + iq_target * iq_target)
      const fw_active = fwRef.current && dq_dist > v_radius

      if (fw_active) {
        // Move along Id direction until inside V-circle. Solve:
        // (id - v_center_x)² + iq² = v_radius²  →  id = v_center_x − √(v_radius² − iq²)
        if (v_radius * v_radius > iq_target * iq_target) {
          id_actual = v_center_x + Math.sqrt(v_radius * v_radius - iq_target * iq_target)
          // If solution would be > 0 (right of origin), keep at 0 (no FW needed)
          if (id_actual > 0) id_actual = 0
        } else {
          // Voltage circle even smaller than iq target — clamp Iq
          iq_actual = v_radius * Math.sign(iq_target)
          id_actual = v_center_x
        }
      } else if (!fwRef.current && dq_dist > v_radius) {
        // FW disabled but V-limit still bites → just clamp Iq down
        iq_actual = Math.min(iq_target, v_radius)   // simplified
      }

      // Clamp to current circle
      const imag = Math.sqrt(id_actual * id_actual + iq_actual * iq_actual)
      if (imag > 1) { id_actual /= imag; iq_actual /= imag }

      // ─── Target point (yellow ring) ───
      const [tx_px, ty_px] = toPx(0, iq_target)
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(tx_px, ty_px, 9, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = '#ffcc0033'
      ctx.beginPath(); ctx.arc(tx_px, ty_px, 9, 0, Math.PI * 2); ctx.fill()

      // Arrow target → actual
      const [ox_px, oy_px] = toPx(id_actual, iq_actual)
      if (Math.hypot(ox_px - tx_px, oy_px - ty_px) > 6) {
        ctx.strokeStyle = '#ff9933aa'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
        ctx.beginPath(); ctx.moveTo(tx_px, ty_px); ctx.lineTo(ox_px, oy_px); ctx.stroke()
        ctx.setLineDash([])
      }

      // Actual operating point (green, glowing)
      ctx.shadowBlur = 12; ctx.shadowColor = '#33ff99'
      ctx.fillStyle = '#33ff99'
      ctx.beginPath(); ctx.arc(ox_px, oy_px, 6, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0

      // ─── Status box (top left) ───
      const id_amps = id_actual * 380, iq_amps = iq_actual * 380
      const lines = [
        ['ЗАПРОС', `Id = 0  ·  Iq = ${(iq_target * 380).toFixed(0)} A`, '#ffcc00'],
        ['РЕАЛЬНО', `Id = ${id_amps.toFixed(0)} A · Iq = ${iq_amps.toFixed(0)} A`, '#33ff99'],
        ['СКОРОСТЬ', `${speed_kmh} км/ч  (${(speed_norm * 100).toFixed(0)}% макс.)`, '#aaa'],
        [fw_active ? 'FW АКТИВНО' : (fwRef.current ? 'FW ОЖИДАЕТ' : 'FW ВЫКЛ'),
          fw_active ? 'отрицательный Id ослабляет поле' :
          (fwRef.current ? 'V-предел не достигнут' : 'векторный предел игнорируется'),
          fw_active ? '#ff9933' : '#666'],
      ]
      lines.forEach(([label, value, color], i) => {
        ctx.fillStyle = color; ctx.font = 'bold 9px Inter, sans-serif'; ctx.textAlign = 'left'
        ctx.fillText(label, 14, 20 + i * 20)
        ctx.fillStyle = '#888'; ctx.font = '11px JetBrains Mono, monospace'
        ctx.fillText(value, 80, 20 + i * 20)
      })

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
