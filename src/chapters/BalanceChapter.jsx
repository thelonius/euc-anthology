import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

const BalanceSim = () => {
  const canvasRef = useRef(null)
  const [kp, setKp] = useState(280)
  const [kd, setKd] = useState(22)
  const [running, setRunning] = useState(true)
  const stateRef = useRef({ angle: 0.25, vel: 0, iqHistory: [], angleHistory: [], t: 0 })
  const paramsRef = useRef({ kp: 280, kd: 22 })

  useEffect(() => { paramsRef.current = { kp, kd } }, [kp, kd])

  const disturb = () => { stateRef.current.vel += 2.5 }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId, lastT = performance.now(), fc = 0

    const loop = (now) => {
      if (!running) { animId = requestAnimationFrame(loop); return }
      const dt = Math.min((now - lastT) / 1000, 0.04)
      lastT = now
      const s = stateRef.current
      const { kp, kd } = paramsRef.current

      // Substeps
      const SS = 20
      for (let i = 0; i < SS; i++) {
        const ddt = dt / SS
        const g = 9.81, L = 0.9
        // PD controller: iq = -(Kp*angle + Kd*vel) (normalized to [-1,1] range)
        const iq_norm = -Math.max(-1, Math.min(1, (kp * s.angle + kd * s.vel) / 400))
        // Pendulum physics (motor torque counters gravity)
        const gravity_torque = (g / L) * Math.sin(s.angle)
        const motor_torque = iq_norm * 25  // motor authority
        s.vel += (gravity_torque + motor_torque) * ddt
        s.angle += s.vel * ddt
        s.t += ddt
        // Fall detection: if > 60 deg, reset
        if (Math.abs(s.angle) > 1.05) {
          s.angle = 0.25; s.vel = 0
        }
      }

      const iq_norm = Math.max(-1, Math.min(1, -(kp * s.angle + kd * s.vel) / 400))
      s.angleHistory.push(s.angle * 180 / Math.PI)
      s.iqHistory.push(iq_norm * 100)
      if (s.angleHistory.length > 250) { s.angleHistory.shift(); s.iqHistory.shift() }

      if (fc % 2 === 0) {
        const W = canvas.width, H = canvas.height
        ctx.clearRect(0, 0, W, H)

        // --- Left panel: pendulum ---
        const cx = W * 0.27, cy = H * 0.72, wheelR = 32, poleLen = 120

        // ground line
        ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(cx - 100, cy + wheelR); ctx.lineTo(cx + 100, cy + wheelR); ctx.stroke()

        // wheel glow
        const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, wheelR + 10)
        const iqColor = iq_norm > 0 ? `${Math.round(iq_norm * 255).toString(16).padStart(2,'0')}` : '00'
        const iqColorNeg = iq_norm < 0 ? `${Math.round(-iq_norm * 200).toString(16).padStart(2,'0')}` : '00'
        gr.addColorStop(0, `#${iqColorNeg}${iqColor}ff18`)
        gr.addColorStop(1, 'transparent')
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, wheelR + 10, 0, Math.PI * 2); ctx.fill()

        // wheel
        const wheelColor = Math.abs(iq_norm) > 0.7 ? '#ff3366' : Math.abs(iq_norm) > 0.3 ? '#ffcc00' : '#00ccff'
        ctx.strokeStyle = wheelColor; ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.arc(cx, cy, wheelR, 0, Math.PI * 2); ctx.stroke()

        // pole
        const tx = cx + Math.sin(s.angle) * poleLen
        const ty = cy - Math.cos(s.angle) * poleLen
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); ctx.stroke()

        // rider
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(tx, ty - 12, 11, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(tx, ty - 12, 8, 0, Math.PI * 2); ctx.fill()

        // vertical reference
        ctx.strokeStyle = '#ffffff14'; ctx.lineWidth = 1; ctx.setLineDash([3, 6])
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - poleLen - 20); ctx.stroke()
        ctx.setLineDash([])

        // angle arc
        const arcR = 30
        ctx.strokeStyle = Math.abs(s.angle * 180 / Math.PI) > 15 ? '#ff336666' : '#ffffff22'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(cx, cy, arcR, -Math.PI / 2, s.angle - Math.PI / 2, s.angle < 0); ctx.stroke()

        // Iq arrow
        const arrowDir = Math.sign(iq_norm)
        if (Math.abs(iq_norm) > 0.05) {
          const arrowLen = Math.abs(iq_norm) * 40
          ctx.strokeStyle = wheelColor + 'aa'; ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(cx, cy - wheelR - 8)
          ctx.lineTo(cx + arrowDir * arrowLen, cy - wheelR - 8)
          ctx.stroke()
          ctx.fillStyle = wheelColor
          ctx.beginPath()
          ctx.moveTo(cx + arrowDir * (arrowLen + 8), cy - wheelR - 8)
          ctx.lineTo(cx + arrowDir * (arrowLen), cy - wheelR - 14)
          ctx.lineTo(cx + arrowDir * (arrowLen), cy - wheelR - 2)
          ctx.fill()
        }

        // angle text
        const deg = (s.angle * 180 / Math.PI).toFixed(1)
        ctx.fillStyle = wheelColor; ctx.font = '700 12px Inter'; ctx.textAlign = 'center'
        ctx.fillText(`${deg}°`, cx, cy + wheelR + 18)

        ctx.fillStyle = '#333'; ctx.font = '700 10px Inter'; ctx.textAlign = 'center'
        ctx.fillText(`Iq = ${(iq_norm * 100).toFixed(0)}%`, cx, cy + wheelR + 32)

        // --- Right panel: time plot ---
        const px = W * 0.52, pw = W * 0.45, ph = H, py = 0
        const N = s.angleHistory.length

        // grid
        ctx.strokeStyle = '#141414'; ctx.lineWidth = 1
        for (const v of [-30, -15, 0, 15, 30]) {
          const y = ph / 2 - v * (ph / 2 / 50)
          ctx.beginPath(); ctx.moveTo(px, py + y); ctx.lineTo(px + pw, py + y); ctx.stroke()
          ctx.fillStyle = '#222'; ctx.font = '8px monospace'; ctx.textAlign = 'left'
          ctx.fillText(`${v}°`, px + 2, py + y - 2)
        }
        ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(px, py + ph / 2); ctx.lineTo(px + pw, py + ph / 2); ctx.stroke()

        // angle line
        ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 2
        ctx.beginPath()
        s.angleHistory.forEach((a, i) => {
          const x = px + (i / 250) * pw
          const y = py + ph / 2 - a * (ph / 2 / 50)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()

        // iq line
        ctx.strokeStyle = '#ff336688'; ctx.lineWidth = 1.5
        ctx.beginPath()
        s.iqHistory.forEach((iq, i) => {
          const x = px + (i / 250) * pw
          const y = py + ph / 2 - iq * (ph / 2 / 100) * 0.5
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()

        // legend
        ctx.fillStyle = '#00ccff'; ctx.font = '9px Inter'; ctx.textAlign = 'left'
        ctx.fillText('Угол наклона', px + 8, py + 14)
        ctx.fillStyle = '#ff3366'
        ctx.fillText('Iq (ответ регулятора)', px + 8, py + 26)
      }
      fc++
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [running])

  return (
    <div>
      <canvas ref={canvasRef} width={800} height={220}
        style={{ width: '100%', height: '220px', background: '#090909', borderRadius: '10px', display: 'block' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#555' }}>Kp (жёсткость)</label>
            <span style={{ fontSize: '11px', color: '#00ccff', fontWeight: '700' }}>{kp}</span>
          </div>
          <input type="range" min="20" max="600" step="10" value={kp} onChange={e => setKp(+e.target.value)} style={{ width: '100%', accentColor: '#00ccff' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#555' }}>Kd (демпфирование)</label>
            <span style={{ fontSize: '11px', color: '#ff9933', fontWeight: '700' }}>{kd}</span>
          </div>
          <input type="range" min="1" max="100" step="1" value={kd} onChange={e => setKd(+e.target.value)} style={{ width: '100%', accentColor: '#ff9933' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <button onClick={disturb}
            style={{ flex: 1, padding: '10px', background: '#ff336622', border: '1px solid #ff336644', borderRadius: '8px', color: '#ff3366', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
            Толкнуть
          </button>
          <button onClick={() => setRunning(r => !r)}
            style={{ flex: 1, padding: '10px', background: '#ffffff11', border: '1px solid #333', borderRadius: '8px', color: '#777', cursor: 'pointer', fontSize: '12px' }}>
            {running ? 'Пауза' : 'Старт'}
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', fontSize: '11px', color: '#444' }}>
        <div>Kp меньше 80 → неустойчиво, падает. Kp больше 400 → колебания, зуд педалей.</div>
        <div>Kd меньше 5 → перелёт при возврате. Kd больше 60 → ватный, медленный отклик.</div>
      </div>
    </div>
  )
}

export default function BalanceChapter() {
  return (
    <ChapterLayout eyebrow="Глава III" title="Равновесие" subtitle="PD-регулятор баланса и искусство не упасть">
      <Section>
        <Prose>
          После сенсорного синтеза у нас есть угол наклона и угловая скорость. Регулятор баланса превращает эту пару в целевой ток для оси Q. В ET Max используется PD-регулятор без интегральной составляющей — почему без неё, разберём ниже.
        </Prose>
        <Prose>
          Формула регулятора: <strong style={{ color: '#00ccff' }}>Iq_target = -(Kp · angle + Kd · angular_velocity)</strong>. Пропорциональный член возвращает педали в вертикаль, дифференциальный гасит угловую скорость и предотвращает перелёт. Коэффициенты Kp и Kd в EUC World подписаны как Hardness и Damping соответственно.
        </Prose>
      </Section>

      <InteractivePanel title="Симулятор баланса · настройте Kp и Kd">
        <BalanceSim />
      </InteractivePanel>

      <Section title="Код из прошивки">
        <Prose>
          В реальной прошивке PD-регулятор спрятан в хаосе декомпилированного <InlineCode>Control_Motor_FOC_Update</InlineCode>. Разобрав переменные по именам, видим очевидную структуру:
        </Prose>
        <CodeBlock
          label="foc.c · PD баланс (реконструкция из 0x08013974)"
          address="0x08013974"
          code={`// Структура balance_gain_struct по адресу 0x200000CC
uint balance_kp = (uint)EUC_Balance_Kp;   // RAM: 0x200000CC
uint balance_kd = (uint)EUC_Balance_Kd;   // RAM: 0x200000CE

// imu_raw содержит: [15:0] = angle*100, [31:16] = rate*10
int imu_raw = motor_state->imu_raw_pitch_rate_angle;

// Разбираем упакованное слово
int16_t angle_x100  = (int16_t)(imu_raw >> 16);   // угол × 100
int16_t rate_x10    = (int16_t)(imu_raw & 0xFFFF); // скорость × 10

// PD formula: I_q_target = -(Kp * angle + Kd * rate)
int kp_contribution = balance_kp * (int)angle_x100;
int kd_contribution = balance_kd * (int)rate_x10;

// Результат нормируется и записывается в PTR_RAM_TARGET_IQ
// Функция Math_PI_Controller затем отслеживает этот целевой ток
int iq_demand = -(kp_contribution + kd_contribution) / 2;
*PTR_RAM_TARGET_IQ = (short)CLAMP(iq_demand, -MAX_IQ, MAX_IQ);`}
        />
        <Callout color="#00ccff" label="Hardness и Damping в приложении">
          Kp и Kd живут в SRAM по адресам <InlineCode>0x200000CC</InlineCode> и <InlineCode>0x200000CE</InlineCode>. Когда в EUC World двигается слайдер Hardness, приложение отправляет команду по BLE, обработчик команды пишет новое значение прямо в SRAM — без перекомпиляции, без перезагрузки контроллера. Следующий цикл ISR уже использует новый коэффициент.
        </Callout>
      </Section>

      <Section title="Почему нет I-составляющей">
        <Prose>
          В задачах удержания уставки интегральный член полезен: он устраняет статическую ошибку, вызванную постоянным возмущением (трение, нагрузка). Для баланса моноколеса такая уставка — вертикаль педалей — не является настоящей целью. При разгоне райдер намеренно наклоняет педали вперёд и удерживает их в этом положении секундами. Интегратор расценил бы это как длительную ошибку и начал бы её «компенсировать», создавая противоположный момент.
        </Prose>
        <Prose>
          Поэтому интегральная составляющая вынесена на уровень ниже — в токовые PI-регуляторы осей D и Q, где она нужна для компенсации сопротивления обмоток и back-EMF. Балансовый контур остаётся чистым PD.
        </Prose>
      </Section>

      <Section title="Лимиты и безопасность">
        <CodeBlock
          label="foc.c · лимиты тока"
          address="0x08013974"
          code={`// Запрашиваемый ток Iq ограничивается аппаратным лимитом
#define MAX_PHASE_CURRENT  500   // 500 A - аварийный cutout
#define SOFT_CURRENT_LIMIT 380   // 380 A - рабочий максимум

if (motor_state->I_Q_Measured > MAX_PHASE_CURRENT ||
    motor_state->I_Q_Measured < -MAX_PHASE_CURRENT) {
    motor_state->Error_Flag = 1;  // → CUTOUT
    HAL_PWM_Set_Duty_Cycle(0, 0, 0);  // все ключи выключены
}

// Температурный дерейт: при 60°C начинаем снижать MAX_PHASE_CURRENT
if (motor_temp_C > 60) {
    float derate = 1.0f - (motor_temp_C - 60.0f) / 15.0f;
    soft_limit = (int)(SOFT_CURRENT_LIMIT * derate);
}`}
        />
      </Section>
    </ChapterLayout>
  )
}
