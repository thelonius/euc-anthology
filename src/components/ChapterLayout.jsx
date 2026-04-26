import { h } from 'preact'
import { wrapTerms } from '../glossary/wrapTerms'

export const ChapterLayout = ({ eyebrow, title, subtitle, children }) => (
  <div style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 48px 100px' }}>
    {eyebrow && <div style={{ fontSize: '10px', color: '#333', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '16px' }}>{eyebrow}</div>}
    <h1 style={{ fontSize: '48px', fontWeight: '900', color: '#fff', lineHeight: 1.05, marginBottom: subtitle ? '12px' : '48px' }}>{title}</h1>
    {subtitle && <p style={{ fontSize: '18px', color: '#555', marginBottom: '48px', lineHeight: 1.5 }}>{subtitle}</p>}
    {children}
  </div>
)

export const Section = ({ title, children }) => (
  <section style={{ marginBottom: '56px' }}>
    {title && <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#eee', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #1a1a1a' }}>{wrapTerms(title)}</h2>}
    {children}
  </section>
)

export const Prose = ({ children }) => (
  <p style={{ fontSize: '17px', color: '#999', lineHeight: 1.85, marginBottom: '20px' }}>{wrapTerms(children)}</p>
)

export const Callout = ({ color = '#00ccff', label, children }) => (
  <div style={{ background: `${color}08`, border: `1px solid ${color}22`, borderLeft: `3px solid ${color}`, borderRadius: '8px', padding: '20px 24px', margin: '28px 0' }}>
    {label && <div style={{ fontSize: '9px', color, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>}
    <div style={{ fontSize: '15px', color: '#bbb', lineHeight: 1.7 }}>{wrapTerms(children)}</div>
  </div>
)

export const InteractivePanel = ({ title, children }) => (
  <div style={{ background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '28px', margin: '32px 0' }}>
    {title && <div style={{ fontSize: '10px', color: '#444', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px' }}>{wrapTerms(title)}</div>}
    {children}
  </div>
)

export const TwoCol = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>{children}</div>
)
