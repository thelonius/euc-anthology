import { h } from 'preact'
import { useState, useRef, useEffect } from 'preact/hooks'
import { useGlossaryEntry } from './glossary'
import { useT } from '../i18n'

export const Term = ({ term, children, style: styleOverride }) => {
  const def = useGlossaryEntry(term)
  const t = useT()
  if (!def) return children ?? term

  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'below' })
  const triggerRef = useRef(null)
  const hideTimerRef = useRef(null)
  const tipRef = useRef(null)

  const show = hover || pinned

  // Position the tooltip relative to the trigger, flip if it would overflow
  useEffect(() => {
    if (!show || !triggerRef.current) return
    const update = () => {
      const r = triggerRef.current.getBoundingClientRect()
      const tipH = tipRef.current ? tipRef.current.offsetHeight : 120
      const vh = window.innerHeight
      const below = r.bottom + 8
      const above = r.top - 8
      const goAbove = below + tipH > vh - 20 && above - tipH > 20
      setPos({
        top: goAbove ? r.top - 8 : r.bottom + 8,
        left: Math.max(12, Math.min(window.innerWidth - 300, r.left + r.width / 2)),
        placement: goAbove ? 'above' : 'below',
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [show])

  // Click outside / Escape to unpin
  useEffect(() => {
    if (!pinned) return
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (tipRef.current?.contains(e.target)) return
      setPinned(false); setHover(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') { setPinned(false); setHover(false) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pinned])

  const enter = () => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
    setHover(true)
  }
  const leave = () => {
    if (pinned) return
    hideTimerRef.current = setTimeout(() => setHover(false), 150)
  }

  const togglePin = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setPinned(p => !p)
  }

  const copyText = (e) => {
    e.stopPropagation()
    const lines = [term]
    if (def.full) lines.push(`(${def.full})`)
    lines.push(def.desc)
    const text = lines.join(' — ').replace(' — (', ' (')
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <span ref={triggerRef}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onClick={togglePin}
      style={{
        borderBottom: `1px dotted ${pinned ? '#00ccff' : '#00ccff55'}`,
        cursor: 'help',
        color: pinned ? '#00ccff' : 'inherit',
        transition: 'border-color 0.15s, color 0.15s',
        ...(styleOverride || {}),
      }}>
      {children ?? term}
      {show && (
        <span
          ref={tipRef}
          onMouseEnter={enter}
          onMouseLeave={leave}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: `translate(-50%, ${pos.placement === 'above' ? '-100%' : '0'})`,
            background: '#0d0d0d',
            border: `1px solid ${pinned ? '#00ccff66' : '#2a2a2a'}`,
            borderRadius: '8px',
            padding: '14px 16px',
            maxWidth: '320px',
            minWidth: '220px',
            fontSize: '12px',
            lineHeight: 1.55,
            color: '#aaa',
            zIndex: 10000,
            boxShadow: '0 10px 32px rgba(0, 0, 0, 0.7)',
            cursor: 'default',
            textAlign: 'left',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 'normal',
            letterSpacing: 'normal',
            whiteSpace: 'normal',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', gap: '10px' }}>
            <strong style={{ color: '#00ccff', fontSize: '13px', fontWeight: '800' }}>{term}</strong>
            {def.full && <span style={{ fontSize: '10px', color: '#555', textAlign: 'right' }}>{def.full}</span>}
          </div>
          <div style={{ color: '#999', fontSize: '12.5px' }}>{def.desc}</div>
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '9px', color: '#333', letterSpacing: '1.5px' }}>
              {pinned ? t('ЗАФИКСИРОВАНО · ESC чтобы закрыть') : t('КЛИК ЧТОБЫ ЗАФИКСИРОВАТЬ')}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={copyText} style={{
                padding: '4px 10px',
                background: copied ? '#33ff9922' : '#1a1a1a',
                border: `1px solid ${copied ? '#33ff9944' : '#2a2a2a'}`,
                borderRadius: '4px',
                color: copied ? '#33ff99' : '#888',
                fontSize: '10px', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>{copied ? t('✓ скопировано') : t('копировать')}</button>
              {pinned && <button onClick={togglePin} style={{
                padding: '4px 8px',
                background: 'transparent',
                border: '1px solid #2a2a2a',
                borderRadius: '4px',
                color: '#555',
                fontSize: '10px', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>×</button>}
            </div>
          </div>
        </span>
      )}
    </span>
  )
}
