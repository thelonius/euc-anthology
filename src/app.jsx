import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import Prologue from './chapters/Prologue'
import HardwareChapter from './chapters/HardwareChapter'
import IMUChapter from './chapters/IMUChapter'
import CalibrationChapter from './chapters/CalibrationChapter'
import StateMachineChapter from './chapters/StateMachineChapter'
import ISRAnatomyChapter from './chapters/ISRAnatomyChapter'
import RAMMapChapter from './chapters/RAMMapChapter'
import BalanceChapter from './chapters/BalanceChapter'
import FOCChapter from './chapters/FOCChapter'
import FluxObserverChapter from './chapters/FluxObserverChapter'
import FieldWeakeningChapter from './chapters/FieldWeakeningChapter'
import ThermalChapter from './chapters/ThermalChapter'
import TelemetryChapter from './chapters/TelemetryChapter'
import HackChapter from './chapters/HackChapter'
import './app.css'

const CHAPTERS = [
  { id: 'prologue',   label: 'Пролог',    subtitle: 'Падение',         part: null,             component: Prologue },
  { id: 'hardware',   label: 'Глава I',   subtitle: 'Железо',          part: 'Часть I · Тело', component: HardwareChapter },
  { id: 'imu',        label: 'Глава II',  subtitle: 'Чувства',         part: null,             component: IMUChapter },
  { id: 'boot',       label: 'Глава III', subtitle: 'Пробуждение',     part: null,             component: CalibrationChapter },
  { id: 'state',      label: 'Глава IV',  subtitle: 'Состояния',       part: 'Часть II · Архитектура', component: StateMachineChapter },
  { id: 'isr',        label: 'Глава V',   subtitle: 'Цикл',            part: null,             component: ISRAnatomyChapter },
  { id: 'ram',        label: 'Глава VI',  subtitle: 'Карта',           part: null,             component: RAMMapChapter },
  { id: 'balance',    label: 'Глава VII', subtitle: 'Равновесие',      part: 'Часть III · Управление', component: BalanceChapter },
  { id: 'foc',        label: 'Глава VIII',subtitle: 'Поток',           part: null,             component: FOCChapter },
  { id: 'observer',   label: 'Глава IX',  subtitle: 'Наблюдатель',     part: null,             component: FluxObserverChapter },
  { id: 'fw',         label: 'Глава X',   subtitle: 'Ослабление',      part: null,             component: FieldWeakeningChapter },
  { id: 'thermal',    label: 'Глава XI',  subtitle: 'Тепло',           part: 'Часть IV · Границы', component: ThermalChapter },
  { id: 'telemetry',  label: 'Глава XII', subtitle: 'Голос',           part: null,             component: TelemetryChapter },
  { id: 'hack',       label: 'Глава XIII',subtitle: 'Ремесло',         part: 'Часть V · Практика', component: HackChapter },
]

// Read chapter id from URL hash. Format: #<chapter-id> or #<chapter-id>/<section>
const readChapterFromHash = () => {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '')
  const id = raw.split('/')[0]
  return CHAPTERS.find(c => c.id === id) ? id : null
}

export function App() {
  const [active, setActive] = useState(() => readChapterFromHash() || 'prologue')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [linkCopied, setLinkCopied] = useState(false)
  const mainRef = useRef(null)
  const chapter = CHAPTERS.find(c => c.id === active)
  const ActiveComponent = chapter.component

  // Sync URL → state on browser back/forward and external link clicks
  useEffect(() => {
    const onHashChange = () => {
      const id = readChapterFromHash()
      if (id && id !== active) {
        setActive(id)
        if (mainRef.current) mainRef.current.scrollTop = 0
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [active])

  // Sync state → URL when user picks a chapter via sidebar
  const goTo = (id) => {
    if (id === active) return
    setActive(id)
    const newHash = '#' + id
    if (window.location.hash !== newHash) {
      // Use pushState so browser back-button history works
      history.pushState(null, '', newHash)
    }
    if (mainRef.current) mainRef.current.scrollTop = 0
  }

  const copyLink = () => {
    const url = window.location.origin + window.location.pathname + '#' + active
    navigator.clipboard?.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080808', color: '#ccc', fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .nav-item { display: flex; flex-direction: column; padding: 11px 16px; cursor: pointer; border-radius: 8px; transition: all 0.15s; border: 1px solid transparent; }
        .nav-item:hover { background: #161616; border-color: #222; }
        .nav-item.active { background: #0d1f2d; border-color: #00ccff44; }
        .nav-chapter { font-size: 8px; color: #444; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 3px; }
        .nav-title { font-size: 13px; font-weight: 700; }
        .nav-item.active .nav-title { color: #00ccff; }
        .nav-item:not(.active) .nav-title { color: #666; }
        .part-label { font-size: 9px; color: #6a7a8a; letter-spacing: 2.5px; text-transform: uppercase; padding: 18px 16px 10px; margin-top: 10px; border-top: 1px solid #1a1a1a; font-weight: 700; position: relative; }
        .part-label::before { content: ''; position: absolute; top: -1px; left: 16px; width: 28px; height: 1px; background: #00ccff; }
      `}</style>

      {sidebarOpen && (
        <aside style={{ width: '220px', minWidth: '220px', background: '#0c0c0c', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '28px 20px 24px' }}>
            <div style={{ fontSize: '10px', color: '#333', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>Антология</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#fff', lineHeight: 1.2 }}>Моноколесо<br/><span style={{ color: '#00ccff' }}>Изнутри</span></div>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', padding: '0 10px', flex: 1, overflowY: 'auto' }}>
            {CHAPTERS.map(c => (
              <div key={c.id}>
                {c.part && <div className="part-label">{c.part}</div>}
                <div className={`nav-item ${active === c.id ? 'active' : ''}`} onClick={() => goTo(c.id)}>
                  <span className="nav-chapter">{c.label}</span>
                  <span className="nav-title">{c.subtitle}</span>
                </div>
              </div>
            ))}
          </nav>
          <div style={{ padding: '16px 20px', borderTop: '1px solid #1a1a1a' }}>
            <div style={{ fontSize: '9px', color: '#2a2a2a', lineHeight: 1.6 }}>
              Based on Begode ET Max<br/>STM32F405 · 168V · FOC
            </div>
          </div>
        </aside>
      )}

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', gap: '16px', background: '#0a0a0a' }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: '1px solid #222', borderRadius: '6px', color: '#444', cursor: 'pointer', padding: '6px 10px', fontSize: '12px' }}>
            {sidebarOpen ? '←' : '☰'}
          </button>
          <div style={{ fontSize: '11px', color: '#333' }}>{chapter.label} · {chapter.subtitle}</div>
          <button onClick={copyLink}
            title="Скопировать ссылку на эту главу"
            style={{
              marginLeft: 'auto',
              padding: '6px 12px',
              background: linkCopied ? '#33ff9922' : 'transparent',
              border: `1px solid ${linkCopied ? '#33ff9944' : '#222'}`,
              borderRadius: '6px',
              color: linkCopied ? '#33ff99' : '#555',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
            {linkCopied ? '✓ Скопировано' : '🔗 Ссылка'}
          </button>
        </div>
        <div ref={mainRef} style={{ flex: 1, overflow: 'auto' }}>
          <ActiveComponent />
        </div>
      </main>
    </div>
  )
}
