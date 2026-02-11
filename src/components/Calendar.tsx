import { useState, useEffect, useRef } from 'react'
import '../styles/Calendar.css'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  color: string
  calendarIndex: number
  daysSpanned: number
  location?: string
}

interface ParsedEvent {
  title: string
  start: Date
  end: Date
  rrule?: string
  allDay?: boolean
  location?: string
}

const DEFAULT_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F']

type ViewMode = 'monthly' | 'weekly' | 'daily'
type Theme = 'dark' | 'light' | 'auto'

interface CalendarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  manualAlertActive?: boolean
  onToggleManualAlert?: () => void
}

export default function Calendar({ theme, onThemeChange, manualAlertActive, onToggleManualAlert }: CalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [daysInMonth, setDaysInMonth] = useState<number[]>([])
  const [firstDayOffset, setFirstDayOffset] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement | null>(null)
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem('calendarViewMode')
      if (stored === 'monthly' || stored === 'weekly' || stored === 'daily') {
        return stored
      }
      return 'monthly'
    } catch {
      return 'monthly'
    }
  })
  const [hiddenCalendars, setHiddenCalendars] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('hiddenCalendars')
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed.filter((value) => Number.isFinite(value)) : []
    } catch {
      return []
    }
  })

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

  const getCalendarName = (index: number): string => {
    const raw = import.meta.env?.[`VITE_Calendar_name_${index}` as keyof ImportMetaEnv] as
      | string
      | undefined
    if (raw && raw.trim().length > 0) {
      return raw.trim().replace(/^['"]|['"]$/g, '')
    }
    return `Calendar ${index}`
  }

  const toggleCalendarVisibility = (index: number) => {
    setHiddenCalendars((prev) =>
      prev.includes(index) ? prev.filter((value) => value !== index) : [...prev, index]
    )
    setSettingsOpen(false)
  }

  const toggleTheme = (newTheme: Theme) => {
    onThemeChange(newTheme)
    setSettingsOpen(false)
  }

  const fetchIcs = async (url: string): Promise<string> => {
    // Convert Google Calendar URL to use Vite proxy
    let proxyUrl = url
    try {
      const parsed = new URL(url)
      if (parsed.hostname === 'calendar.google.com') {
        proxyUrl = url.replace('https://calendar.google.com/calendar', '/api/calendar')
      } else if (parsed.hostname === 'import.calendar.google.com') {
        proxyUrl = url.replace('https://import.calendar.google.com/calendar', '/api/calendar-import')
      }
    } catch {
      // leave proxyUrl as-is for non-standard URLs
    }
    
    try {
      const response = await fetch(proxyUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.text()
    } catch (error) {
      console.error(`Failed to fetch calendar from ${url}:`, error)
      // Try fallback proxies
      const proxies = [
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
      ]

      for (const proxy of proxies) {
        try {
          const response = await fetch(proxy)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          return response.text()
        } catch (proxyError) {
          console.warn(`Calendar proxy failed for ${url}:`, proxyError)
        }
      }

      throw error
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
      const rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const rangeEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      let eventCounter = 0

      for (let i = 0; i < urls.length; i++) {
        try {
          const calendarName = getCalendarName(i + 1)
          const data = await fetchIcs(urls[i])
          const parsed = parseICS(data)
          
          // Debug: Log Family calendar parsing
          if (calendarName === 'Family') {
            console.log(`[Family Calendar] Fetched and parsed ${parsed.length} events`)
            console.log(`[Family Calendar] Date range: ${rangeStart.toDateString()} to ${rangeEnd.toDateString()}`)
          }
          
          parsed.forEach((event: ParsedEvent) => {
            const occurrences = expandRecurringEvent(event, rangeStart, rangeEnd)
            
            // Debug: Log Family calendar expansions
            if (calendarName === 'Family' && event.title) {
              if (occurrences.length > 0) {
                console.log(`[Family Calendar] "${event.title}" expanded to ${occurrences.length} occurrence(s)`)
                occurrences.forEach(occ => {
                  console.log(`  - ${occ.start.toDateString()}`)
                })
              } else if (event.rrule || (event.start.getMonth() === currentDate.getMonth() && event.start.getFullYear() === currentDate.getFullYear())) {
                console.log(`[Family Calendar] "${event.title}" (${event.start.toDateString()}) - NO occurrences in range`)
              }
            }

            occurrences.forEach(occurrence => {
              const startDate = new Date(occurrence.start)
              const endDate = new Date(occurrence.end)
              const daysSpanned = Math.max(
                1,
                Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
              )

              allEvents.push({
                id: `${i}-${occurrence.title}-${occurrence.start.getTime()}-${eventCounter++}`,
                title: occurrence.title,
                start: startDate,
                end: endDate,
                color: calendarColors[i % calendarColors.length],
                calendarIndex: i,
                daysSpanned,
                location: occurrence.location,
              })
            })
          })
        } catch (error) {
          console.error(`Failed to fetch calendar from ${urls[i]}:`, error)
        }
      }

      // Deduplicate events based on title and start time
      const uniqueEvents = allEvents.filter((event, index, self) => {
        return index === self.findIndex((e) => 
          e.title === event.title && 
          e.start.getTime() === event.start.getTime()
        )
      })

      setEvents(uniqueEvents)
    }

    fetchCalendars()
    const interval = setInterval(fetchCalendars, 1 * 60 * 1000) // Refresh every 1 minute
    return () => clearInterval(interval)
  }, [currentDate])

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

  useEffect(() => {
    localStorage.setItem('hiddenCalendars', JSON.stringify(hiddenCalendars))
  }, [hiddenCalendars])

  useEffect(() => {
    localStorage.setItem('calendarViewMode', viewMode)
  }, [viewMode])

  useEffect(() => {
    if (!settingsOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (settingsRef.current?.contains(target)) return
      if (settingsButtonRef.current?.contains(target)) return
      setSettingsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [settingsOpen])

  const goToToday = () => setCurrentDate(new Date())
  const goToPrev = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const day = currentDate.getDate()
    
    if (viewMode === 'monthly') {
      setCurrentDate(new Date(year, month - 1, 1))
    } else if (viewMode === 'weekly') {
      setCurrentDate(new Date(year, month, day - 7))
    } else {
      setCurrentDate(new Date(year, month, day - 1))
    }
  }
  const goToNext = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const day = currentDate.getDate()
    
    if (viewMode === 'monthly') {
      setCurrentDate(new Date(year, month + 1, 1))
    } else if (viewMode === 'weekly') {
      setCurrentDate(new Date(year, month, day + 7))
    } else {
      setCurrentDate(new Date(year, month, day + 1))
    }
  }

  const parseICS = (icsText: string): ParsedEvent[] => {
      // Debug logs
      console.log('--- ICS Parsing Start ---');
      const debugUIDs: string[] = [];
      const debugCancelledUIDs: string[] = [];
    const events: ParsedEvent[] = [];
    const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    const cancelledUIDs: Set<string> = new Set();

    // First pass: collect cancelled UIDs
    let currentEvent: { uid?: string, status?: string } = {};
    let inEvent = false;
    for (const line of lines) {
            // Log UID and STATUS in first pass
            if (trimmed.startsWith('UID:')) {
              debugUIDs.push(trimmed.substring(4));
            }
            if (trimmed.startsWith('STATUS:')) {
              console.log('STATUS:', trimmed.substring(7));
            }
      const trimmed = line.trim();
      if (trimmed === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = {};
      } else if (trimmed === 'END:VEVENT') {
        if (currentEvent.status === 'CANCELLED' && currentEvent.uid) {
            debugCancelledUIDs.push(currentEvent.uid);
            console.log('Cancelled UID:', currentEvent.uid);
                // Log UID and STATUS in second pass
                if (trimmed.startsWith('UID:')) {
                  console.log('Event UID:', trimmed.substring(4));
                }
                if (trimmed.startsWith('STATUS:')) {
                  console.log('Event STATUS:', trimmed.substring(7));
                }
          cancelledUIDs.add(currentEvent.uid);
        }
        inEvent = false;
      } else if (inEvent) {
        if (trimmed.startsWith('UID:')) {
          currentEvent.uid = trimmed.substring(4);
        } else if (trimmed.startsWith('STATUS:')) {
          currentEvent.status = trimmed.substring(7);
        }
      }
    }

    // Second pass: add only non-cancelled events
    let eventObj: Partial<ParsedEvent> & { durationMs?: number, uid?: string, status?: string } = {};
    inEvent = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'BEGIN:VEVENT') {
        inEvent = true;
        eventObj = {};
      } else if (trimmed === 'END:VEVENT') {
        if (
          eventObj.title && eventObj.start &&
          (!eventObj.uid || !cancelledUIDs.has(eventObj.uid)) &&
          eventObj.status !== 'CANCELLED'
        ) {
          console.log('Adding event:', eventObj.title, 'UID:', eventObj.uid, 'STATUS:', eventObj.status);
        ) {
          let endDate = eventObj.end;
          if (!endDate) {
            if (eventObj.durationMs) {
              endDate = new Date(eventObj.start.getTime() + eventObj.durationMs);
            } else if (eventObj.allDay) {
              endDate = addDays(eventObj.start, 1);
            } else {
              endDate = new Date(eventObj.start.getTime() + 60 * 60 * 1000);
            }
          }
          events.push({
            title: eventObj.title,
            start: eventObj.start,
            end: endDate,
            rrule: eventObj.rrule,
            allDay: eventObj.allDay,
            location: eventObj.location,
          });
        }
        inEvent = false;
      } else if (inEvent) {
        if (trimmed.startsWith('SUMMARY:')) {
          eventObj.title = trimmed.substring(8);
        } else if (trimmed.startsWith('DTSTART')) {
          const dateStr = trimmed.split(':').slice(1).join(':');
          eventObj.allDay = trimmed.includes('VALUE=DATE');
          eventObj.start = parseICSDate(dateStr);
        } else if (trimmed.startsWith('DTEND')) {
          const dateStr = trimmed.split(':').slice(1).join(':');
          eventObj.allDay = eventObj.allDay ?? trimmed.includes('VALUE=DATE');
          eventObj.end = parseICSDate(dateStr);
        } else if (trimmed.startsWith('RRULE:')) {
          eventObj.rrule = trimmed.substring(6);
        } else if (trimmed.startsWith('DURATION:')) {
          const durationStr = trimmed.substring(9);
          eventObj.durationMs = parseDurationMs(durationStr);
        } else if (trimmed.startsWith('LOCATION:')) {
          const rawLocation = trimmed.substring(9);
          eventObj.location = rawLocation
            .replace(/\\n/g, ', ')
            .replace(/\\,/g, ',')
            .replace(/\\\\/g, '\\')
            .trim();
        } else if (trimmed.startsWith('UID:')) {
          eventObj.uid = trimmed.substring(4);
        } else if (trimmed.startsWith('STATUS:')) {
          eventObj.status = trimmed.substring(7);
        }
      }
    }

    return events;
  }

  const expandRecurringEvent = (
    event: ParsedEvent,
    rangeStart: Date,
    rangeEnd: Date
  ): ParsedEvent[] => {
    if (!event.rrule) {
      return eventInRange(event, rangeStart, rangeEnd) ? [event] : []
    }

    const rule = parseRRule(event.rrule)
    if (!rule.freq) {
      return eventInRange(event, rangeStart, rangeEnd) ? [event] : []
    }

    const occurrences: ParsedEvent[] = []
    const durationMs = event.end.getTime() - event.start.getTime()
    const interval = rule.interval ?? 1
    const until = rule.until

    if (rule.freq === 'DAILY') {
      let cursor = new Date(event.start)
      let count = 0
      while (cursor < rangeEnd) {
        if (until && cursor > until) break
        if (cursor >= rangeStart) {
          occurrences.push({
            title: event.title,
            start: new Date(cursor),
            end: new Date(cursor.getTime() + durationMs),
          })
        }
        count += 1
        if (rule.count && count >= rule.count) break
        cursor = addDays(cursor, interval)
      }
      return occurrences
    }

    if (rule.freq === 'MONTHLY') {
      const startMonthIndex = event.start.getFullYear() * 12 + event.start.getMonth()
      const rangeStartIndex = rangeStart.getFullYear() * 12 + rangeStart.getMonth()
      const rangeEndIndex = rangeEnd.getFullYear() * 12 + rangeEnd.getMonth()
      let count = 0

      for (let monthIndex = rangeStartIndex; monthIndex <= rangeEndIndex; monthIndex += 1) {
        if ((monthIndex - startMonthIndex) % interval !== 0) continue
        const year = Math.floor(monthIndex / 12)
        const month = monthIndex % 12

        if (rule.byday && rule.byday.length > 0) {
          for (const entry of rule.byday) {
            const parsed = parseByDayEntry(entry)
            if (!parsed) continue
            const occDate = getNthWeekdayOfMonth(year, month, weekdayToIndex(parsed.day), parsed.ordinal)
            if (!occDate) continue
            occDate.setHours(
              event.start.getHours(),
              event.start.getMinutes(),
              event.start.getSeconds(),
              event.start.getMilliseconds()
            )

            if (occDate < event.start) continue
            if (until && occDate > until) continue
            if (occDate >= rangeStart && occDate < rangeEnd) {
              occurrences.push({
                title: event.title,
                start: new Date(occDate),
                end: new Date(occDate.getTime() + durationMs),
                location: event.location,
              })
              count += 1
              if (rule.count && count >= rule.count) return occurrences
            }
          }
        } else {
          const cursor = new Date(year, month, event.start.getDate())
          cursor.setHours(
            event.start.getHours(),
            event.start.getMinutes(),
            event.start.getSeconds(),
            event.start.getMilliseconds()
          )
          if (cursor < event.start) continue
          if (until && cursor > until) continue
          if (cursor >= rangeStart && cursor < rangeEnd) {
            occurrences.push({
              title: event.title,
              start: new Date(cursor),
              end: new Date(cursor.getTime() + durationMs),
              location: event.location,
            })
            count += 1
            if (rule.count && count >= rule.count) return occurrences
          }
        }
      }

      return occurrences
    }

    if (rule.freq === 'WEEKLY') {
      const byDays = rule.byday?.length
        ? (rule.byday.map(entry => parseByDayEntry(entry)?.day).filter(Boolean) as string[])
        : [weekdayToRrule(event.start.getDay())]
      const rangeCursorStart = new Date(rangeStart)
      rangeCursorStart.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds(), event.start.getMilliseconds())

      let dayCursor = new Date(rangeCursorStart)
      while (dayCursor < rangeEnd) {
        if (until && dayCursor > until) break
        const weeksDiff = Math.floor((dayCursor.getTime() - event.start.getTime()) / (7 * 24 * 60 * 60 * 1000))
        if (weeksDiff >= 0 && weeksDiff % interval === 0) {
          const dayCode = weekdayToRrule(dayCursor.getDay())
          if (byDays.includes(dayCode)) {
            const occStart = new Date(dayCursor)
            if (occStart >= event.start) {
              occurrences.push({
                title: event.title,
                start: new Date(occStart),
                end: new Date(occStart.getTime() + durationMs),
                location: event.location,
              })
            }
          }
        }
        dayCursor = addDays(dayCursor, 1)
      }
      return occurrences
    }

    if (rule.freq === 'YEARLY') {
      const startYear = event.start.getFullYear()
      const rangeStartYear = rangeStart.getFullYear()
      const rangeEndYear = rangeEnd.getFullYear()
      let count = 0

      for (let year = rangeStartYear; year <= rangeEndYear; year++) {
        if ((year - startYear) % interval !== 0) continue

        let occDate: Date | null = null

        if (rule.byday && rule.byday.length > 0 && rule.bymonth) {
          // Handle BYDAY with BYMONTH (e.g., 2nd Sunday of November)
          for (const entry of rule.byday) {
            const parsed = parseByDayEntry(entry)
            if (!parsed) continue
            const month = rule.bymonth[0] - 1 // Convert to 0-indexed
            occDate = getNthWeekdayOfMonth(year, month, weekdayToIndex(parsed.day), parsed.ordinal)
            if (!occDate) continue
            occDate.setHours(
              event.start.getHours(),
              event.start.getMinutes(),
              event.start.getSeconds(),
              event.start.getMilliseconds()
            )

            if (occDate < event.start) continue
            if (until && occDate > until) continue
            if (occDate >= rangeStart && occDate < rangeEnd) {
              occurrences.push({
                title: event.title,
                start: new Date(occDate),
                end: new Date(occDate.getTime() + durationMs),
                location: event.location,
              })
              count += 1
              if (rule.count && count >= rule.count) return occurrences
            }
          }
        } else {
          // Simple yearly: same month and day
          occDate = new Date(
            year,
            event.start.getMonth(),
            event.start.getDate(),
            event.start.getHours(),
            event.start.getMinutes(),
            event.start.getSeconds(),
            event.start.getMilliseconds()
          )

          if (occDate < event.start) continue
          if (until && occDate > until) continue
          if (occDate >= rangeStart && occDate < rangeEnd) {
            occurrences.push({
              title: event.title,
              start: new Date(occDate),
              end: new Date(occDate.getTime() + durationMs),
              location: event.location,
            })
            count += 1
            if (rule.count && count >= rule.count) return occurrences
          }
        }
      }

      return occurrences
    }

    return eventInRange(event, rangeStart, rangeEnd) ? [event] : []
  }

  const eventInRange = (event: ParsedEvent, rangeStart: Date, rangeEnd: Date) => {
    return event.start < rangeEnd && event.end > rangeStart
  }

  const parseRRule = (rrule: string) => {
    const parts = rrule.split(';')
    const data: { freq?: string; interval?: number; until?: Date; count?: number; byday?: string[]; bymonth?: number[] } = {}

    parts.forEach(part => {
      const [key, value] = part.split('=')
      if (!key || !value) return
      if (key === 'FREQ') data.freq = value
      if (key === 'INTERVAL') data.interval = Number(value)
      if (key === 'COUNT') data.count = Number(value)
      if (key === 'UNTIL') data.until = parseICSDate(value)
      if (key === 'BYDAY') data.byday = value.split(',')
      if (key === 'BYMONTH') data.bymonth = value.split(',').map(m => Number(m))
    })

    return data
  }

  const addDays = (date: Date, days: number) => {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
  }

  const parseByDayEntry = (entry: string) => {
    const match = entry.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/)
    if (!match) return null
    const ordinal = match[1] ? Number(match[1]) : undefined
    return { ordinal, day: match[2] }
  }

  const weekdayToIndex = (day: string) => {
    return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(day)
  }

  const getNthWeekdayOfMonth = (
    year: number,
    month: number,
    weekdayIndex: number,
    ordinal?: number
  ) => {
    if (weekdayIndex < 0) return null
    if (!ordinal) {
      ordinal = 1
    }

    if (ordinal > 0) {
      const firstOfMonth = new Date(year, month, 1)
      const firstWeekdayOffset = (weekdayIndex - firstOfMonth.getDay() + 7) % 7
      const day = 1 + firstWeekdayOffset + (ordinal - 1) * 7
      const candidate = new Date(year, month, day)
      return candidate.getMonth() === month ? candidate : null
    }

    const lastOfMonth = new Date(year, month + 1, 0)
    const lastWeekdayOffset = (lastOfMonth.getDay() - weekdayIndex + 7) % 7
    const day = lastOfMonth.getDate() - lastWeekdayOffset + (ordinal + 1) * 7
    const candidate = new Date(year, month, day)
    return candidate.getMonth() === month ? candidate : null
  }

  const weekdayToRrule = (day: number) => {
    return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][day]
  }

  const parseICSDate = (dateStr: string): Date => {
    // Handle both YYYYMMDD and YYYYMMDDTHHMMSS formats
    const isUTC = dateStr.endsWith('Z')
    const normalized = dateStr.replace(/Z$/, '')
    if (normalized.includes('T')) {
      const [date, time] = normalized.split('T')
      const year = parseInt(date.substring(0, 4))
      const month = parseInt(date.substring(4, 6)) - 1
      const day = parseInt(date.substring(6, 8))
      const hours = parseInt(time.substring(0, 2))
      const minutes = parseInt(time.substring(2, 4))
      const seconds = parseInt(time.substring(4, 6))
      
      if (isUTC) {
        // Use UTC constructor and let JavaScript convert to local time
        return new Date(Date.UTC(year, month, day, hours, minutes, seconds))
      }
      return new Date(year, month, day, hours, minutes, seconds)
    } else {
      const year = parseInt(normalized.substring(0, 4))
      const month = parseInt(normalized.substring(4, 6)) - 1
      const day = parseInt(normalized.substring(6, 8))
      return new Date(year, month, day)
    }
  }

  const parseDurationMs = (duration: string): number => {
    // Supports formats like P1D, PT2H, PT30M, P1DT2H30M
    const match = duration.match(
      /P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/
    )
    if (!match) return 0
    const days = Number(match[1] ?? 0)
    const hours = Number(match[2] ?? 0)
    const minutes = Number(match[3] ?? 0)
    const seconds = Number(match[4] ?? 0)
    return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000
  }

  const getEventsForDay = (day: number): CalendarEvent[] => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const targetDate = new Date(year, month, day)
    targetDate.setHours(0, 0, 0, 0)

    const filteredEvents = events.filter(event => {
      if (hiddenCalendars.includes(event.calendarIndex)) {
        return false
      }
      
      // Skip all-day events (they're shown as spanning bars)
      if (isAllDayEvent(event)) {
        return false
      }
      
      const eventStart = new Date(event.start)
      const eventEnd = new Date(event.end)
      eventStart.setHours(0, 0, 0, 0)
      eventEnd.setHours(0, 0, 0, 0)
      
      // Skip multi-day events (they're shown in the multi-day section)
      const sameDay = eventStart.toDateString() === getAdjustedEndDate(event.end).toDateString()
      if (!sameDay || event.daysSpanned > 1) {
        return false
      }
      
      if (eventEnd.getTime() === eventStart.getTime()) {
        return targetDate.getTime() === eventStart.getTime()
      }
      return targetDate >= eventStart && targetDate < eventEnd
    })

    // Sort events by start time
    return filteredEvents.sort((a, b) => a.start.getTime() - b.start.getTime())
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
  
  // Generate title label based on view mode
  let titleLabel = ''
  if (viewMode === 'monthly') {
    titleLabel = `${monthShort} 1 - ${monthShort} ${lastDayOfMonth}, ${year}`
  } else if (viewMode === 'weekly') {
    const dayOfWeek = currentDate.getDay()
    const weekStart = new Date(currentDate)
    weekStart.setDate(currentDate.getDate() - dayOfWeek)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    
    const startMonth = weekStart.toLocaleString('en-US', { month: 'short' })
    const endMonth = weekEnd.toLocaleString('en-US', { month: 'short' })
    
    if (startMonth === endMonth) {
      titleLabel = `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
    } else {
      titleLabel = `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
    }
  } else {
    // daily view
    titleLabel = currentDate.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  
  const monthStart = new Date(year, currentDate.getMonth(), 1)
  const monthEnd = new Date(year, currentDate.getMonth(), lastDayOfMonth, 23, 59, 59, 999)
  const calendarUrlsStr = import.meta.env?.VITE_CALENDAR_URLS as string | undefined
  const calendarUrls = calendarUrlsStr ? calendarUrlsStr.split(',').map(u => u.trim()) : []
  const calendarColors = getCalendarColors(calendarUrls.length)
  const calendarNames = calendarUrls.map((_, index) => getCalendarName(index + 1))

  const getAdjustedEndDate = (date: Date) => {
    const adjusted = new Date(date)
    if (
      adjusted.getHours() === 0 &&
      adjusted.getMinutes() === 0 &&
      adjusted.getSeconds() === 0 &&
      adjusted.getMilliseconds() === 0
    ) {
      adjusted.setDate(adjusted.getDate() - 1)
    }
    return adjusted
  }

  // Helper to check if event is all-day
  const isAllDayEvent = (event: CalendarEvent): boolean => {
    const start = event.start
    const end = event.end
    return (
      start.getHours() === 0 &&
      start.getMinutes() === 0 &&
      end.getHours() === 0 &&
      end.getMinutes() === 0 &&
      event.daysSpanned >= 1
    )
  }

  const formatEventTime = (event: CalendarEvent): string => {
    const start = event.start
    const end = event.end
    const startHours = start.getHours()
    const startMinutes = start.getMinutes()
    const endHours = end.getHours()
    const endMinutes = end.getMinutes()

    const isAllDay =
      startHours === 0 &&
      startMinutes === 0 &&
      endHours === 0 &&
      endMinutes === 0 &&
      event.daysSpanned >= 1

    if (isAllDay) return 'All day'

    const startHour12 = startHours % 12 || 12
    const startMinuteText = startMinutes === 0 ? '' : `:${String(startMinutes).padStart(2, '0')}`
    const startSuffix = startHours >= 12 ? 'pm' : 'am'
    
    const endHour12 = endHours % 12 || 12
    const endMinuteText = endMinutes === 0 ? '' : `:${String(endMinutes).padStart(2, '0')}`
    const endSuffix = endHours >= 12 ? 'pm' : 'am'
    
    return `${startHour12}${startMinuteText}${startSuffix} - ${endHour12}${endMinuteText}${endSuffix}`
  }

  const formatEventStartTime = (event: CalendarEvent): string => {
    const start = event.start
    const startHours = start.getHours()
    const startMinutes = start.getMinutes()

    const isAllDay =
      startHours === 0 &&
      startMinutes === 0 &&
      event.daysSpanned >= 1

    if (isAllDay) return 'All day'

    const startHour12 = startHours % 12 || 12
    const startMinuteText = startMinutes === 0 ? '' : `:${String(startMinutes).padStart(2, '0')}`
    const startSuffix = startHours >= 12 ? 'pm' : 'am'
    
    return `${startHour12}${startMinuteText}${startSuffix}`
  }

  const buildMultiDaySegments = () => {
    type Segment = {
      id: string
      title: string
      color: string
      weekIndex: number
      startCol: number
      span: number
    }

    const segments: Segment[] = []

    events.forEach(event => {
      if (hiddenCalendars.includes(event.calendarIndex)) return
      const eventStart = new Date(event.start)
      const eventEnd = getAdjustedEndDate(event.end)
      const sameDay = eventStart.toDateString() === eventEnd.toDateString()

      // Include multi-day events or all-day events (even if single-day)
      if (sameDay && event.daysSpanned <= 1 && !isAllDayEvent(event)) return

      if (eventEnd < monthStart || eventStart > monthEnd) return

      const startDay = eventStart < monthStart ? 1 : eventStart.getDate()
      const endDay = eventEnd > monthEnd ? lastDayOfMonth : eventEnd.getDate()

      if (endDay < startDay) return

      let dayCursor = startDay
      while (dayCursor <= endDay) {
        const dayIndex = firstDayOffset + (dayCursor - 1)
        const weekIndex = Math.floor(dayIndex / 7)
        const weekStartDay = weekIndex * 7 - firstDayOffset + 1
        const weekEndDay = weekStartDay + 6
        const segmentStartDay = dayCursor
        const segmentEndDay = Math.min(endDay, weekEndDay)
        const startCol = (firstDayOffset + (segmentStartDay - 1)) % 7
        const span = segmentEndDay - segmentStartDay + 1

        segments.push({
          id: `${event.id}-${segmentStartDay}`,
          title: event.title,
          color: event.color,
          weekIndex,
          startCol,
          span,
        })

        dayCursor = segmentEndDay + 1
      }
    })

    return segments
  }

  const buildWeekLanes = (segments: ReturnType<typeof buildMultiDaySegments>) => {
    const sorted = [...segments].sort((a, b) => a.startCol - b.startCol || b.span - a.span)
    const lanes: typeof sorted[] = []
    const laneEnds: number[] = []

    sorted.forEach(segment => {
      let laneIndex = laneEnds.findIndex(end => segment.startCol > end)
      if (laneIndex === -1) {
        laneIndex = laneEnds.length
        laneEnds.push(segment.startCol + segment.span - 1)
        lanes.push([segment])
        return
      }

      laneEnds[laneIndex] = segment.startCol + segment.span - 1
      lanes[laneIndex].push(segment)
    })

    return lanes
  }

  const totalSlots = firstDayOffset + daysInMonth.length
  const weekCount = Math.ceil(totalSlots / 7)
  const weeks = Array.from({ length: weekCount }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const dayNumber = weekIndex * 7 + dayIndex - firstDayOffset + 1
      return dayNumber >= 1 && dayNumber <= daysInMonth.length ? dayNumber : null
    })
  )

  const multiDaySegments = buildMultiDaySegments()
  const segmentsByWeek = multiDaySegments.reduce<Record<number, typeof multiDaySegments>>(
    (acc, segment) => {
      if (!acc[segment.weekIndex]) acc[segment.weekIndex] = []
      acc[segment.weekIndex].push(segment)
      return acc
    },
    {}
  )

  // Helper function for weekly view
  const getWeekDays = () => {
    const dayOfWeek = currentDate.getDay()
    const weekStart = new Date(currentDate)
    weekStart.setDate(currentDate.getDate() - dayOfWeek)
    
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + i)
      return day
    })
  }

  // Helper function to get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    return events.filter(event => {
      if (hiddenCalendars.includes(event.calendarIndex)) {
        return false
      }
      const eventStart = new Date(event.start)
      const eventEnd = new Date(event.end)
      
      // Check if event overlaps with this day at all
      // Event overlaps if it starts before the end of this day AND ends after the start of this day
      return eventStart < nextDay && eventEnd > targetDate
    }).sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  // Helper function to check if a date is today
  const isDateToday = (date: Date): boolean => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  // Helper to get hour slots for timeline view (00:00 to 23:00)
  const getHourSlots = () => {
    return Array.from({ length: 24 }, (_, i) => i)
  }

  const formatHourLabel = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 === 0 ? 12 : hour % 12
    return `${hour12} ${period}`
  }

  // Helper to get event position and height in timeline
  const getEventTimelinePosition = (event: CalendarEvent, date: Date) => {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    const eventStart = new Date(event.start)
    const eventEnd = new Date(event.end)

    // Clamp to the day boundaries
    const displayStart = eventStart < dayStart ? dayStart : eventStart
    const displayEnd = eventEnd > dayEnd ? dayEnd : eventEnd

    const startMinutes = displayStart.getHours() * 60 + displayStart.getMinutes()
    const endMinutes = displayEnd.getHours() * 60 + displayEnd.getMinutes()
    const durationMinutes = endMinutes - startMinutes

    return {
      top: (startMinutes / 60) * 60, // 60px per hour
      height: Math.max((durationMinutes / 60) * 60, 30), // minimum 30px
      startMinutes,
      endMinutes,
    }
  }

  // Helper to check if two events overlap
  const eventsOverlap = (event1: CalendarEvent, event2: CalendarEvent, date: Date): boolean => {
    const pos1 = getEventTimelinePosition(event1, date)
    const pos2 = getEventTimelinePosition(event2, date)
    return pos1.startMinutes < pos2.endMinutes && pos2.startMinutes < pos1.endMinutes
  }

  // Helper to assign events to columns to avoid overlap
  const layoutEventsInColumns = (events: CalendarEvent[], date: Date) => {
    if (events.length === 0) return []

    // Sort events by start time, then by duration (longer first)
    const sortedEvents = [...events].sort((a, b) => {
      const aPos = getEventTimelinePosition(a, date)
      const bPos = getEventTimelinePosition(b, date)
      if (aPos.startMinutes !== bPos.startMinutes) {
        return aPos.startMinutes - bPos.startMinutes
      }
      return bPos.height - aPos.height
    })

    const columns: CalendarEvent[][] = []
    const eventColumns: Map<string, number> = new Map()

    for (const event of sortedEvents) {
      let placed = false
      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const column = columns[colIndex]
        const hasOverlap = column.some(e => eventsOverlap(e, event, date))
        if (!hasOverlap) {
          column.push(event)
          eventColumns.set(event.id, colIndex)
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([event])
        eventColumns.set(event.id, columns.length - 1)
      }
    }

    return sortedEvents.map(event => ({
      event,
      column: eventColumns.get(event.id) || 0,
      totalColumns: columns.length,
    }))
  }

  // Helper to get current time position
  const getCurrentTimePosition = (): number => {
    const now = new Date()
    const minutes = now.getHours() * 60 + now.getMinutes()
    return (minutes / 60) * 60 + 60 // 60px per hour + all-day row height
  }

  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        {viewMode !== 'monthly' && <h2 className="calendar-title">{titleLabel}</h2>}
        <div className="calendar-controls">
          <button
            className="calendar-btn icon"
            aria-label="Settings"
            aria-pressed={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
            ref={settingsButtonRef}
          >
            ⚙︎
          </button>
          {settingsOpen && (
            <div
              className="calendar-settings"
              role="dialog"
              aria-label="Calendar settings"
              ref={settingsRef}
            >
              <div className="settings-title">Navigate</div>
              <div className="settings-nav-buttons">
                <button 
                  className="calendar-btn nav" 
                  onClick={() => {
                    goToPrev()
                    setSettingsOpen(false)
                  }} 
                  aria-label={`Previous ${viewMode === 'monthly' ? 'month' : viewMode === 'weekly' ? 'week' : 'day'}`}
                >
                  ← Prev
                </button>
                <button 
                  className="calendar-btn nav" 
                  onClick={() => {
                    goToToday()
                    setSettingsOpen(false)
                  }} 
                  aria-label="Go to today"
                >
                  Today
                </button>
                <button 
                  className="calendar-btn nav" 
                  onClick={() => {
                    goToNext()
                    setSettingsOpen(false)
                  }} 
                  aria-label={`Next ${viewMode === 'monthly' ? 'month' : viewMode === 'weekly' ? 'week' : 'day'}`}
                >
                  Next →
                </button>
              </div>
              <div className="settings-title">View</div>
              <div className="settings-view-modes">
                <button
                  className={`view-mode-btn ${viewMode === 'monthly' ? 'active' : ''}`}
                  onClick={() => {
                    setViewMode('monthly')
                    setSettingsOpen(false)
                  }}
                  aria-pressed={viewMode === 'monthly'}
                >
                  Monthly
                </button>
                <button
                  className={`view-mode-btn ${viewMode === 'weekly' ? 'active' : ''}`}
                  onClick={() => {
                    setViewMode('weekly')
                    setSettingsOpen(false)
                  }}
                  aria-pressed={viewMode === 'weekly'}
                >
                  Weekly
                </button>
                <button
                  className={`view-mode-btn ${viewMode === 'daily' ? 'active' : ''}`}
                  onClick={() => {
                    setViewMode('daily')
                    setSettingsOpen(false)
                  }}
                  aria-pressed={viewMode === 'daily'}
                >
                  Daily
                </button>
              </div>
              <div className="settings-title">Calendars</div>
              <div className="settings-list">
                {calendarUrls.length === 0 ? (
                  <div className="settings-empty">No calendars configured</div>
                ) : (
                  calendarUrls.map((_, index) => {
                    const isHidden = hiddenCalendars.includes(index)
                    const color = calendarColors[index % calendarColors.length]
                    const name = calendarNames[index]

                    return (
                      <label
                        key={`calendar-setting-${index}`}
                        className={`settings-row ${isHidden ? 'is-hidden' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          onChange={() => toggleCalendarVisibility(index)}
                          aria-label={`Toggle ${name}`}
                        />
                        <span className="settings-color" style={{ backgroundColor: color }}></span>
                        <span className="settings-name">{name}</span>
                      </label>
                    )
                  })
                )}
              </div>
              <div className="settings-title">Theme</div>
              <div className="settings-view-modes">
                <button
                  className={`view-mode-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => toggleTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  Dark
                </button>
                <button
                  className={`view-mode-btn ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => toggleTheme('light')}
                  aria-pressed={theme === 'light'}
                >
                  Light
                </button>
                <button
                  className={`view-mode-btn ${theme === 'auto' ? 'active' : ''}`}
                  onClick={() => toggleTheme('auto')}
                  aria-pressed={theme === 'auto'}
                >
                  Auto
                </button>
              </div>
              {import.meta.env.DEV && (
                <>
                  <div className="settings-title">Testing</div>
                  <div className="settings-view-modes">
                    <button
                      className={`view-mode-btn ${manualAlertActive ? 'active' : ''}`}
                      onClick={onToggleManualAlert}
                      aria-pressed={manualAlertActive}
                    >
                      {manualAlertActive ? '✓ Test Alert' : '+ Test Alert'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {viewMode === 'monthly' && (
        <div className="calendar-grid">
          <div className="calendar-header">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
              <div key={day} className="calendar-header-cell">{day}</div>
            ))}
          </div>

          {weeks.map((week, weekIndex) => {
            const weekSegments = segmentsByWeek[weekIndex] ?? []
            const weekLanes = buildWeekLanes(weekSegments).slice(0, 2)

            return (
              <div key={`week-${weekIndex}`} className="calendar-week">
                <div className="week-multiday">
                  {weekLanes.map((lane, laneIndex) =>
                    lane.map(segment => (
                      <div
                        key={segment.id}
                        className="multiday-pill"
                        style={{
                          gridColumn: `${segment.startCol + 1} / span ${segment.span}`,
                          gridRow: `${laneIndex + 1}`,
                          backgroundColor: segment.color,
                        }}
                        title={segment.title}
                      >
                        <span className="multiday-title">{segment.title}</span>
                      </div>
                    ))
                  )}
                </div>
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <div key={`empty-${weekIndex}-${dayIndex}`} className="calendar-cell empty"></div>
                  }

                  const dayEvents = getEventsForDay(day)
                  const isTodayFlag = isToday(day)
                  const shouldScroll = dayEvents.length > 3

                  return (
                    <div
                      key={day}
                      className={`calendar-cell ${isTodayFlag ? 'today' : ''}`}
                    >
                      <div className="day-number">
                        <span className="day-date">{day}</span>
                      </div>
                      <div className={`day-events ${shouldScroll ? 'scrollable' : ''}`}>
                        {dayEvents.map(event => (
                          <div
                            key={event.id}
                            className="event-row"
                            title={event.title}
                          >
                            <span className="event-dot" style={{ backgroundColor: event.color }}></span>
                            <span className="event-time">{formatEventStartTime(event)}</span>
                            <span className="event-title">{event.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
      
      {viewMode === 'weekly' && (
        <div className="calendar-grid weekly-timeline">
          <div className="timeline-header">
            <div className="timeline-header-corner"></div>
            {getWeekDays().map((date, index) => {
              const isTodayFlag = isDateToday(date)
              return (
                <div key={index} className={`timeline-header-day ${isTodayFlag ? 'today' : ''}`}>
                  <div className="timeline-day-name">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index]} <span className="timeline-day-num">{date.getDate()}</span></div>
                </div>
              )
            })}
          </div>
          <div className="timeline-body">
            <div className="timeline-hours">
              <div className="timeline-all-day-label">all-day</div>
              {getHourSlots().map(hour => (
                <div key={hour} className="timeline-hour-label">
                  {formatHourLabel(hour)}
                </div>
              ))}
            </div>
            <div className="timeline-grid">
              {/* All-day events row */}
              <div className="timeline-all-day-row">
                {getWeekDays().map((date, dayIndex) => {
                  const dayEvents = getEventsForDate(date).filter(e => isAllDayEvent(e))
                  return (
                    <div key={dayIndex} className="timeline-all-day-cell">
                      {dayEvents.map(event => (
                        <div
                          key={event.id}
                          className="timeline-all-day-event"
                          style={{ backgroundColor: event.color }}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
              {/* Time grid */}
              <div className="timeline-time-grid">
                {getHourSlots().map(hour => (
                  <div key={hour} className="timeline-hour-row">
                    {getWeekDays().map((_date, dayIndex) => (
                      <div key={dayIndex} className="timeline-hour-cell"></div>
                    ))}
                  </div>
                ))}
              </div>
              {/* Events overlay */}
              <div className="timeline-events-overlay">
                {getWeekDays().map((date, dayIndex) => {
                  const dayEvents = getEventsForDate(date).filter(e => !isAllDayEvent(e))
                  const layoutedEvents = layoutEventsInColumns(dayEvents, date)
                  return (
                    <div key={dayIndex} className="timeline-day-events" style={{ left: `${(dayIndex / 7) * 100}%` }}>
                      {layoutedEvents.map(({ event, column, totalColumns }) => {
                        const position = getEventTimelinePosition(event, date)
                        const columnWidth = 100 / totalColumns
                        const leftOffset = column * columnWidth
                        return (
                          <div
                            key={event.id}
                            className="timeline-event"
                            style={{
                              top: `${position.top}px`,
                              height: `${position.height}px`,
                              left: `${leftOffset}%`,
                              width: `${columnWidth}%`,
                              backgroundColor: event.color,
                            }}
                            title={event.title}
                          >
                            <div className="timeline-event-time">{formatEventTime(event)}</div>
                            <div className="timeline-event-title">{event.title}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
              {/* Current time marker */}
              <div 
                className="timeline-current-time" 
                style={{ top: `${getCurrentTimePosition()}px` }}
              >
                <div className="timeline-current-time-dot"></div>
                <div className="timeline-current-time-line"></div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {viewMode === 'daily' && (
        <div className="calendar-grid daily-view">
          <div className="daily-header">
            <div className="daily-date">
              {currentDate.toLocaleString('en-US', { weekday: 'long' })} {currentDate.getDate()}
            </div>
          </div>
          <div className="daily-events">
            {getEventsForDate(currentDate).map(event => (
              <div
                key={event.id}
                className="daily-event-row"
                style={{ borderLeftColor: event.color }}
              >
                <div className="daily-event-time">{formatEventTime(event)}</div>
                <div className="daily-event-details">
                  <div className="daily-event-title">{event.title}</div>
                  {event.location && <div className="daily-event-location">{event.location}</div>}
                </div>
              </div>
            ))}
            {getEventsForDate(currentDate).length === 0 && (
              <div className="daily-no-events">No events scheduled</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
