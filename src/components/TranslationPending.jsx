import { h } from 'preact'
import { useT } from '../i18n'

export function TranslationPending() {
  const t = useT()
  return (
    <div style={{
      maxWidth: '900px',
      margin: '24px auto 0',
      padding: '14px 20px',
      background: '#1a1408',
      border: '1px solid #ffaa0033',
      borderLeft: '3px solid #ffaa00',
      borderRadius: '8px',
    }}>
      <div style={{
        fontSize: '10px',
        color: '#ffaa00',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        marginBottom: '6px',
        fontWeight: 700,
      }}>
        {t('Перевод в работе')}
      </div>
      <div style={{ fontSize: '13px', color: '#aaa', lineHeight: 1.55 }}>
        {t('Эта глава пока доступна только на русском. Английская версия в работе.')}
      </div>
    </div>
  )
}
