import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel, TwoCol } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

const ALPHA = 0.98

const SensorFusionViz = () => {
  const canvasRef = useRef(null)
  const stateRef = useRef({
    t: 0,
    gyroIntegrated: 0,
    fused: 0,
    history: [],
  })
  const [alphaVal, setAlphaVal] = useState(0.98)
  const alphaRef = useRef(0.98)

  useEffect(() => { alphaRef.current = alphaVal }, [alphaVal])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId, lastT = performance.now()

    const loop = (now) => {
      const dt = Math.min((now - lastT) / 1000, 0.04)
      lastT = now
      const s = stateRef.current
      s.t += dt

      // True angle: slow sine + random step disturbances
      const trueAngle = Math.sin(s.t * 0.7) * 20 + Math.sin(s.t * 1.9) * 8

      // Accel: truth + HF noise (mean=0)
      const noise = () => (Math.random() + Math.random() + Math.random() - 1.5) * 4
      const accelAngle = trueAngle + noise()

      // Gyro rate: dTrue/dt + slow drift
      const trueRate = Math.cos(s.t * 0.7) * 20 * 0.7 + Math.cos(s.t * 1.9) * 8 * 1.9
      const gyroDrift = Math.sin(s.t * 0.05) * 8  // slow drift error
      const gyroRate = trueRate + gyroDrift + (Math.random() - 0.5) * 1.5

      // Gyro integrated (would drift)
      s.gyroIntegrated += gyroRate * dt

      // Complementary filter
      const a = alphaRef.current
      s.fused = a * (s.fused + gyroRate * dt) + (1 - a) * accelAngle

      s.history.push({ true: trueAngle, accel: accelAngle, gyro: s.gyroIntegrated, fused: s.fused })
      if (s.history.length > 300) s.history.shift()

      // Draw
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const N = s.history.length
      const toY = (angle) => H / 2 - angle * (H / 120)
      const toX = (i) => (i / 300) * W

      const drawLine = (key, color, width = 1, dash = []) => {
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.setLineDash(dash)
        ctx.beginPath()
        s.history.forEach((h, i) => {
          const x = toX(i + (300 - N))
          const y = toY(h[key])
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Grid
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 1
      for (const deg of [-40, -20, 0, 20, 40]) {
        const y = toY(deg)
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
        ctx.fillStyle = '#2a2a2a'; ctx.font = '9px Inter'; ctx.fillText(`${deg}°`, 4, y - 3)
      }
      ctx.strokeStyle = '#1e1e1e'
      ctx.beginPath(); ctx.moveTo(W - 1, 0); ctx.lineTo(W - 1, H); ctx.stroke()

      // True angle reference (dashed)
      drawLine('true', '#ffffff18', 2, [4, 4])
      // Accel (noisy)
      drawLine('accel', '#ff336666', 1)
      // Gyro integrated (drifting)
      drawLine('gyro', '#ffcc0066', 1)
      // Fused (clean)
      drawLine('fused', '#00ccff', 2)

      // Legend
      const legend = [
        { color: '#ffffff44', label: 'True (ref)', dash: true },
        { color: '#ff3366', label: 'Accel (шум)' },
        { color: '#ffcc00', label: 'Gyro ∫ (дрейф)' },
        { color: '#00ccff', label: 'Fused (результат)' },
      ]
      legend.forEach((l, i) => {
        const lx = 10 + i * 130
        ctx.strokeStyle = l.color; ctx.lineWidth = l.dash ? 1 : 2
        ctx.setLineDash(l.dash ? [3, 3] : [])
        ctx.beginPath(); ctx.moveTo(lx, 14); ctx.lineTo(lx + 20, 14); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = l.color; ctx.font = '10px Inter'; ctx.textAlign = 'left'
        ctx.fillText(l.label, lx + 26, 18)
      })

      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div>
      <canvas ref={canvasRef} width={800} height={200}
        style={{ width: '100%', height: '200px', background: '#0a0a0a', borderRadius: '8px', display: 'block' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '16px' }}>
        <label style={{ fontSize: '11px', color: '#555', minWidth: '120px' }}>Alpha (α) = {alphaVal.toFixed(3)}</label>
        <input type="range" min="0.5" max="0.999" step="0.001" value={alphaVal}
          onChange={e => setAlphaVal(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: '#00ccff' }} />
        <span style={{ fontSize: '10px', color: '#333', width: '80px' }}>
          {alphaVal > 0.99 ? 'гироскоп' : alphaVal < 0.7 ? 'акселерометр' : 'баланс'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
        <div style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '9px', color: '#444', marginBottom: '6px', letterSpacing: '2px' }}>α БЛИЗКО К 1</div>
          <div style={{ fontSize: '12px', color: '#aaa' }}>Доверяем гироскопу. Быстрая реакция, но медленный дрейф накапливается. Хорошо при движении.</div>
        </div>
        <div style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '9px', color: '#444', marginBottom: '6px', letterSpacing: '2px' }}>α БЛИЗКО К 0</div>
          <div style={{ fontSize: '12px', color: '#aaa' }}>Доверяем акселерометру. Нет дрейфа, но вибрации и динамика дают шум. Хорошо в покое.</div>
        </div>
      </div>
    </div>
  )
}

const MPU6500Raw = () => {
  const [vals, setVals] = useState({ ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0, temp: 0 })
  const tRef = useRef(0)
  useEffect(() => {
    const id = setInterval(() => {
      tRef.current += 0.016
      const t = tRef.current
      setVals({
        ax: Math.round((Math.sin(t * 0.8) * 0.3 + (Math.random() - 0.5) * 0.05) * 16384),
        ay: Math.round(((Math.random() - 0.5) * 0.04) * 16384),
        az: Math.round((0.98 + (Math.random() - 0.5) * 0.02) * 16384),
        gx: Math.round((Math.cos(t * 0.8) * 0.3 * 0.8 + (Math.random() - 0.5) * 0.008) * 131),
        gy: Math.round(((Math.random() - 0.5) * 0.006) * 131),
        gz: Math.round(((Math.random() - 0.5) * 0.003) * 131),
        temp: Math.round(3278 + Math.sin(t * 0.01) * 10),
      })
    }, 16)
    return () => clearInterval(id)
  }, [])

  const Row = ({ label, val, color, scale, unit }) => {
    const pct = Math.min(100, Math.abs(val) / scale * 100)
    return (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ fontSize: '10px', color: '#444', fontFamily: 'monospace' }}>{label}</span>
          <span style={{ fontSize: '10px', color, fontFamily: 'monospace', fontWeight: '700' }}>
            {val > 0 ? '+' : ''}{val} <span style={{ color: '#333' }}>{unit}</span>
          </span>
        </div>
        <div style={{ height: '4px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', marginLeft: val < 0 ? `${100 - pct}%` : '0', transition: 'width 0.05s' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '10px', padding: '20px' }}>
      <div style={{ fontSize: '9px', color: '#333', letterSpacing: '3px', marginBottom: '16px' }}>MPU6500 · SPI1 · СЫРЫЕ ДАННЫЕ (16-бит)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#33ff99', marginBottom: '12px', letterSpacing: '1px' }}>АКСЕЛЕРОМЕТР ±2g</div>
          <Row label="ACCEL_X" val={vals.ax} color="#33ff99" scale={16384} unit="LSB" />
          <Row label="ACCEL_Y" val={vals.ay} color="#33ff9988" scale={16384} unit="LSB" />
          <Row label="ACCEL_Z" val={vals.az} color="#33ff9944" scale={16384} unit="LSB" />
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#ff9933', marginBottom: '12px', letterSpacing: '1px' }}>ГИРОСКОП ±250°/с</div>
          <Row label="GYRO_X" val={vals.gx} color="#ff9933" scale={131} unit="LSB" />
          <Row label="GYRO_Y" val={vals.gy} color="#ff993388" scale={131} unit="LSB" />
          <Row label="GYRO_Z" val={vals.gz} color="#ff993344" scale={131} unit="LSB" />
        </div>
      </div>
      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #141414' }}>
        <Row label="TEMP_OUT" val={vals.temp} color="#888" scale={3400} unit="LSB" />
        <div style={{ fontSize: '9px', color: '#2a2a2a', marginTop: '4px' }}>T(°C) = (TEMP_OUT − 21) / 333.87 + 21</div>
      </div>
    </div>
  )
}

export default function IMUChapter() {
  return (
    <ChapterLayout eyebrow="Глава II" title="Чувства" subtitle="MPU6500, сенсорный синтез и комплементарный фильтр">
      <Section>
        <Prose>
          Единственный датчик ориентации на плате — MPU6500 от InvenSense. Это шестиосевой MEMS-чип в корпусе 3×3 мм, подключённый к STM32 по SPI1 на частоте 1 МГц.
        </Prose>
        <Prose>
          Раз в 50 микросекунд (период главного ISR при 20 кГц) прошивка инициирует burst-чтение 14 байт из регистров MPU: три оси акселерометра, температура, три оси гироскопа. Эти 14 байт — весь входной поток системы балансировки.
        </Prose>
      </Section>

      <InteractivePanel title="Сырые данные с MPU6500 · реальное время">
        <MPU6500Raw />
        <div style={{ marginTop: '12px', fontSize: '11px', color: '#333' }}>
          Симуляция реального SPI-потока. ACCEL_Z ≈ 16384 (1g в покое). 1 LSB акселерометра = 1/16384 g.
        </div>
      </InteractivePanel>

      <Section title="Почему одного датчика мало">
        <Prose>
          <strong style={{ color: '#ff3366' }}>Акселерометр</strong> измеряет сумму гравитации и любого линейного ускорения корпуса. В статике по направлению вектора гравитации можно точно вычислить угол наклона. В движении к гравитации добавляются разгон, торможение и вибрации от дороги — и показания становятся бесполезны без фильтрации.
        </Prose>
        <Prose>
          <strong style={{ color: '#ffcc00' }}>Гироскоп</strong> даёт угловую скорость. Чтобы получить угол, показания нужно интегрировать по времени. Проблема в том, что у MEMS-гироскопа есть смещение нуля (bias), которое плавает с температурой. При интегрировании это смещение накапливается в линейно растущую ошибку угла.
        </Prose>
        <Prose>
          Оба сигнала содержат правду об одной и той же величине, но с разным спектром ошибки: у акселерометра шум высокочастотный, у гироскопа — низкочастотный дрейф. Комплементарный фильтр использует это: пропускает гироскоп через ФВЧ, акселерометр через ФНЧ, и складывает результат.
        </Prose>
      </Section>

      <InteractivePanel title="Комплементарный фильтр · интерактивная симуляция">
        <SensorFusionViz />
      </InteractivePanel>

      <Section title="Математика фильтра">
        <CodeBlock
          label="sensors.c · комплементарный фильтр (реконструкция)"
          address="0x08013EF8"
          code={`// Complementary Filter: объединяем акселерометр и гироскоп
// α близко к 1.0 = доверяем гироскопу (быстрые изменения)
// (1-α) = доверяем акселерометру (медленная коррекция)

#define ALPHA  0.98f
#define DT     0.00005f   // 50 µs при 20 kHz

// Угол из акселерометра (через atan2)
float accel_angle = atan2f(accel_y, accel_z) * RAD_TO_DEG;

// Гироскоп: dAngle/dt = gyro_x (после калибровки нуля)
float gyro_rate = (float)(gyro_x - gyro_bias_x) / GYRO_SCALE;

// Фильтр
imu_pitch_angle = ALPHA * (imu_pitch_angle + gyro_rate * DT)
                + (1.0f - ALPHA) * accel_angle;

// Запись в структуру motor_state по адресу 0x200000AC
motor_state->imu_raw_pitch_rate_angle =
    (int16_t)(imu_pitch_angle * 100.0f) |
    ((int16_t)(gyro_rate * 10.0f) << 16);`}
        />
        <Callout color="#33ff99" label="Упаковка по адресу 0x200000AC">
          Результат фильтра пакуется в 32-битное слово: старшие 16 бит — угол в единицах 0.01°, младшие 16 бит — угловая скорость в единицах 0.1°/с. Это слово читает <InlineCode>Control_Motor_FOC_Update</InlineCode> в начале каждого ISR. Упаковка в одно слово экономит одну LDR-инструкцию на пути до PD-регулятора — мелочь, но при 20 кГц каждая такая мелочь становится заметной.
        </Callout>
      </Section>

      <Section title="SPI-транзакция">
        <CodeBlock
          label="hal.c · чтение MPU6500 (14 байт)"
          address="0x08013EF8"
          code={`// MPU6500 burst read: регистры 0x3B–0x48
// Первый байт: адрес с битом READ (0x80)
uint8_t buf[15];
HAL_GPIO_WritePin(CS_GPIO, CS_PIN, GPIO_PIN_RESET);  // CS low
buf[0] = 0x3B | 0x80;   // ACCEL_XOUT_H с флагом READ
HAL_SPI_TransmitReceive(&hspi1, buf, buf, 15, 1);
HAL_GPIO_WritePin(CS_GPIO, CS_PIN, GPIO_PIN_SET);    // CS high

// Парсинг: big-endian 16-bit
int16_t ax = (int16_t)((buf[1] << 8) | buf[2]);
int16_t ay = (int16_t)((buf[3] << 8) | buf[4]);
int16_t az = (int16_t)((buf[5] << 8) | buf[6]);
// buf[7..8] = температура
int16_t gx = (int16_t)((buf[9]  << 8) | buf[10]);
int16_t gy = (int16_t)((buf[11] << 8) | buf[12]);
int16_t gz = (int16_t)((buf[13] << 8) | buf[14]);`}
        />
      </Section>
    </ChapterLayout>
  )
}
