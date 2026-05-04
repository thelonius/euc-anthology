import { createContext, h } from 'preact'
import { useContext, useState, useCallback, useEffect, useMemo } from 'preact/hooks'
import { detectInitialLang, persistLang } from './detect'
import { UI } from './ui'
import { applyMeta } from './meta'

const I18nContext = createContext({ lang: 'ru', setLang: () => {} })

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang)

  const setLang = useCallback((next) => {
    setLangState(next)
    persistLang(next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    const dict = lang === 'en' ? (UI.en || {}) : null
    const t = (key, vars) => interpolate((dict && dict[key]) || key, vars)
    applyMeta(t)
  }, [lang])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useLang = () => useContext(I18nContext).lang
export const useSetLang = () => useContext(I18nContext).setLang

export function useT() {
  const lang = useLang()
  return useCallback((key, vars) => {
    if (lang === 'ru') return interpolate(key, vars)
    const hit = (UI.en || {})[key]
    return interpolate(hit ?? key, vars)
  }, [lang])
}

function interpolate(s, vars) {
  if (!vars || typeof s !== 'string') return s
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`))
}
