import { useState, useEffect } from 'react'
import '../styles/Clock.css'

export default function Clock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const estTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(now)
      setTime(estTime)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="clock">
      <div className="time-display">{time}</div>
    </div>
  )
}
