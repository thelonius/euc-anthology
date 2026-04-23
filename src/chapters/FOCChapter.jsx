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
