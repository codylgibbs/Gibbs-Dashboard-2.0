import { useState } from 'react'
import Clock from './components/Clock'
import Calendar from './components/Calendar'
import Weather from './components/Weather'
import EmergencyAlertBanner from './components/EmergencyAlertBanner'
import './App.css'

type Theme = 'dark' | 'light'

function App() {
  const [hasAlerts, setHasAlerts] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('appTheme')
      if (stored === 'light' || stored === 'dark') {
        return stored
      }
      return 'dark'
    } catch {
      return 'dark'
    }
  })

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    try {
      localStorage.setItem('appTheme', newTheme)
    } catch {
      // localStorage not available
    }
  }

  return (
    <div className={`app-container ${hasAlerts ? 'has-alerts' : ''} theme-${theme}`}>
      <header className="top-bar">
        <div className="top-left">
          <Weather variant="compact" />
        </div>
        <div className="top-right">
          <Clock />
        </div>
      </header>
      <main className="main-content">
        <Calendar theme={theme} onThemeChange={handleThemeChange} />
      </main>
      <EmergencyAlertBanner onAlertsChange={setHasAlerts} />
    </div>
  )
}

export default App

