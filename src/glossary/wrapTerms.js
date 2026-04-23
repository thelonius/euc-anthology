import { h, cloneElement } from 'preact'
import { Term } from './Term'
import { TERMS_SORTED } from './glossary'

// Components/elements whose children must never be auto-wrapped.
// Code blocks contain real symbols, canvases render visuals, Term is already wrapped.
const SKIP_HTML = new Set(['code', 'pre', 'canvas', 'svg', 'input', 'button', 'style', 'script', 'textarea'])
const SKIP_COMPONENTS = new Set(['Term', 'InlineCode', 'CodeBlock'])

// Build a single regex that matches any term, longest-first.
// Boundaries: must be preceded/followed by a non-word char (or start/end).
// Word chars include Latin letters, Cyrillic, digits. The special chars in terms
// (²) are treated as non-word, which is fine.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const PATTERN = TERMS_SORTED.map(escapeRe).join('|')
const TERM_RE = new RegExp(
  `(?<![A-Za-zА-Яа-яЁё0-9_])(${PATTERN})(?![A-Za-zА-Яа-яЁё0-9_])`,
  'g'
)

// Determine if a vnode should be skipped (no recursion inside).
const shouldSkip = (vnode) => {
  if (!vnode || !vnode.type) return false
  const t = vnode.type
  if (typeof t === 'string') return SKIP_HTML.has(t)
  // Functional component — check its displayName or .name
  const name = t.displayName || t.name
  return SKIP_COMPONENTS.has(name)
}

// Split a string into an array of strings and Term vnodes.
const wrapString = (s) => {
  if (!s) return s
  const out = []
  let last = 0
  let m
  TERM_RE.lastIndex = 0
  while ((m = TERM_RE.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index))
    out.push(h(Term, { term: m[1], key: `t${m.index}-${m[1]}` }))
    last = TERM_RE.lastIndex
  }
  if (out.length === 0) return s
  if (last < s.length) out.push(s.slice(last))
  return out
}

export const wrapTerms = (children) => {
  if (children == null || typeof children === 'boolean') return children
  if (typeof children === 'string') return wrapString(children)
  if (typeof children === 'number') return children
  if (Array.isArray(children)) return children.map(wrapTerms)

  // vnode
  if (children.type !== undefined) {
    if (shouldSkip(children)) return children
    const inner = children.props ? children.props.children : undefined
    if (inner === undefined) return children
    const wrapped = wrapTerms(inner)
    return cloneElement(children, {}, wrapped)
  }
  return children
}
