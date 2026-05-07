/* ═══════════════════════════════════════════════════
   main.jsx — Точка входа приложения

   Подключает глобальные стили и рендерит App
   в элемент #root из index.html.
   ═══════════════════════════════════════════════════ */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

/* Подключаем глобальные стили (токены + Tailwind) */
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
