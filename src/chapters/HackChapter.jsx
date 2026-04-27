import { h } from 'preact'
import { useState } from 'preact/hooks'
import { ChapterLayout, Section, Prose, Callout, InteractivePanel } from '../components/ChapterLayout'
import { CodeBlock, InlineCode } from '../components/CodeBlock'

const SWDPinout = () => {
  const pins = [
    { num: 1, name: 'VCC',   desc: '3.3 В (target power, опционально)', color: '#ff3366' },
    { num: 2, name: 'SWDIO', desc: 'Data I/O (PA13)',                    color: '#00ccff' },
    { num: 3, name: 'GND',   desc: 'Ground',                             color: '#555' },
    { num: 4, name: 'SWCLK', desc: 'Clock (PA14)',                       color: '#ffcc00' },
    { num: 5, name: 'GND',   desc: 'Ground',                             color: '#555' },
    { num: 6, name: 'SWO',   desc: 'Trace output (PB3, опционально)',    color: '#33ff99' },
    { num: 7, name: 'KEY',   desc: 'Не подключено',                      color: '#222' },
    { num: 8, name: 'GND',   desc: 'Ground',                             color: '#555' },
    { num: 9, name: 'GND',   desc: 'Ground',                             color: '#555' },
    { num: 10, name: 'RESET',desc: 'Системный сброс (NRST)',             color: '#ff9933' },
  ]

  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', padding: '24px' }}>
      <div style={{ fontSize: '10px', color: '#333', letterSpacing: '3px', marginBottom: '16px', textAlign: 'center' }}>
        SWD · 10-PIN CORTEX DEBUG CONNECTOR (1.27 мм шаг)
      </div>

      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '16px 20px', maxWidth: '420px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 24px' }}>
          {[0, 2, 4, 6, 8].map(i => (
            <>
              <div key={`l${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: pins[i].color, display: 'inline-block', flexShrink: 0 }}></span>
                <span style={{ fontSize: '10px', color: '#333', fontFamily: 'monospace' }}>{i + 1}</span>
                <span style={{ fontSize: '11px', color: '#ddd', fontWeight: '700', fontFamily: 'monospace' }}>{pins[i].name}</span>
              </div>
              <div key={`r${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '11px', color: '#ddd', fontWeight: '700', fontFamily: 'monospace' }}>{pins[i + 1].name}</span>
                <span style={{ fontSize: '10px', color: '#333', fontFamily: 'monospace' }}>{i + 2}</span>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: pins[i + 1].color, display: 'inline-block', flexShrink: 0 }}></span>
              </div>
            </>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {pins.map(p => (
          <div key={p.num} style={{ display: 'flex', gap: '10px', alignItems: 'baseline', padding: '6px 0' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0, alignSelf: 'center' }}></span>
            <code style={{ fontSize: '11px', color: '#ddd', fontFamily: 'monospace', minWidth: '60px' }}>{p.num}. {p.name}</code>
            <span style={{ fontSize: '11px', color: '#666' }}>{p.desc}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px', padding: '14px', background: '#ff993311', border: '1px solid #ff993333', borderRadius: '8px', fontSize: '12px', color: '#bb9977' }}>
        Минимум для работы ST-Link: <strong>SWDIO + SWCLK + GND</strong>. Питание цели (VCC) подавать только если хотите программировать без подачи 168 В — в противном случае сначала включите колесо, потом подключайте SWD.
      </div>
    </div>
  )
}

export default function HackChapter() {
  const [step, setStep] = useState(0)

  const steps = [
    {
      title: 'Найти отладочный разъём',
      body: (
        <div>
          <Prose>
            На плате контроллера ET Max есть разъём SWD-10 (иногда SWD-4). Обычно он не распаян, но контактные площадки видны. Расположение меняется от ревизии к ревизии — нужно искать возле STM32, часто рядом с кварцем или разъёмом BMS-UART.
          </Prose>
          <Prose>
            Признаки: группа из 4-10 близко расположенных контактов (шаг 1.27 мм на новых платах, 2.54 мм на старых), рядом — STM32 и подтяжки к 3.3V. Один контакт всегда GND, легко прозванивается мультиметром на массу.
          </Prose>
          <Callout color="#ff9933" label="Опасность">
            Плата контроллера всегда находится под напряжением 168 В, даже при выключенном питании мотора — конденсаторы держат заряд минуты. Перед работой отключите батарею и дождитесь разряда (светодиоды гаснут, вольтметр на шине показывает меньше 30 В). При работе не касайтесь радиаторов MOSFET и керамических конденсаторов.
          </Callout>
        </div>
      )
    },
    {
      title: 'Подключить ST-Link',
      body: (
        <div>
          <SWDPinout />
          <Prose>
            Подойдёт любой клон ST-Link V2 за ~300 рублей с AliExpress. На колесе скорее всего нет разъёма — нужно припаять провода прямо к контактным площадкам. Длина проводов до 15 см при низкой частоте SWCLK (обычно 1.8 МГц) работает без проблем.
          </Prose>
        </div>
      )
    },
    {
      title: 'Проверить соединение',
      body: (
        <div>
          <Prose>
            Сначала убедиться, что ST-Link видит цель. Установить <InlineCode>openocd</InlineCode> (brew / apt / скачать с github.com/openocd-org/openocd) и запустить:
          </Prose>
          <CodeBlock
            label="shell · проверка SWD"
            code={`openocd -f interface/stlink.cfg -f target/stm32f4x.cfg

# Ожидаемый вывод:
# Info : clock speed 2000 kHz
# Info : STLINK V2J37S7 (API v2) VID:PID 0483:3748
# Info : Target voltage: 3.285000
# Info : [stm32f4x.cpu] Cortex-M4 r0p1 processor detected
# Info : [stm32f4x.cpu] target halted due to debug-request, current mode: Thread
# Info : starting gdb server on 3333`}
          />
          <Prose>
            Если вывод такой — всё работает. Если <InlineCode>Error: init mode failed (unable to connect to the target)</InlineCode> — проверить SWDIO, SWCLK не перепутаны, масса общая, цель подана питанием.
          </Prose>
        </div>
      )
    },
    {
      title: 'Сдамп прошивки',
      body: (
        <div>
          <Prose>
            Штатная прошивка ET Max обычно не имеет read-out protection (RDP level 0). Это значит, можно прочитать все 1 МБ flash без ограничений.
          </Prose>
          <CodeBlock
            label="shell · dump firmware"
            code={`# В первом терминале — OpenOCD работает
openocd -f interface/stlink.cfg -f target/stm32f4x.cfg

# Во втором терминале — подключаемся по telnet
telnet localhost 4444

> halt
> flash read_bank 0 firmware_dump.bin 0 0x100000
# будет читать ~30 секунд
> resume
> exit

# Проверка:
$ ls -la firmware_dump.bin
-rw-r--r--  1 user  user  1048576 Apr 23 14:30 firmware_dump.bin

# Вектор сброса на позиции 0x04 должен указывать в flash
$ xxd firmware_dump.bin | head -1
00000000: 0020 0020 0100 0408 0900 0408 0d00 0408`}
          />
          <Callout color="#ff3366" label="Если RDP включён">
            На некоторых поздних ревизиях производитель выставил RDP level 1 — тогда чтение flash вернёт мусор (0xFF всюду), но можно записать новую прошивку. Переход с level 1 на level 0 стирает всю flash — это единственный способ. Level 2 необратим и означает, что чип заблокирован навсегда.
          </Callout>
        </div>
      )
    },
    {
      title: 'Анализировать в Ghidra',
      body: (
        <div>
          <Prose>
            Ghidra (бесплатно, NSA) или IDA Pro (платно). Загрузка:
          </Prose>
          <CodeBlock
            label="Ghidra · import и анализ"
            code={`1. File → Import File → firmware_dump.bin
2. Language: ARM Cortex, Little Endian, 32-bit (выбрать ARM:LE:32:Cortex)
3. Options → Block Name: "flash", Base Address: 0x08000000
4. OK, затем Yes при запросе на запуск анализа
5. Дождаться завершения (5-15 минут для 1 МБ)

# После анализа:
# - Window → Symbol Tree: видно все функции (Ghidra сама их найдёт)
# - Reset vector всегда на 0x08000004 → Reset_Handler
# - Листайте код от Reset_Handler, раскручивая подряд вызываемые функции
# - В Decompiler правый клик → Rename или Retype для именования переменных`}
          />
          <Prose>
            Помощь в анализе: файлы <InlineCode>STM32F405.svd</InlineCode> (CMSIS System View Description) можно использовать, чтобы Ghidra распознавала обращения к регистрам периферии по именам (<InlineCode>RCC-&gt;CR</InlineCode> вместо <InlineCode>*(uint32_t*)0x40023800</InlineCode>). Для этого есть плагин <InlineCode>ghidra-svd-loader</InlineCode>.
          </Prose>
        </div>
      )
    },
    {
      title: 'Написать свою прошивку',
      body: (
        <div>
          <Prose>
            После понимания архитектуры можно начать писать собственную прошивку. Варианты:
          </Prose>
          <ul style={{ color: '#aaa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px', margin: '0 0 16px' }}>
            <li><strong style={{ color: '#00ccff' }}>VESC</strong> — открытая прошивка от Benjamin Vedder. Заточена под скейтборды и велосипеды, но отлично подходит для EUC. Много документации, активное сообщество.</li>
            <li><strong style={{ color: '#33ff99' }}>SimpleFOC</strong> — библиотека для Arduino/STM32HAL. Образовательно чистый код, проще для понимания, но медленнее (обычно 5-10 кГц вместо 20).</li>
            <li><strong style={{ color: '#ff9933' }}>С нуля на STM32CubeIDE</strong> — самый сложный путь, но даёт полный контроль. Можно использовать код из антологии как ориентир.</li>
          </ul>
          <CodeBlock
            label="shell · прошивка VESC (пример)"
            code={`# Сборка VESC firmware для ваших параметров
git clone https://github.com/vedderb/bldc.git
cd bldc

# Выбор цели (STM32F405 — HW_60)
make HW_SOURCE=hwconf/hw_60.c HW_HEADER=hwconf/hw_60.h

# Прошивка через ST-Link
make HW_SOURCE=hwconf/hw_60.c HW_HEADER=hwconf/hw_60.h upload

# Настройка через VESC Tool (бесплатное приложение)
# → Motor Setup → Detect Motor Parameters
# → Wizard сам определит Kv, Rs, Ld, Lq, inductance saturation`}
          />
          <Callout color="#00ccff" label="Начните с безопасного">
            Первая прошивка в ваше колесо — это момент, когда вы можете сжечь MOSFET за 50 мс неправильной коммутацией или сломать ноги неправильным балансом. Советы: (1) первая тестовая сборка — на стенде, а не под райдером; (2) ограничьте ток в настройках до 20-30 А, чтобы ошибки выражались как рывки, а не пожар; (3) всегда держите рядом оригинальную прошивку для отката. Чемпионство не стоит поломанной лодыжки.
          </Callout>
        </div>
      )
    },
  ]

  return (
    <ChapterLayout eyebrow="Глава XIV" title="Ремесло" subtitle="Как подключиться к своему колесу, дампнуть прошивку и разобрать её">
      <Section>
        <Prose>
          Все предыдущие главы — это теория и разбор. Эта — практическая: пошаговое руководство по превращению читателя антологии в реверс-инженера прошивки EUC. Понадобится: паяльник, ST-Link V2 (клон за ~300₽), компьютер с OpenOCD и Ghidra. И несколько часов аккуратной работы.
        </Prose>
      </Section>

      <InteractivePanel title={`Шаг ${step + 1} из ${steps.length}: ${steps[step].title}`}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', overflowX: 'auto' }}>
          {steps.map((s, i) => (
            <button key={i} onClick={() => setStep(i)}
              style={{
                padding: '10px 14px', background: step === i ? '#00ccff22' : i < step ? '#33ff9911' : 'transparent',
                border: `1px solid ${step === i ? '#00ccff44' : i < step ? '#33ff9922' : '#222'}`,
                borderRadius: '8px',
                color: step === i ? '#00ccff' : i < step ? '#33ff99' : '#555',
                cursor: 'pointer', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap',
                flex: '0 0 auto',
              }}>
              {i + 1}. {s.title}
            </button>
          ))}
        </div>
        <div>{steps[step].body}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
            style={{ padding: '10px 20px', background: '#141414', border: '1px solid #222', borderRadius: '8px', color: step === 0 ? '#333' : '#888', cursor: step === 0 ? 'default' : 'pointer', fontSize: '12px' }}>
            ← Предыдущий
          </button>
          <button onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1}
            style={{ padding: '10px 20px', background: step === steps.length - 1 ? '#141414' : '#00ccff22', border: `1px solid ${step === steps.length - 1 ? '#222' : '#00ccff44'}`, borderRadius: '8px', color: step === steps.length - 1 ? '#333' : '#00ccff', cursor: step === steps.length - 1 ? 'default' : 'pointer', fontSize: '12px' }}>
            Следующий →
          </button>
        </div>
      </InteractivePanel>

      <Section title="Что читать дальше">
        <Prose>
          Антология — точка входа, а не исчерпывающий справочник. Для глубокого погружения:
        </Prose>
        <ul style={{ color: '#aaa', fontSize: '15px', lineHeight: 1.9, paddingLeft: '20px' }}>
          <li><strong style={{ color: '#eee' }}>Ю. Н. Калачёв · «SimInTech: моделирование в электроприводе»</strong> — русскоязычный учебник для практиков. Геометрический вывод формул Кларк/Парк, БКПС, алгоритмы ШИМ, готовые SimInTech-модели PMSM, БДПТ и АД. Доступен бесплатно: <code>SimInTech.ru</code>.</li>
          <li><strong style={{ color: '#eee' }}>ST Application Notes</strong> — AN4013 (FOC), AN5325 (field weakening), AN4642 (ADC+TIM synchronization). Официальная документация от производителя STM32.</li>
          <li><strong style={{ color: '#eee' }}>Krause · «Analysis of Electric Machinery»</strong> — англоязычная классика. Модели электрических машин, включая PMSM и FOC, с полной математической строгостью.</li>
          <li><strong style={{ color: '#eee' }}>VESC source</strong> (github.com/vedderb/bldc) — реальная production-прошивка с комментариями, от которой можно учиться архитектуре.</li>
          <li><strong style={{ color: '#eee' }}>EUC forums</strong> — electricunicycle.org, EUC World Discord. Там сидят люди, которые уже разбирали конкретные модели и могут подсказать по железу.</li>
          <li><strong style={{ color: '#eee' }}>Ghidra + PyGhidra</strong> — документация Ghidra и скриптинг на Python для автоматизации типовых задач анализа.</li>
        </ul>
      </Section>

      <Section title="Эпилог">
        <Prose>
          Моноколесо — один из самых плотных по концентрации знаний продуктов массовой электроники. В корпусе размером с рюкзак сосуществуют: силовая электроника на 168 В и 30 кВт, высокоскоростная управляющая математика на 20 кГц, MEMS-сенсорика, литиевая энергетика с BMS, BLE-телеметрия, тепловой менеджмент, и обратная задача механики — самобалансирование. За каждой функцией стоит десятилетие академических публикаций и годы инженерной практики.
        </Prose>
        <Prose>
          Разобравшись с прошивкой одного моноколеса, вы заодно получаете рабочее понимание всех современных BLDC-приводов: электросамокатов, электроскейтов, робопылесосов, дронов, коллаборативных роботов. Принципы одни и те же — меняются только числа в коэффициентах.
        </Prose>
      </Section>
    </ChapterLayout>
  )
}
