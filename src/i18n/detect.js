// Locale detection, persistence, URL sync.
// Priority: ?lang= URL param > localStorage > navigator.languages heuristic > 'en'.

const STORAGE_KEY = 'euc-anthology:lang'
const SUPPORTED = ['ru', 'en']

export function detectInitialLang() {
  const fromUrl = readLangFromUrl()
  if (fromUrl) {
    persistLang(fromUrl)
    return fromUrl
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (SUPPORTED.includes(stored)) return stored
  } catch {}

  const langs = (navigator.languages || [navigator.language || 'en']).map(s => s.toLowerCase())
  for (const l of langs) {
    if (l.startsWith('ru') || l.startsWith('uk') || l.startsWith('be')) return 'ru'
    if (l.startsWith('kk') || l.startsWith('ky')) return 'ru'
  }
  return 'en'
}

export function persistLang(lang) {
  try { localStorage.setItem(STORAGE_KEY, lang) } catch {}
  syncUrlParam(lang)
}

function readLangFromUrl() {
  try {
    const m = new URL(window.location.href).searchParams.get('lang')
    return SUPPORTED.includes(m) ? m : null
  } catch {
    return null
  }
}

function syncUrlParam(lang) {
  try {
    const url = new URL(window.location.href)
    if (lang === 'en') url.searchParams.set('lang', 'en')
    else url.searchParams.delete('lang')
    history.replaceState(null, '', url.toString())
  } catch {}
}
