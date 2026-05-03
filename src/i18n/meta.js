// Updates document.title and <meta> tags when language changes.
// The initial values in index.html stay Russian as the SSR default for crawlers.

export function applyMeta(t) {
  document.title = t('Моноколесо Изнутри · Антология прошивки EUC')
  setMeta('description', t('Моноколесо Изнутри — интерактивная антология прошивки EUC: STM32, FOC, IMU, BLE-телеметрия на примере Begode ET Max.'))
  setMeta('og:title', t('Моноколесо Изнутри'))
  setMeta('og:description', t('Антология реверс-инжиниринга прошивки электрического моноколеса. 14 глав, интерактивные симуляторы, реальный декомпилированный код.'))
}

function setMeta(name, content) {
  const sel = name.startsWith('og:') ? `meta[property="${name}"]` : `meta[name="${name}"]`
  const el = document.querySelector(sel)
  if (el) el.setAttribute('content', content)
}
