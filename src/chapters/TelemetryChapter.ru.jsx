import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

const genPacket = () => {
  const t = performance.now() / 1000
  const speed = Math.max(0, 35 + Math.sin(t * 0.4) * 15 + (Math.random() - 0.5) * 2)
  const voltage = 150 + Math.sin(t * 0.05) * 8
  const current = (speed * 1.8 + (Math.random() - 0.5) * 5)
  const temp = 38 + Math.sin(t * 0.02) * 12

  const speedRaw = Math.round(speed * 66.6) & 0xFFFF
  const voltRaw  = Math.round(voltage * 100) & 0xFFFF
  const curRaw   = (Math.round(current * 100) + 65536) & 0xFFFF
  const tempRaw  = (Math.round(temp * 10) + 65536) & 0xFFFF

  const bytes = new Uint8Array(20)
  bytes[0] = 0x55; bytes[1] = 0xAA
  bytes[2] = 0x14; bytes[3] = 0x5A   // mode / serial
  bytes[4] = (speedRaw >> 8) & 0xFF; bytes[5] = speedRaw & 0xFF
  bytes[6] = (voltRaw >> 8) & 0xFF;  bytes[7] = voltRaw & 0xFF
  bytes[8] = 0x00; bytes[9] = 0x00   // flags
  bytes[10] = (curRaw >> 8) & 0xFF;  bytes[11] = curRaw & 0xFF
  bytes[12] = (tempRaw >> 8) & 0xFF; bytes[13] = tempRaw & 0xFF
  bytes[14] = 0x00; bytes[15] = Math.round(speed / 10)  // speed warning
  bytes[16] = 0x01; bytes[17] = 0x00  // mode flags
  bytes[18] = 0x00; bytes[19] = 0x00  // reserved

  return { bytes, speed, voltage, current, temp }
}

const FIELDS = [
  { offset: [0, 1], label: 'SYNC',    color: '#ff3366', desc: 'Маркер начала пакета' },
  { offset: [2, 3], label: 'HDR',     color: '#888',    desc: 'Режим / серийник' },
  { offset: [4, 5], label: 'SPEED',   color: '#00ccff', desc: 'Скорость × 66.6 = км/ч' },
  { offset: [6, 7], label: 'VOLT',    color: '#33ff99', desc: 'Напряжение × 100 = V' },
  { offset: [8, 9], label: 'FLAGS',   color: '#555',    desc: 'Флаги тревоги' },
  { offset: [10,11],label: 'CURR',    color: '#ffcc00', desc: 'Ток × 100 = A (знаковый)' },
  { offset: [12,13],label: 'TEMP',    color: '#ff6633', desc: 'Температура × 10 = °C (знаковый)' },
  { offset: [14,15],label: 'WARN',    color: '#ff9933', desc: 'Порог предупреждения скорости' },
  { offset: [16,17],label: 'MODE',    color: '#aa88ff', desc: 'Биты режима (Hard/Soft/etc)' },
  { offset: [18,19],label: 'RSVD',    color: '#333',    desc: 'Зарезервировано' },
]

const PacketDecoder = () => {
  const [data, setData] = useState(null)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setData(genPacket()), 200)
    return () => clearInterval(id)
  }, [])

  if (!data) return null
  const { bytes, speed, voltage, current, temp } = data

  const getFieldForByte = (i) => FIELDS.find(f => i >= f.offset[0] && i <= f.offset[1])

  return (
    <div>
      {/* Packet bytes visualization */}
      <div style={{ background: '#080808', borderRadius: '8px', padding: '20px', fontFamily: 'monospace', marginBottom: '20px' }}>
        <div style={{ fontSize: '9px', color: '#333', letterSpacing: '2px', marginBottom: '14px' }}>BLE NOTIFY · 0x55AA · 20 BYTES · ~5/s</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {Array.from(bytes).map((b, i) => {
            const field = getFieldForByte(i)
            const isHover = hover !== null && getFieldForByte(i) === getFieldForByte(hover)
            return (
              <div key={i}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                style={{
                  width: '42px', padding: '8px 4px', borderRadius: '5px', textAlign: 'center',
                  background: isHover ? `${field?.color || '#333'}22` : '#111',
                  border: `1px solid ${isHover ? (field?.color || '#555') + '66' : '#1e1e1e'}`,
                  cursor: 'default', transition: 'all 0.1s',
                }}>
                <div style={{ fontSize: '13px', color: field ? field.color : '#333', fontWeight: '700' }}>
                  {b.toString(16).padStart(2, '0').toUpperCase()}
                </div>
                <div style={{ fontSize: '8px', color: '#333', marginTop: '2px' }}>[{i}]</div>
              </div>
            )
          })}
        </div>
        {hover !== null && (
          <div style={{ marginTop: '14px', padding: '10px 14px', background: '#0f0f0f', borderRadius: '6px', fontSize: '11px', color: '#999' }}>
            <span style={{ color: getFieldForByte(hover)?.color || '#fff', fontWeight: '700' }}>{getFieldForByte(hover)?.label}</span>
            {' · '}
            {getFieldForByte(hover)?.desc}
          </div>
        )}
      </div>

      {/* Decoded values */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Скорость', value: speed.toFixed(1), unit: 'км/ч', color: '#00ccff', warn: speed > 45 },
          { label: 'Напряжение', value: voltage.toFixed(1), unit: 'V', color: '#33ff99', warn: voltage < 130 },
          { label: 'Ток', value: current.toFixed(1), unit: 'A', color: '#ffcc00', warn: current > 40 },
          { label: 'Температура', value: temp.toFixed(1), unit: '°C', color: '#ff6633', warn: temp > 55 },
        ].map(({ label, value, unit, color, warn }) => (
          <div key={label} style={{ background: '#0d0d0d', border: `1px solid ${warn ? color + '44' : '#1a1a1a'}`, borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#333', marginBottom: '8px', letterSpacing: '1px' }}>{label.toUpperCase()}</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: warn ? color : '#ddd', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>{unit}</div>
            {warn && <div style={{ fontSize: '9px', color, marginTop: '6px' }}>WARN</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

const AlarmViz = () => {
  const [speed, setSpeed] = useState(42)
  const [pwmLoad, setPwmLoad] = useState(18000)

  const getBeepLevel = () => {
    if (speed >= 60) return 3
    if (speed >= 50) return 2
    if (speed >= 40) return 1
    return 0
  }
  const beep = getBeepLevel()
  const overload = pwmLoad > 26000

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#555' }}>Скорость</label>
            <span style={{ fontSize: '11px', color: '#00ccff', fontWeight: '700' }}>{speed} км/ч</span>
          </div>
          <input type="range" min="0" max="80" value={speed} onChange={e => setSpeed(+e.target.value)}
            style={{ width: '100%', accentColor: '#00ccff' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#555' }}>PWM нагрузка</label>
            <span style={{ fontSize: '11px', color: '#ffcc00', fontWeight: '700' }}>{pwmLoad}</span>
          </div>
          <input type="range" min="0" max="35000" value={pwmLoad} onChange={e => setPwmLoad(+e.target.value)}
            style={{ width: '100%', accentColor: '#ffcc00' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[40, 50, 60].map(threshold => {
          const active = speed >= threshold
          return (
            <div key={threshold} style={{ padding: '16px', borderRadius: '10px', textAlign: 'center',
              background: active ? '#ff336622' : '#0d0d0d', border: `1px solid ${active ? '#ff336666' : '#1a1a1a'}` }}>
              <div style={{ fontSize: '28px', fontWeight: '900', color: active ? '#ff3366' : '#333' }}>{threshold}</div>
              <div style={{ fontSize: '9px', color: active ? '#ff3366' : '#333', marginTop: '4px' }}>
                {active ? 'BEEP!' : 'км/ч'}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1, padding: '14px', borderRadius: '8px', textAlign: 'center',
          background: overload ? '#ff990022' : '#0d0d0d', border: `1px solid ${overload ? '#ff990066' : '#1a1a1a'}` }}>
          <div style={{ fontSize: '11px', color: overload ? '#ff9933' : '#444', fontWeight: '700' }}>{'PWM > 26000 → TILTBACK'}</div>
          <div style={{ fontSize: '9px', color: '#333', marginTop: '4px' }}>Motor overload protection</div>
        </div>
        <div style={{ flex: 1, padding: '14px', borderRadius: '8px', textAlign: 'center',
          background: beep > 0 ? '#ff336622' : '#0d0d0d', border: `1px solid ${beep > 0 ? '#ff336644' : '#1a1a1a'}` }}>
          <div style={{ fontSize: '11px', color: beep > 0 ? '#ff3366' : '#444', fontWeight: '700' }}>
            ALARM STATE = {beep > 0 ? '1 (TILTBACK)' : '0'}
          </div>
          <div style={{ fontSize: '9px', color: '#333', marginTop: '4px' }}>telemetry_state[9] = {beep > 0 ? '1' : '0'}</div>
        </div>
      </div>
    </div>
  )
}

export default function TelemetryChapter() {
  return (
    <ChapterLayout eyebrow="Глава V" title="Голос" subtitle="BLE-телеметрия, тревоги и язык моноколеса">
      <Section>
        <Prose>
          Каждые 200 мс функция <InlineCode>Control_Telemetry_Task</InlineCode> собирает текущие значения скорости, напряжения, фазного тока, температуры и режима работы в 20-байтовый фрейм и отправляет его через USART1 в BLE-модуль. Модуль публикует фрейм как GATT-нотификацию, которую ловят приложения типа EUC World и WheelLog.
        </Prose>
        <Prose>
          Формат фрейма не документирован производителем. Он был восстановлен сообществом через снифферы BLE и сверку с поведением колеса, позже подтверждён реверсом. В прошивке ET Max формирование пакета находится по адресу <InlineCode>0x08018C2C</InlineCode>, там же логика аварийных порогов.
        </Prose>
      </Section>

      <InteractivePanel title="Живой BLE-пакет · наведите на байт">
        <PacketDecoder />
      </InteractivePanel>

      <Section title="Разбор пакета">
        <CodeBlock
          label="euc_watch_firmware/main.c · парсер BLE (ESP32)"
          code={`// Подписываемся на GATT notification от BLE UUID
// Пакет приходит в callback handle_notify()

static void handle_notify(struct ble_gap_event *event) {
    uint8_t *data = event->notify_rx.om->om_data;
    if (data[0] != 0x55 || data[1] != 0xAA) return; // проверяем SYNC

    // Скорость: big-endian uint16, единицы 1/66.6 км/ч
    uint16_t speed_raw = (data[4] << 8) | data[5];
    float speed_kmh = speed_raw / 66.6f;

    // Напряжение: big-endian uint16, единицы 0.01 V
    uint16_t volt_raw = (data[6] << 8) | data[7];
    float voltage = volt_raw / 100.0f;

    // Ток: big-endian int16 (знаковый!), единицы 0.01 A
    int16_t curr_raw = (int16_t)((data[10] << 8) | data[11]);
    float current = curr_raw / 100.0f;

    // Температура: big-endian int16, единицы 0.1 °C
    int16_t temp_raw = (int16_t)((data[12] << 8) | data[13]);
    float temp_c = temp_raw / 10.0f;

    update_display(speed_kmh, voltage, current, temp_c);
}`}
        />
      </Section>

      <Section title="Логика тревог и тилтбэка">
        <Prose>
          Помимо сборки фрейма, <InlineCode>Control_Telemetry_Task</InlineCode> выполняет роль супервизора. На каждый свой вызов она проверяет три условия: превышение скоростного порога (40/50/60 км/ч в зависимости от режима Soft/Medium/Hard), превышение амплитуды PWM выше 26000, и счётчик таймаута BMS по UART. При срабатывании любого из условий в байт <InlineCode>telemetry_state[9]</InlineCode> записывается 1, что для балансового контура является сигналом принудительно отклонить педали назад (tiltback) для снижения скорости.
        </Prose>
        <InteractivePanel title="Симулятор порогов тревоги">
          <AlarmViz />
        </InteractivePanel>
        <CodeBlock
          label="foc.c · логика тревог из Control_Telemetry_Task"
          address="0x08018C2C"
          code={`// Пороги скорости зависят от режима (0=40, 1=50, 2=60 км/ч)
uint8_t speed_limit_kmh;
if (*mode_reg == 0x02)      speed_limit_kmh = 0x3c;  // 60
else if (*mode_reg == 0x01) speed_limit_kmh = 0x32;  // 50
else                        speed_limit_kmh = 0x28;  // 40

// Счётчик превышения: +1 каждый цикл > порога, сброс при <
sVar3 = tele->over_speed_counter++;
if (sVar3 > 0x14) {  // 20 циклов ~= 4 секунды
    tele->alarm_state = 1;  // → TILTBACK
}

// Перегрузка мотора: PWM amplitude > 26000
if (26000 < *RAM_Motor_PWM_Magnitude) {
    tele->overload_counter++;
    if (tele->overload_counter > 5) {
        tele->alarm_state = 1;  // → TILTBACK
    }
}`}
        />
      </Section>

      <Callout color="#aa88ff" label="BMS Watchdog">
        Контроллер ждёт данные от BMS (батарейного модуля) по UART. Таймаут — 200 циклов (~10 мс). Если BMS замолчал (обрыв кабеля, неисправность), контроллер отключает мотор. Это одна из причин, почему самодельные AliExpress-сборки с кустарным BMS опасны: молчащий BMS = внезапный cutout на скорости.
      </Callout>
    </ChapterLayout>
  )
}
