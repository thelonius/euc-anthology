// Glossary router. Picks the right localized description for a term and
// exposes a stable list of term keys for wrapTerms.
//
// Term keys (FOC, PWM, Clarke, Park, ...) are identical across locales —
// they are abbreviations or proper names, not translatable words. Only the
// `desc` field is locale-specific; `full` is shared from ru.js.

import { useLang } from '../i18n'
import { ENTRIES as RU } from './ru'
import { ENTRIES as EN } from './en'

// Sort terms by length descending so the regex alternation tries longest
// matches first. "Flux Observer" wins over "Flux".
export const TERMS_SORTED = Object.keys(RU).sort((a, b) => b.length - a.length)

// Fast O(1) membership check for callers outside of a hook context
// (CodeBlock token highlighter, InlineCode wrapper).
export const GLOSSARY_KEYS = new Set(Object.keys(RU))

// Hook: returns the entry to render for a given term in the current locale.
// Falls back to Russian desc when the English entry is missing — the site
// works even with a partially translated glossary.
export function useGlossaryEntry(term) {
  const lang = useLang()
  const ru = RU[term]
  if (!ru) return null
  if (lang === 'en') {
    const en = EN[term]
    return { full: ru.full, desc: (en && en.desc) || ru.desc }
  }
  return ru
}
