import { useState } from 'react'
import Clock from './components/Clock'
import Calendar from './components/Calendar'
import Weather from './components/Weather'
import EmergencyAlertBanner from './components/EmergencyAlertBanner'
import './App.css'

function App() {
  const [hasAlerts, setHasAlerts] = useState(false)

  return (
    <div className={`app-container ${hasAlerts ? 'has-alerts' : ''}`}>
      <header className="top-bar">
        <div className="top-left">
          <Weather variant="compact" />
        </div>
        <div className="top-right">
          <Clock />
        </div>
      </header>
      <main className="main-content">
        <Calendar />
      </main>
      <EmergencyAlertBanner onAlertsChange={setHasAlerts} />
    </div>
  )
}

export default App
