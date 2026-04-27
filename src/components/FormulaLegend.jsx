import { h } from 'preact'
import { wrapTerms } from '../glossary/wrapTerms'

// Sits below a CodeBlock and decodes the symbols used in the formulas.
// Items: array of [symbol, description] tuples. Symbol is rendered verbatim
// in mono; description goes through wrapTerms so glossary tooltips work.
export const FormulaLegend = ({ items, title = 'Обозначения' }) => (
  <div style={{
    background: '#0c0c14',
    border: '1px solid #1e1e2e',
    borderTop: 'none',
    borderRadius: '0 0 10px 10px',
    margin: '-24px 0 24px',
    padding: '14px 18px 16px',
    fontFamily: "'Inter', sans-serif",
  }}>
    <div style={{ fontSize: '9px', color: '#3a3a4a', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
      {title}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(72px, max-content) 1fr', columnGap: '18px', rowGap: '6px' }}>
      {items.map(([sym, desc], i) => (
        <Row key={i} sym={sym} desc={desc} />
      ))}
    </div>
  </div>
)

const Row = ({ sym, desc }) => (
  <>
    <span style={{
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: '12.5px',
      color: '#9cdcfe',
      whiteSpace: 'nowrap',
      lineHeight: 1.55,
      paddingTop: '1px',
    }}>{sym}</span>
    <span style={{ fontSize: '12.5px', color: '#888', lineHeight: 1.55 }}>
      {wrapTerms(desc)}
    </span>
  </>
)
