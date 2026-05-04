import { render } from 'preact'
import './index.css'
import { App } from './app.jsx'
import { I18nProvider } from './i18n'

render(
  <I18nProvider>
    <App />
  </I18nProvider>,
  document.getElementById('app')
)
