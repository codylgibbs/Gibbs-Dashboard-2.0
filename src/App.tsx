import Clock from './components/Clock'
import Calendar from './components/Calendar'
import Weather from './components/Weather'
import './App.css'

function App() {
  return (
    <div className="app-container">
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
    </div>
  )
}

export default App
