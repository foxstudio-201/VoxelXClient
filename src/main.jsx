import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initGlobalSmoothScroll } from './hooks/useSmoothScroll.js'

// Khởi động smooth scroll toàn app — override Windows step scroll
initGlobalSmoothScroll({ speed: 80, duration: 380 })

createRoot(document.getElementById('root')).render(
  <App />
)
