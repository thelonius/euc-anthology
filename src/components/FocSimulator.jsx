import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import * as echarts from 'echarts'
import { invPark, invClarke } from '../logic/foc'

// Describes what each scenario teaches
const SCENARIOS = [
  { id: 'stop',    label: 'Стоять',         angle: 0,    color: '#888',    hint: 'Нулевой угол → Iq = 0 → мотор не создаёт момент' },
  { id: 'cruise',  label: 'Крейсер 20°',    angle: 20,   color: '#33ff99', hint: 'Наклон 20° → Iq ≈ 170A → разгон до равновесия с сопротивлением' },
  { id: 'max',     label: 'Максимум 45°',   angle: 45,   color: '#ff9933', hint: 'Полный наклон → Iq = I_max → максимальный момент, вскоре включится field weakening' },
  { id: 'brake',   label: 'Тормозить',      angle: -25,  color: '#ff3366', hint: 'Наклон назад → отрицательный Iq → реверс момента, колесо замедляется' },
]

const PARAMS = {
  maxPhaseCurrent: 380.0, maxBattCurrent: 180.0,
  Rs: 0.045, Ld: 0.00018, Lq: 0.00022,
  Kv: 14.5, poles: 12, maxV_oc: 168.0, batteryRi: 0.12,
  riderWeight: 85, wheelWeight: 44, tireRadius: 0.254,
  cutoutLimit: 480, kp: 0.15, ki: 0.8, fw_kp: 0.25,
  cd: 0.9, frontalArea: 0.6,
}

const safe = (v, def = 0) => (isNaN(v) || !isFinite(v)) ? def : v

const FocSimulator = () => {
  const [running, setRunning] = useState(false)
  const [cutout, setCutout] = useState(false)
  const [leanAngle, setLeanAngle] = useState(0)
  const [activeScenario, setActiveScenario] = useState(null)
  const [, setTick] = useState(0)

  const leanRef = useRef(0)
  const runRef = useRef(false)
  useEffect(() => { leanRef.current = leanAngle }, [leanAngle])
  useEffect(() => { runRef.current = running }, [running])

  const stateRef = useRef({
    id: 0, iq: 0, vd: 0, vq: 0,
    id_integral: 0, iq_integral: 0,
    id_auto: 0, fw_integral: 0,
    v_bus: 168, current_batt: 0,
    omega_elec: 0, angle_elec: 0, omega_mech: 0,
    history: [], lastTime: performance.now(),
  })

  const chartRef = useRef(null)
  const vectorRef = useRef(null)
  const chartInstance = useRef(null)
  const vectorInstance = useRef(null)

  const reset = () => {
    setRunning(false); setCutout(false); setLeanAngle(0); setActiveScenario(null)
    Object.assign(stateRef.current, {
      id: 0, iq: 0, vd: 0, vq: 0, id_integral: 0, iq_integral: 0,
      id_auto: 0, fw_integral: 0, v_bus: PARAMS.maxV_oc, current_batt: 0,
      omega_elec: 0, angle_elec: 0, omega_mech: 0, history: [],
      lastTime: performance.now(),
    })
    chartInstance.current?.setOption({ series: [{ data: [] }, { data: [] }, { data: [] }] })
    vectorInstance.current?.setOption({ series: [{}, {}, { data: [] }, { data: [] }] })
  }

  const applyScenario = (s) => {
    setLeanAngle(s.angle)
    setActiveScenario(s.id)
  }

  // Init ECharts
  useEffect(() => {
    if (!chartRef.current || !vectorRef.current) return
    chartInstance.current = echarts.init(chartRef.current, 'dark')
    vectorInstance.current = echarts.init(vectorRef.current, 'dark')

    vectorInstance.current.setOption({
      title: { text: 'D-Q вектор тока · вращающаяся система', left: 'center', top: 8, textStyle: { color: '#aaa', fontSize: 12, fontWeight: '700' } },
      polar: { radius: '65%', center: ['50%', '55%'] },
      angleAxis: { type: 'value', min: 0, max: 360, startAngle: 0, clockwise: false,
        axisLabel: { show: false }, axisLine: { show: false }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
      radiusAxis: { min: 0, max: 500, name: 'A', nameTextStyle: { color: '#555' },
        axisLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#444', fontSize: 9 },
        splitLine: { lineStyle: { color: '#1a1a1a' } } },
      series: [
        { name: 'Axes', type: 'custom', coordinateSystem: 'polar', renderItem: (p, api) => {
            const c = api.coord([0, 0]), q = api.coord([90, 480]), d = api.coord([0, 480])
            return { type: 'group', children: [
              { type: 'line', shape: { x1: c[0], y1: c[1], x2: q[0], y2: q[1] }, style: { stroke: '#444', lineWidth: 1, lineDash: [4, 4] } },
              { type: 'line', shape: { x1: c[0], y1: c[1], x2: d[0], y2: d[1] }, style: { stroke: '#444', lineWidth: 1, lineDash: [4, 4] } },
              { type: 'text', style: { text: 'Q (момент)', x: q[0], y: q[1] - 16, fill: '#999', font: '10px Inter', align: 'center' } },
              { type: 'text', style: { text: 'D (поле)', x: d[0] + 18, y: d[1] + 4, fill: '#999', font: '10px Inter' } },
            ]}
          }
        },
        { name: 'Limit', type: 'line', coordinateSystem: 'polar', symbol: 'none',
          lineStyle: { color: '#cc000044', width: 2 }, data: Array.from({ length: 37 }, (_, i) => [i * 10, 480]) },
        { name: 'Target', type: 'scatter', coordinateSystem: 'polar', symbolSize: 10,
          itemStyle: { color: '#ffcc00', shadowBlur: 10, shadowColor: '#ffcc00' } },
        { name: 'Actual', type: 'custom', coordinateSystem: 'polar',
          renderItem: (p, api) => {
            const p0 = api.coord([0, 0]); const val = api.value(); if (!val || val.length < 2) return null
            const p1 = api.coord(val)
            return { type: 'line', shape: { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1] },
              style: api.style({ stroke: '#00ccff', lineWidth: 4, lineCap: 'round', shadowBlur: 12, shadowColor: '#00ccff' }) }
          }
        }
      ],
      animation: false, backgroundColor: 'transparent',
    })

    chartInstance.current.setOption({
      title: { text: 'Фазные токи A / B / C', left: 'center', top: 8, textStyle: { color: '#aaa', fontSize: 12, fontWeight: '700' } },
      grid: { top: 36, bottom: 20, left: 48, right: 14 },
      xAxis: { type: 'category', axisLine: { lineStyle: { color: '#333' } }, axisLabel: { show: false }, axisTick: { show: false } },
      yAxis: { type: 'value', min: -500, max: 500, name: 'A', nameTextStyle: { color: '#555' },
        axisLabel: { color: '#444', fontSize: 10 }, axisLine: { lineStyle: { color: '#333' } },
        splitLine: { lineStyle: { color: '#1a1a1a' } } },
      series: [
        { name: 'A', type: 'line', showSymbol: false, smooth: true, color: '#ff3366', data: [] },
        { name: 'B', type: 'line', showSymbol: false, smooth: true, color: '#33ff99', data: [] },
        { name: 'C', type: 'line', showSymbol: false, smooth: true, color: '#00ccff', data: [] },
      ],
      legend: { data: ['A', 'B', 'C'], top: 30, right: 12, textStyle: { color: '#888', fontSize: 10 }, icon: 'rect', itemWidth: 10, itemHeight: 2 },
      animation: false, backgroundColor: 'transparent',
    })

    const onResize = () => { chartInstance.current?.resize(); vectorInstance.current?.resize() }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chartInstance.current?.dispose(); vectorInstance.current?.dispose()
    }
  }, [])

  // Physics loop
  useEffect(() => {
    let animId, fc = 0
    const loop = (t) => {
      const dt_f = Math.max(0.001, Math.min((t - stateRef.current.lastTime) / 1000, 0.05))
      stateRef.current.lastTime = t
      const s = stateRef.current
      const p = PARAMS
      const SS = 40
      const dt = dt_f / SS
      const Phi = safe(60 / (p.Kv * 2 * Math.PI * p.poles))

      if (runRef.current && !cutout) {
        for (let i = 0; i < SS; i++) {
          // Target current proportional to lean angle
          const lean = leanRef.current
          const targetIq = p.maxPhaseCurrent * (lean / 45.0)

          // Field weakening: if voltage vector saturates, push Id negative
          const v_max = s.v_bus * 0.95
          const v_mag = Math.sqrt(s.vd ** 2 + s.vq ** 2)
          if (v_mag > v_max) {
            const v_err = v_mag - v_max
            s.fw_integral += v_err * dt * p.fw_kp
            s.id_auto = safe(-s.fw_integral - v_err * 0.5)
          } else {
            s.id_auto *= 0.9992; s.fw_integral *= 0.998
          }
          const targetId = safe(s.id_auto)

          // PI current controllers with anti-windup clamp
          const err_d = targetId - s.id, err_q = targetIq - s.iq
          s.id_integral += err_d * dt
          s.iq_integral += err_q * dt
          const int_max = (s.v_bus * 0.95) / p.ki  // clamp integrals so ki*integral <= v_max
          s.id_integral = Math.max(-int_max, Math.min(int_max, s.id_integral))
          s.iq_integral = Math.max(-int_max, Math.min(int_max, s.iq_integral))
          s.vd = safe(err_d * p.kp + s.id_integral * p.ki)
          s.vq = safe(err_q * p.kp + s.iq_integral * p.ki)
          // Limit voltage vector magnitude (SVPWM constraint)
          const vMag = Math.sqrt(s.vd * s.vd + s.vq * s.vq)
          const vMax = s.v_bus * 0.95
          if (vMag > vMax) {
            const scale = vMax / vMag
            s.vd *= scale; s.vq *= scale
          }

          // Motor electrical dynamics (rotating frame)
          const did = (s.vd - p.Rs * s.id + s.omega_elec * p.Lq * s.iq) / p.Ld
          const diq = (s.vq - p.Rs * s.iq - s.omega_elec * (p.Ld * s.id + Phi)) / p.Lq
          s.id += did * dt; s.iq += diq * dt
          // Physical current clamp (in reality limited by motor saturation & hardware)
          const iqMax = p.cutoutLimit * 0.85
          if (s.iq > iqMax) s.iq = iqMax
          if (s.iq < -iqMax) s.iq = -iqMax

          // Safety: real cutout only if sustained way over limit (future: add counter)
          if (Math.abs(s.iq) > p.cutoutLimit) { setCutout(true); break }

          // Torque and mechanical dynamics
          const torque = 1.5 * p.poles * (Phi * s.iq + (p.Ld - p.Lq) * s.id * s.iq)
          const vel = s.omega_mech * p.tireRadius
          const f_motor = safe(torque / p.tireRadius)
          const f_drag = safe(0.5 * 1.225 * vel * vel * p.cd * p.frontalArea) * Math.sign(vel || 0)
          const f_roll = (p.riderWeight + p.wheelWeight) * 9.81 * 0.012 * Math.sign(vel || 0)
          const accel = (f_motor - f_drag - f_roll) / (p.riderWeight + p.wheelWeight)

          s.omega_mech += (accel / p.tireRadius) * dt
          s.omega_elec = s.omega_mech * p.poles
          s.angle_elec += s.omega_elec * dt

          // Battery
          const p_mot = safe(Math.abs(s.vd * s.id + s.vq * s.iq))
          s.current_batt = safe(p_mot / Math.max(20, s.v_bus) * 1.1)
          s.v_bus = safe(p.maxV_oc - s.current_batt * p.batteryRi, 20)
        }
      }

      // Update visualizations
      if (fc % 3 === 0) {
        if (runRef.current) {
          const { alpha, beta } = invPark(s.id, s.iq, s.angle_elec)
          const { a, b, c } = invClarke(alpha, beta)
          s.history.push({ a, b, c })
          if (s.history.length > 200) s.history.shift()
          chartInstance.current?.setOption({ series: [
            { data: s.history.map((h, i) => [i, h.a]) },
            { data: s.history.map((h, i) => [i, h.b]) },
            { data: s.history.map((h, i) => [i, h.c]) },
          ]})

          // D-Q scatter
          const lean = leanRef.current
          const tarIq = PARAMS.maxPhaseCurrent * (lean / 45.0)
          const tarId = s.id_auto
          const tarAng = Math.atan2(tarIq, tarId) * 180 / Math.PI
          const tarRad = Math.sqrt(tarIq ** 2 + tarId ** 2)
          const actAng = Math.atan2(s.iq, s.id) * 180 / Math.PI
          const actRad = Math.sqrt(s.iq ** 2 + s.id ** 2)
          vectorInstance.current?.setOption({ series: [{}, {},
            { data: [[((tarAng % 360) + 360) % 360, tarRad]] },
            { data: [[((actAng % 360) + 360) % 360, actRad]] },
          ]})
        }
        setTick(v => v + 1)
      }
      fc++
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [cutout])

  // Derived readouts
  const s = stateRef.current
  const speedKmh = safe(s.omega_mech * PARAMS.tireRadius * 3.6)
  const powerKw = safe(s.current_batt * s.v_bus / 1000)
  const targetIq = PARAMS.maxPhaseCurrent * (leanAngle / 45.0)
  const vMag = Math.sqrt(s.vd ** 2 + s.vq ** 2)
  const vSat = s.v_bus > 0 ? (vMag / (s.v_bus * 0.95)) * 100 : 0
  const fwActive = s.id_auto < -5

  const getStatus = () => {
    if (cutout) return { text: 'CUTOUT · ток превысил 480A', color: '#ff3366' }
    if (!running) return { text: 'Остановлено · нажмите START', color: '#666' }
    if (Math.abs(leanAngle) < 0.5) return { text: 'Стоит · Iq = 0', color: '#888' }
    if (fwActive) return { text: 'Активно ослабление поля · Id < 0', color: '#ff9933' }
    if (Math.abs(s.iq - targetIq) > 20) return { text: 'PI-контур догоняет цель', color: '#ffcc00' }
    return { text: leanAngle > 0 ? 'Разгон / движение' : 'Торможение / реверс', color: '#33ff99' }
  }
  const status = getStatus()

  return (
    <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', background: '#0a0a0a', minHeight: '100vh', color: '#eee' }}>
      <style>{`
        .lcd { font-family: 'Inter', sans-serif; font-weight: 950; letter-spacing: -2px; }
        .flow-row { display: flex; align-items: center; padding: 10px 14px; gap: 12px; font-family: 'JetBrains Mono', monospace; border-radius: 6px; transition: background 0.15s; }
        .flow-label { font-size: 10px; color: #555; letter-spacing: 1.5px; min-width: 96px; text-transform: uppercase; }
        .flow-value { font-size: 13px; font-weight: 700; flex: 1; }
        .flow-arrow { text-align: center; color: #2a2a2a; font-size: 12px; height: 4px; line-height: 0; }
      `}</style>

      <div>
        {/* Onboarding */}
        <div style={{ background: '#0d1420', border: '1px solid #1a2840', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#3a6a8a', letterSpacing: '2px', marginBottom: '6px' }}>КАК ЭТО РАБОТАЕТ</div>
          <div style={{ fontSize: '13px', color: '#aaa', lineHeight: 1.6 }}>
            Слайдер наклона справа задаёт желаемый ток Iq (пропорционально углу). PI-контур догоняет измеренный ток до целевого, генерируя Vd/Vq.
            После обратных Park и Clarke — это токи фаз A/B/C (левый график) и вектор в D-Q плоскости (правый).
          </div>
        </div>

        {/* Signal flow */}
        <div style={{ background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <div className="flow-row">
            <span className="flow-label">Lean angle</span>
            <span className="flow-value" style={{ color: Math.abs(leanAngle) > 0.5 ? '#00ccff' : '#555' }}>
              {leanAngle > 0 ? '+' : ''}{leanAngle.toFixed(1)}°
            </span>
          </div>
          <div className="flow-arrow">↓</div>
          <div className="flow-row">
            <span className="flow-label">Iq target</span>
            <span className="flow-value" style={{ color: Math.abs(targetIq) > 1 ? '#ffcc00' : '#555' }}>
              {targetIq > 0 ? '+' : ''}{targetIq.toFixed(0)} A
            </span>
          </div>
          <div className="flow-arrow">↓ PI</div>
          <div className="flow-row">
            <span className="flow-label">Iq measured</span>
            <span className="flow-value" style={{ color: Math.abs(s.iq) > 1 ? '#33ff99' : '#555' }}>
              {s.iq > 0 ? '+' : ''}{s.iq.toFixed(0)} A
            </span>
          </div>
          <div className="flow-arrow">↓</div>
          <div className="flow-row">
            <span className="flow-label">Speed</span>
            <span className="flow-value" style={{ color: Math.abs(speedKmh) > 0.5 ? '#00ccff' : '#555' }}>
              {speedKmh.toFixed(1)} км/ч
            </span>
          </div>
        </div>

        {/* Graphs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div ref={chartRef} style={{ height: '300px', background: '#111', borderRadius: '12px', border: '1px solid #1e1e1e' }}></div>
          <div ref={vectorRef} style={{ height: '300px', background: '#111', borderRadius: '12px', border: '1px solid #1e1e1e' }}></div>
        </div>

        {/* Telemetry HUD */}
        <div style={{ background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '22px', position: 'relative' }}>
          {cutout && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(180, 20, 30, 0.93)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '16px', color: '#fff' }}>
              <h1 style={{ fontSize: '36px', fontWeight: '950', margin: 0, letterSpacing: '4px' }}>CUTOUT</h1>
              <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.8 }}>Ток превысил {PARAMS.cutoutLimit}A — мотор отключён</div>
              <button onClick={reset} style={{ padding: '10px 24px', background: '#fff', color: '#c00', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', marginTop: '16px' }}>REBOOT</button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <Readout label="СКОРОСТЬ" value={speedKmh.toFixed(1)} unit="км/ч" color="#00ccff" big />
            <Readout label="МОЩНОСТЬ" value={powerKw.toFixed(2)} unit="кВт" color="#ffcc00" />
            <Readout label="БАТАРЕЯ" value={s.v_bus.toFixed(1)} unit="V" color="#33ff99" sub={`${s.current_batt.toFixed(1)} A`} />
            <Readout label="V НАСЫЩЕНИЕ" value={vSat.toFixed(0)} unit="%" color={vSat > 95 ? '#ff3366' : vSat > 70 ? '#ff9933' : '#888'} sub={fwActive ? 'FW АКТИВНО' : null} />
          </div>
        </div>
      </div>

      {/* Control panel */}
      <aside style={{ background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '20px', alignSelf: 'start', position: 'sticky', top: '20px' }}>
        <h2 style={{ fontSize: '16px', color: '#fff', marginBottom: '4px', fontWeight: '900', letterSpacing: '1px' }}>УПРАВЛЕНИЕ</h2>
        <div style={{ fontSize: '11px', color: '#444', marginBottom: '18px' }}>Двигайте слайдер или выберите сценарий</div>

        {/* Status */}
        <div style={{ background: '#141414', border: `1px solid ${status.color}33`, borderRadius: '8px', padding: '10px 14px', marginBottom: '18px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#444', letterSpacing: '2px', marginBottom: '4px' }}>СТАТУС</div>
          <div style={{ fontSize: '12px', color: status.color, fontWeight: '700' }}>{status.text}</div>
        </div>

        {/* START/STOP */}
        <button onClick={() => { if (running) setRunning(false); else { if (cutout) reset(); setRunning(true) } }}
          style={{ width: '100%', padding: '14px', borderRadius: '10px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', border: 'none',
            background: running ? '#e63946' : '#00b4d8', color: '#fff', marginBottom: '18px', letterSpacing: '3px' }}>
          {running ? 'STOP' : 'START'}
        </button>

        {/* Big lean angle slider */}
        <div style={{ background: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '10px', color: '#666', letterSpacing: '2px' }}>НАКЛОН ПЕДАЛЕЙ</span>
            <span style={{ fontSize: '14px', color: leanAngle > 0 ? '#33ff99' : leanAngle < 0 ? '#ff3366' : '#555', fontWeight: '900', fontFamily: 'JetBrains Mono' }}>
              {leanAngle > 0 ? '+' : ''}{leanAngle.toFixed(0)}°
            </span>
          </div>
          <input type="range" min={-45} max={45} step={1} value={leanAngle}
            onChange={(e) => { setLeanAngle(+e.target.value); setActiveScenario(null) }}
            style={{ width: '100%', accentColor: leanAngle >= 0 ? '#33ff99' : '#ff3366' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '9px', color: '#333' }}>
            <span>−45° (назад)</span>
            <span>0°</span>
            <span>+45° (вперёд)</span>
          </div>
        </div>

        {/* Scenario presets */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#444', letterSpacing: '2px', marginBottom: '8px' }}>СЦЕНАРИИ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {SCENARIOS.map(sc => (
              <button key={sc.id} onClick={() => applyScenario(sc)}
                style={{
                  padding: '10px 8px', borderRadius: '6px', cursor: 'pointer',
                  background: activeScenario === sc.id ? `${sc.color}22` : '#141414',
                  border: `1px solid ${activeScenario === sc.id ? sc.color + '66' : '#222'}`,
                  color: activeScenario === sc.id ? sc.color : '#888',
                  fontSize: '11px', fontWeight: '700',
                  fontFamily: 'inherit', textAlign: 'left',
                }}>
                {sc.label}
              </button>
            ))}
          </div>
          {activeScenario && (
            <div style={{ marginTop: '10px', padding: '10px 12px', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '6px', fontSize: '11px', color: '#888', lineHeight: 1.5 }}>
              {SCENARIOS.find(s => s.id === activeScenario).hint}
            </div>
          )}
        </div>

        <button onClick={reset} style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#666', cursor: 'pointer', fontSize: '11px' }}>
          Сброс всех параметров
        </button>
      </aside>
    </div>
  )
}

const Readout = ({ label, value, unit, color, sub, big }) => (
  <div>
    <div style={{ fontSize: '9px', color: '#444', letterSpacing: '2px', marginBottom: '4px' }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
      <span className="lcd" style={{ fontSize: big ? '38px' : '26px', color, fontWeight: '900' }}>{value}</span>
      <span style={{ fontSize: '11px', color: '#444' }}>{unit}</span>
    </div>
    {sub && <div style={{ fontSize: '9px', color: color + 'aa', marginTop: '2px', letterSpacing: '1px' }}>{sub}</div>}
  </div>
)

export default FocSimulator
