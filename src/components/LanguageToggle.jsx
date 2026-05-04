import { h } from 'preact'
import { useLang, useSetLang } from '../i18n'

export function LanguageToggle() {
  const lang = useLang()
  const setLang = useSetLang()
  const next = lang === 'ru' ? 'en' : 'ru'

  return (
    <button
      onClick={() => setLang(next)}
      title={lang === 'ru' ? 'Switch to English' : 'Переключить на русский'}
      style={{
        padding: '6px 10px',
        background: 'transparent',
        border: '1px solid #222',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '11px',
        fontFamily: 'inherit',
        fontWeight: 700,
        letterSpacing: '1px',
        color: '#555',
      }}
    >
      <span style={{ color: lang === 'ru' ? '#00ccff' : '#444' }}>RU</span>
      <span style={{ margin: '0 6px', color: '#222' }}>·</span>
      <span style={{ color: lang === 'en' ? '#00ccff' : '#444' }}>EN</span>
    </button>
  )
}
