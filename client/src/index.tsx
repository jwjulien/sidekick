/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'
import { initDiagnosticsService } from './services/diagnosticsService'

initDiagnosticsService()

const root = document.getElementById('root')

if (root) {
  render(() => <App />, root)
}
