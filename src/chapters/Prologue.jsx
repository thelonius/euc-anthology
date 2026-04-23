import { h } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { ChapterLayout, Prose, Callout, Section } from '../components/ChapterLayout'

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

      // small periodic disturbance
      if (Math.floor(s.t * 0.3) % 2 === 0 && Math.abs(s.angle) < 0.05) {
        s.vel += (Math.random() - 0.5) * 0.8
      }

      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const cx = W / 2, cy = H * 0.72
      const r = 38
      const len = 140

      // ground
      ctx.strokeStyle = '#1e1e1e'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx - 120, cy + r); ctx.lineTo(cx + 120, cy + r); ctx.stroke()

      // wheel glow
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 15)
      gr.addColorStop(0, '#00ccff18')
      gr.addColorStop(1, 'transparent')
      ctx.fillStyle = gr
      ctx.beginPath(); ctx.arc(cx, cy, r + 15, 0, Math.PI * 2); ctx.fill()

      // wheel
      ctx.strokeStyle = '#00ccff'
      ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = '#1a3a4a'
      ctx.lineWidth = 1
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke()
      }

      // rider pole
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

      // rider head
      const headR = 14
      ctx.fillStyle = '#e0e0e0'
      ctx.beginPath(); ctx.arc(tx, ty - headR, headR, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1a1a1a'
      ctx.beginPath(); ctx.arc(tx, ty - headR, headR - 3, 0, Math.PI * 2); ctx.fill()

      // angle indicator
      const deg = (s.angle * 180 / Math.PI).toFixed(1)
      const color = Math.abs(s.angle) < 0.08 ? '#33ff99' : Math.abs(s.angle) < 0.2 ? '#ffcc00' : '#ff3366'
      ctx.fillStyle = color
      ctx.font = '700 13px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${deg}°`, cx, cy + r + 22)

      // Kp arrow (torque visualization)
      if (Math.abs(s.angle) > 0.02) {
        const arrowDir = -Math.sign(s.angle)
        const arrowX = cx + arrowDir * (r + 30)
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
    <ChapterLayout eyebrow="Пролог" title="Падение" subtitle="Почему моноколесо едет">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '48px', alignItems: 'start', marginBottom: '48px' }}>
        <div>
          <Prose>
            Моноколесо — штука сомнительная с точки зрения классической механики. У него одна точка опоры, нет руля, нет педалей в обычном смысле. Оно обязано падать. Тем не менее, на нём ездят.
          </Prose>
          <Prose>
            Работает это так: внутри корпуса стоит ARM-процессор (STM32F405), к нему по SPI подключён IMU на 1 МГц. Процессор 20 000 раз в секунду читает угол наклона с IMU и пересчитывает ток в обмотках мотора. Если наклон вперёд — мотор получает больше тока и подкатывается вперёд. Если назад — тормозит.
          </Prose>
          <Prose>
            Интересное место здесь одно: вся «магия баланса» — это несколько килобайт кода на C, компилятор gcc-arm и пара коэффициентов Kp и Kd в SRAM по адресу 0x200000CC. Больше там ничего нет.
          </Prose>
        </div>
        <div style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: '16px', padding: '24px' }}>
          <div style={{ fontSize: '9px', color: '#333', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px', textAlign: 'center' }}>Управляемое падение</div>
          <PendulumCanvas />
        </div>
      </div>

      <Callout color="#00ccff" label="Механика">
        Строго говоря, колесо не балансирует в смысле «удерживает положение». Оно всегда немного падает в сторону наклона райдера, а мотор подкатывает точку опоры ровно туда, куда падает центр масс. Прошивка гоняет этот цикл с частотой 20 кГц.
      </Callout>

      <Section title="Что такое эта антология">
        <Prose>
          Это разбор прошивки Begode ET Max (168V, STM32F405), сделанный в Ghidra с последующим ручным анализом Thumb2. Каждая глава идёт по одному функциональному блоку: IMU, баланс, FOC, телеметрия. Для каждого приводится адрес в прошивке, расшифровка декомпиляции и, где это помогает понять, интерактивная симуляция на Canvas.
        </Prose>
        <Prose>
          Задача — чтобы после прочтения человек мог взять свой ET Max, открыть его прошивку в IDA или Ghidra и узнать в ней функции, о которых шла речь. Остальное — вопрос практики.
        </Prose>
      </Section>

      <Section title="Путь">
        {[
          ['I · Железо',            'STM32F405, TIM1+TIM8, ADC, SPI — анатомия контроллера', 'Часть I · Тело'],
          ['II · Чувства',          'MPU6500, акселерометр, гироскоп, комплементарный фильтр'],
          ['III · Пробуждение',     'Что происходит в первые две секунды после POR'],
          ['IV · Состояния',        'Автомат жизненного цикла: POR → IDLE → RUNNING → FAULT', 'Часть II · Архитектура'],
          ['V · Цикл',              'Хронометраж 50-мкс периода FOC-ISR на уровне тактов CPU'],
          ['VI · Карта',            'RAM-структура motor_state, потоки данных между функциями'],
          ['VII · Равновесие',      'PD-регулятор баланса, Kp/Kd, формирование iq_target', 'Часть III · Управление'],
          ['VIII · Поток',          'Field-Oriented Control, преобразования Кларке и Парка'],
          ['IX · Наблюдатель',      'Flux Observer, переход с Hall-датчиков по скорости'],
          ['X · Ослабление',        'Field weakening, геометрия ограничений в D-Q плоскости'],
          ['XI · Тепло',            'Тепловая модель обмоток, пороги tiltback', 'Часть IV · Границы'],
          ['XII · Голос',           'BLE-телеметрия, протокол 0x55AA, система тревог'],
          ['XIII · Ремесло',        'SWD, ST-Link, дамп прошивки и инструменты реверса', 'Часть V · Практика'],
        ].map(([title, desc, part]) => (
          <div key={title}>
            {part && <div style={{ fontSize: '9px', color: '#333', letterSpacing: '3px', marginTop: '18px', marginBottom: '6px', textTransform: 'uppercase' }}>{part}</div>}
            <div style={{ display: 'flex', gap: '20px', padding: '10px 0', borderBottom: '1px solid #141414', alignItems: 'baseline' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#bbb', minWidth: '150px' }}>{title}</div>
              <div style={{ fontSize: '13px', color: '#555' }}>{desc}</div>
            </div>
          </div>
        ))}
      </Section>
    </ChapterLayout>
  )
}
