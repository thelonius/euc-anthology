import { h } from 'preact'
import { GLOSSARY } from '../glossary/glossary'
import { Term } from '../glossary/Term'

const KEYWORDS = ['void', 'int', 'short', 'uint', 'float', 'char', 'if', 'else', 'return', 'for', 'while', 'break', 'goto', 'const', 'unsigned', 'struct', 'byte', 'undefined4', 'undefined2', 'undefined1']
const TYPES_RE = /\b(void|int|short|uint|float|char|byte|unsigned|struct|undefined[124])\b/g
const KW_RE = /\b(if|else|return|for|while|break|goto|const)\b/g
const NUM_RE = /\b(0x[0-9a-fA-F]+|\d+\.?\d*)\b/g
const STR_RE = /"[^"]*"/g
const COMMENT_RE = /(\/\/.*$)/gm

const tokenize = (code) => {
  const spans = []
  let remaining = code
  let pos = 0

  const rules = [
    { re: /(\/\/[^\n]*)/g, color: '#5a6e5a' },
    { re: /"[^"]*"/g, color: '#ce9178' },
    { re: /\b(0x[0-9a-fA-F]+|\d+\.?\d*f?)\b/g, color: '#b5cea8' },
    { re: /\b(void|int|short|uint|float|char|byte|unsigned|struct|undefined[124])\b/g, color: '#569cd6' },
    { re: /\b(if|else|return|for|while|break|goto|const)\b/g, color: '#c586c0' },
    { re: /\b[A-Z_][A-Z0-9_]{3,}\b/g, color: '#9cdcfe' },
    { re: /\b(Math_|Control_|HAL_|ADC_|PTR_|EUC_)[A-Za-z_0-9]+\b/g, color: '#dcdcaa' },
  ]

  const allMatches = []
  for (const rule of rules) {
    let m
    const r = new RegExp(rule.re.source, 'gm')
    while ((m = r.exec(code)) !== null) {
      allMatches.push({ start: m.index, end: m.index + m[0].length, text: m[0], color: rule.color })
    }
  }
  allMatches.sort((a, b) => a.start - b.start)

  const result = []
  let cursor = 0
  for (const match of allMatches) {
    if (match.start < cursor) continue
    if (match.start > cursor) result.push({ text: code.slice(cursor, match.start), color: '#d4d4d4' })
    result.push({ text: match.text, color: match.color })
    cursor = match.end
  }
  if (cursor < code.length) result.push({ text: code.slice(cursor), color: '#d4d4d4' })
  return result
}

export const CodeBlock = ({ code, label, address }) => {
  const tokens = tokenize(code.trim())
  return (
    <div style={{ background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '10px', overflow: 'hidden', margin: '24px 0', fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a1a28', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: '#444', letterSpacing: '1px' }}>{label || 'firmware'}</span>
        {address && <span style={{ fontSize: '10px', color: '#2a4a6a', fontFamily: 'monospace' }}>{address}</span>}
      </div>
      <pre style={{ padding: '20px', fontSize: '12.5px', lineHeight: 1.7, overflowX: 'auto', margin: 0 }}>
        {tokens.map((t, i) => {
          // If this token's text is in the glossary, wrap with hover-tooltip span
          // while preserving the syntax-highlight color
          if (GLOSSARY[t.text]) {
            return (
              <Term key={i} term={t.text} style={{
                color: t.color,
                borderBottom: `1px dotted ${t.color}66`,
              }}>{t.text}</Term>
            )
          }
          return <span key={i} style={{ color: t.color }}>{t.text}</span>
        })}
      </pre>
    </div>
  )
}

const codeStyle = { background: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: '4px', padding: '2px 6px', fontSize: '12px', color: '#9cdcfe', fontFamily: "'JetBrains Mono', monospace", display: 'inline-block', lineHeight: 1.3 }

export const InlineCode = ({ children }) => {
  const text = typeof children === 'string' ? children : ''
  if (text && GLOSSARY[text]) {
    return <Term term={text} style={codeStyle}>{children}</Term>
  }
  return <code style={codeStyle}>{children}</code>
}

InlineCode.displayName = 'InlineCode'
