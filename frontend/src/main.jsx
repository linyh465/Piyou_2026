import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PWAReloadPrompt from './components/PWAReloadPrompt.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PWAReloadPrompt />
  </StrictMode>,
)
