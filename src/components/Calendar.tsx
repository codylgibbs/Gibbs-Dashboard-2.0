import { useState, useEffect } from 'react'
import '../styles/Calendar.css'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  color: string
  calendarIndex: number
  daysSpanned: number
}

interface ParsedEvent {
  title: string
  start: Date
  end: Date
}

const DEFAULT_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F']

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [daysInMonth, setDaysInMonth] = useState<number[]>([])
  const [firstDayOffset, setFirstDayOffset] = useState(0)

  const getCalendarColors = (count: number): string[] => {
    const colors: string[] = []
    for (let i = 1; i <= count; i++) {
      const raw = import.meta.env?.[`VITE_Calendar_color_${i}` as keyof ImportMetaEnv] as
        | string
        | undefined
      if (raw && raw.trim().length > 0) {
        colors.push(raw.trim().replace(/^['"]|['"]$/g, ''))
      }
    }

    if (colors.length === 0) {
      return DEFAULT_COLORS
    }

    return colors
  }

  const fetchIcs = async (url: string): Promise<string> => {
    const fetchText = async (target: string) => {
      const response = await fetch(target)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.text()
    }

    try {
      return await fetchText(url)
    } catch (directError) {
      const proxies = [
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        `https://cors.isomorphic-git.org/${url}`,
      ]

      for (const proxy of proxies) {
        try {
          return await fetchText(proxy)
        } catch (proxyError) {
          console.warn(`Calendar proxy failed for ${url}:`, proxyError)
        }
      }

      throw directError
    }
  }

  useEffect(() => {
    const fetchCalendars = async () => {
      const calendarUrlsStr = import.meta.env?.VITE_CALENDAR_URLS as string | undefined
      if (!calendarUrlsStr) {
        console.warn('No calendar URLs configured in VITE_CALENDAR_URLS')
        return
      }

      const urls = calendarUrlsStr.split(',').map(u => u.trim())
      const calendarColors = getCalendarColors(urls.length)
      const allEvents: CalendarEvent[] = []

      for (let i = 0; i < urls.length; i++) {
        try {
          const data = await fetchIcs(urls[i])
          const parsed = parseICS(data)
          
          parsed.forEach((event: ParsedEvent) => {
            const startDate = new Date(event.start)
            const endDate = new Date(event.end)
            const daysSpanned = Math.max(
              1,
              Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            )

            allEvents.push({
              id: `${i}-${event.title}-${event.start.getTime()}`,
              title: event.title,
              start: startDate,
              end: endDate,
              color: calendarColors[i % calendarColors.length],
              calendarIndex: i,
              daysSpanned,
            })
          })
        } catch (error) {
          console.error(`Failed to fetch calendar from ${urls[i]}:`, error)
        }
      }

      setEvents(allEvents)
    }

    fetchCalendars()
    const interval = setInterval(fetchCalendars, 5 * 60 * 1000) // Refresh every 5 minutes
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    setFirstDayOffset(firstDay.getDay())
    
    const days = []
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(i)
    }
    setDaysInMonth(days)
  }, [currentDate])

  const goToToday = () => setCurrentDate(new Date())
  const goToPrevMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    setCurrentDate(new Date(year, month - 1, 1))
  }
  const goToNextMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const parseICS = (icsText: string): ParsedEvent[] => {
    const events: ParsedEvent[] = []
    const lines = icsText.split('\n')
    let currentEvent: Partial<ParsedEvent> = {}
    let inEvent = false

    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed === 'BEGIN:VEVENT') {
        inEvent = true
        currentEvent = {}
      } else if (trimmed === 'END:VEVENT') {
        if (currentEvent.title && currentEvent.start && currentEvent.end) {
          events.push({
            title: currentEvent.title,
            start: currentEvent.start,
            end: currentEvent.end,
          })
        }
        inEvent = false
      } else if (inEvent) {
        if (trimmed.startsWith('SUMMARY:')) {
          currentEvent.title = trimmed.substring(8)
        } else if (trimmed.startsWith('DTSTART')) {
          const dateStr = trimmed.split(':')[1]
          currentEvent.start = parseICSDate(dateStr)
        } else if (trimmed.startsWith('DTEND')) {
          const dateStr = trimmed.split(':')[1]
          currentEvent.end = parseICSDate(dateStr)
        }
      }
    }

    return events
  }

  const parseICSDate = (dateStr: string): Date => {
    // Handle both YYYYMMDD and YYYYMMDDTHHMMSS formats
    if (dateStr.includes('T')) {
      const [date, time] = dateStr.split('T')
      const year = parseInt(date.substring(0, 4))
      const month = parseInt(date.substring(4, 6)) - 1
      const day = parseInt(date.substring(6, 8))
      const hours = parseInt(time.substring(0, 2))
      const minutes = parseInt(time.substring(2, 4))
      const seconds = parseInt(time.substring(4, 6))
      return new Date(year, month, day, hours, minutes, seconds)
    } else {
      const year = parseInt(dateStr.substring(0, 4))
      const month = parseInt(dateStr.substring(4, 6)) - 1
      const day = parseInt(dateStr.substring(6, 8))
      return new Date(year, month, day)
    }
  }

  const getEventsForDay = (day: number): CalendarEvent[] => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const targetDate = new Date(year, month, day)
    targetDate.setHours(0, 0, 0, 0)

    return events.filter(event => {
      const eventStart = new Date(event.start)
      const eventEnd = new Date(event.end)
      eventStart.setHours(0, 0, 0, 0)
      eventEnd.setHours(0, 0, 0, 0)
      return targetDate >= eventStart && targetDate < eventEnd
    })
  }

  const isToday = (day: number): boolean => {
    const today = new Date()
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    )
  }

  const monthShort = currentDate.toLocaleString('en-US', { month: 'short' })
  const year = currentDate.getFullYear()
  const lastDayOfMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate()
  const monthRangeLabel = `${monthShort} 1 - ${monthShort} ${lastDayOfMonth}, ${year}`

  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <h2 className="calendar-title">{monthRangeLabel}</h2>
        <div className="calendar-controls">
          <button className="calendar-btn" onClick={goToPrevMonth} aria-label="Previous month">
            ← Prev
          </button>
          <button className="calendar-btn" onClick={goToToday} aria-label="Go to today">
            Today
          </button>
          <button className="calendar-btn" onClick={goToNextMonth} aria-label="Next month">
            Next →
          </button>
          <button className="calendar-btn icon" aria-label="Settings">
            ⚙︎
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="calendar-header-cell">{day}</div>
        ))}
        
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="calendar-cell empty"></div>
        ))}

        {daysInMonth.map(day => {
          const dayEvents = getEventsForDay(day)
          const isTodayFlag = isToday(day)
          
          return (
            <div
              key={day}
              className={`calendar-cell ${isTodayFlag ? 'today' : ''}`}
            >
              <div className="day-number">{day}</div>
              <div className="day-events">
                {dayEvents.length > 3 ? (
                  <>
                    {dayEvents.slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        className="event-bar"
                        style={{ backgroundColor: event.color }}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    <div className="event-overflow">+{dayEvents.length - 2}</div>
                  </>
                ) : (
                  dayEvents.map(event => (
                    <div
                      key={event.id}
                      className="event-bar"
                      style={{ backgroundColor: event.color }}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
