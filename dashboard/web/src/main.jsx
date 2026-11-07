import React from 'react'
import { createRoot } from 'react-dom/client'
import { AppThemeProvider } from './components/base'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </React.StrictMode>,
)
