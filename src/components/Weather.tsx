import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import '../styles/Weather.css'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const LAT = 33.9671
const LON = -83.2807
const ZOOM = 7
const FRAME_INTERVAL_MS = 500

function AnimatedRadar() {
  const [frames, setFrames] = useState<string[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const owApiKey = import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined
  const lightningUrl = owApiKey
    ? `https://tile.openweathermap.org/map/lightning_distance/{z}/{x}/{y}.png?appid=${owApiKey}`
    : null

  useEffect(() => {
    let cancelled = false
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const host: string = data?.host ?? 'https://tilecache.rainviewer.com'
        const past: any[] = data?.radar?.past ?? []
        const nowcast: any[] = data?.radar?.nowcast ?? []
        const all = [...past, ...nowcast].filter(f => f?.path)
        if (all.length === 0) { setStatus('error'); return }
        setFrames(all.map(f => `${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`))
        setStatus('ready')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (status !== 'ready' || frames.length < 2) return
    intervalRef.current = setInterval(() => {
      setFrameIndex(i => (i + 1) % frames.length)
    }, FRAME_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [status, frames])

  if (status === 'loading') {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9aa4b2' }}>Loading radar...</div>
  }
  if (status === 'error') {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9aa4b2' }}>Radar unavailable</div>
  }

  return (
    <MapContainer
      center={[LAT, LON]}
      zoom={ZOOM}
      dragging={false}
      touchZoom={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomControl={false}
      attributionControl={false}
      style={{ width: '100%', height: '100%', minHeight: 300, borderRadius: '16px' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />
      {frames[frameIndex] && (
        <TileLayer
          key={frames[frameIndex]}
          url={frames[frameIndex]}
          opacity={0.75}
          zIndex={10}
          maxNativeZoom={7}
          maxZoom={7}
        />
      )}
      {lightningUrl && (
        <TileLayer
          url={lightningUrl}
          opacity={0.9}
          zIndex={20}
          maxNativeZoom={7}
          maxZoom={7}
        />
      )}
    </MapContainer>
  )
}

interface WeatherData {
  temp: number
  feelsLike: number
  min: number
  max: number
  pressure: number
  humidity: number
  windSpeed: number
  windDeg: number
  windGust?: number
  visibility: number
  dewPoint?: number
  clouds: number
  pop?: number
  rain?: number
  snow?: number
  condition: string
  description: string
  icon: string
}

interface ForecastDay {
  date: string
  high: number
  low: number
  pressure: number
  humidity: number
  windSpeed: number
  windDeg: number
  windGust?: number
  visibility: number
  dewPoint?: number
  clouds: number
  pop?: number
  rain?: number
  snow?: number
  condition: string
  description: string
  icon: string
}

interface WeatherAlert {
  event: string
  description: string
  start: number
  end: number
  senderName: string
}

const WEATHER_TIME_ZONE = 'America/New_York'

const getDateKeyFromUnix = (timestampSeconds: number, timezoneOffsetSeconds: number): string => {
  const shifted = new Date((timestampSeconds + timezoneOffsetSeconds) * 1000)
  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getLocalHourFromUnix = (timestampSeconds: number, timezoneOffsetSeconds: number): number => {
  return new Date((timestampSeconds + timezoneOffsetSeconds) * 1000).getUTCHours()
}

const getDailyIconScore = (timestampSeconds: number, timezoneOffsetSeconds: number): number => {
  return Math.abs(getLocalHourFromUnix(timestampSeconds, timezoneOffsetSeconds) - 14)
}

const formatForecastDate = (dateKey: string, options: Intl.DateTimeFormatOptions): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const stableDate = new Date(year, month - 1, day, 12)
  return stableDate.toLocaleDateString('en-US', { ...options, timeZone: WEATHER_TIME_ZONE })
}


type WeatherVariant = 'compact' | 'full'

interface WeatherProps {
  variant?: WeatherVariant
}

export default function Weather({ variant = 'full' }: WeatherProps) {
  const [current, setCurrent] = useState<WeatherData | null>(null)
  const [forecast, setForecast] = useState<ForecastDay[]>([])
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [expandedCurrent, setExpandedCurrent] = useState<boolean>(false)
  const [hourly, setHourly] = useState<any[]>([])
  const [isTvView, setIsTvView] = useState(false)
  const [uvIndex, setUvIndex] = useState<number | null>(null)
  const [aqi, setAqi] = useState<number | null>(null)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const tvPattern = /(Android TV|SmartTV|HbbTV|NetCast|Tizen|Web0S|BRAVIA|AFT|TV)/i
    setIsTvView(tvPattern.test(ua))
  }, [])

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true)
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY
        if (!apiKey) {
          setError('Weather API key not configured')
          setLoading(false)
          return
        }

        const lat = LAT
        const lon = LON

        const [currentResponse, forecastResponse] = await Promise.all([
          axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`),
          axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`),
        ])

        const data = forecastResponse.data
        const currentData = currentResponse.data

        // Grab first 12 hours for hourly forecast
        setHourly(data.list.slice(0, 12))

        const cityTimezoneOffset = Number(data.city?.timezone ?? 0)
        const todayKey = getDateKeyFromUnix(
          currentData.dt ?? Math.floor(Date.now() / 1000),
          cityTimezoneOffset
        )
        const tomorrowKey = getDateKeyFromUnix(
          Math.floor(Date.now() / 1000) + 24 * 60 * 60,
          cityTimezoneOffset
        )

        // Process forecast by city-local day and only keep the next 5 days starting tomorrow.
        const forecastMap: Record<string, ForecastDay & { iconScore: number }> = {}
        
        data.list.forEach((item: any) => {
          const dateStr = getDateKeyFromUnix(item.dt, cityTimezoneOffset)
          const iconScore = getDailyIconScore(item.dt, cityTimezoneOffset)
          
          if (!forecastMap[dateStr]) {
            forecastMap[dateStr] = {
              date: dateStr,
              high: Math.round(item.main.temp_max),
              low: Math.round(item.main.temp_min),
              pressure: item.main.pressure,
              humidity: item.main.humidity,
              windSpeed: Math.round(item.wind.speed),
              windDeg: item.wind.deg,
              windGust: item.wind.gust,
              visibility: item.visibility,
              dewPoint: item.main.dew_point,
              clouds: item.clouds.all,
              pop: item.pop,
              rain: item.rain?.['3h'] || item.rain?.['1h'] || 0,
              snow: item.snow?.['3h'] || item.snow?.['1h'] || 0,
              condition: item.weather[0].main,
              description: item.weather[0].description,
              icon: item.weather[0].icon,
              iconScore,
            }
          } else {
            forecastMap[dateStr].high = Math.max(forecastMap[dateStr].high, Math.round(item.main.temp_max))
            forecastMap[dateStr].low = Math.min(forecastMap[dateStr].low, Math.round(item.main.temp_min))
            if (iconScore < forecastMap[dateStr].iconScore) {
              forecastMap[dateStr].pressure = item.main.pressure
              forecastMap[dateStr].humidity = item.main.humidity
              forecastMap[dateStr].windSpeed = Math.round(item.wind.speed)
              forecastMap[dateStr].windDeg = item.wind.deg
              forecastMap[dateStr].windGust = item.wind.gust
              forecastMap[dateStr].visibility = item.visibility
              forecastMap[dateStr].dewPoint = item.main.dew_point
              forecastMap[dateStr].clouds = item.clouds.all
              forecastMap[dateStr].pop = item.pop
              forecastMap[dateStr].rain = item.rain?.['3h'] || item.rain?.['1h'] || 0
              forecastMap[dateStr].snow = item.snow?.['3h'] || item.snow?.['1h'] || 0
              forecastMap[dateStr].condition = item.weather[0].main
              forecastMap[dateStr].description = item.weather[0].description
              forecastMap[dateStr].icon = item.weather[0].icon
              forecastMap[dateStr].iconScore = iconScore
            }
          }
        })

        const todayForecast = forecastMap[todayKey]
        setCurrent({
          temp: Math.round(currentData.main.temp),
          feelsLike: Math.round(currentData.main.feels_like),
          min: todayForecast?.low ?? Math.round(currentData.main.temp_min),
          max: todayForecast?.high ?? Math.round(currentData.main.temp_max),
          pressure: currentData.main.pressure,
          humidity: currentData.main.humidity,
          windSpeed: Math.round(currentData.wind.speed),
          windDeg: currentData.wind.deg,
          windGust: currentData.wind.gust,
          visibility: currentData.visibility,
          dewPoint: undefined,
          clouds: currentData.clouds.all,
          pop: undefined,
          rain: currentData.rain?.['1h'] || currentData.rain?.['3h'] || 0,
          snow: currentData.snow?.['1h'] || currentData.snow?.['3h'] || 0,
          condition: currentData.weather[0].main,
          description: currentData.weather[0].description,
          icon: currentData.weather[0].icon,
        })

        const forecastArray = Object.values(forecastMap)
          .sort((a, b) => a.date.localeCompare(b.date))
          .filter(day => day.date >= tomorrowKey)
          .slice(0, 5)
          .map(({ iconScore, ...day }) => day)
        setForecast(forecastArray)

        // Fetch onecall (alerts + UV) and air pollution in parallel
        const [onecallResult, aqiResult] = await Promise.allSettled([
          axios.get(`https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`),
          axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`),
        ])

        if (onecallResult.status === 'fulfilled') {
          const rawAlerts = onecallResult.value.data?.alerts ?? []
          setAlerts(rawAlerts.map((alert: any) => ({
            event: alert.event || 'Weather Alert',
            description: alert.description || '',
            start: alert.start || 0,
            end: alert.end || 0,
            senderName: alert.sender_name || 'OpenWeather',
          })))
          const uvi = onecallResult.value.data?.current?.uvi
          if (uvi != null) setUvIndex(Math.round(uvi))
        } else {
          setAlerts([])
          console.warn('Weather alerts/UV fetch error:', onecallResult.reason)
        }

        if (aqiResult.status === 'fulfilled') {
          const aqiVal = aqiResult.value.data?.list?.[0]?.main?.aqi
          if (aqiVal != null) setAqi(aqiVal)
        } else {
          console.warn('Air quality fetch error:', aqiResult.reason)
        }


        setError('')
      } catch (err) {
        setError('Failed to load weather data')
        console.error('Weather fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
    const interval = setInterval(fetchWeather, 30 * 60 * 1000) // Refresh every 30 minutes
    return () => clearInterval(interval)
  }, [])

  const getWeatherEmoji = (icon: string): string => {
    const iconMap: Record<string, string> = {
      '01d': '☀️',
      '01n': '🌙',
      '02d': '⛅',
      '02n': '🌥️',
      '03d': '☁️',
      '03n': '☁️',
      '04d': '☁️',
      '04n': '☁️',
      '09d': '🌧️',
      '09n': '🌧️',
      '10d': '🌦️',
      '10n': '🌧️',
      '11d': '⛈️',
      '11n': '⛈️',
      '13d': '❄️',
      '13n': '❄️',
      '50d': '🌫️',
      '50n': '🌫️',
    }
    return iconMap[icon] || '🌡️'
  }

  const formatAlertTime = (timestamp: number): string => {
    if (!timestamp) return 'Unknown'
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const uvLabel = (uv: number): string => {
    if (uv <= 2) return 'Low'
    if (uv <= 5) return 'Moderate'
    if (uv <= 7) return 'High'
    if (uv <= 10) return 'Very High'
    return 'Extreme'
  }

  const uvColor = (uv: number): string => {
    if (uv <= 2) return '#4ade80'
    if (uv <= 5) return '#facc15'
    if (uv <= 7) return '#fb923c'
    if (uv <= 10) return '#f87171'
    return '#c084fc'
  }

  const aqiLabel = (a: number): string =>
    ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'][a] ?? 'Unknown'

  const aqiColor = (a: number): string =>
    ['', '#4ade80', '#a3e635', '#facc15', '#fb923c', '#f87171'][a] ?? '#9aa4b2'

  if (loading) {
    return <div className={`weather-container ${variant}`}>Loading weather...</div>
  }

  if (error) {
    return <div className={`weather-container error ${variant}`}>{error}</div>
  }

  return (
    <>
      <div className={`weather-container ${variant}`}>
        {variant !== 'compact' && alerts.length > 0 && (
          <div className={`weather-alerts ${variant}`}>
            {alerts.map(alert => (
              <div key={`${alert.event}-${alert.start}`} className="alert-card">
                <div className="alert-title">⚠️ {alert.event}</div>
                <div className="alert-meta">
                  {formatAlertTime(alert.start)} - {formatAlertTime(alert.end)}
                </div>
                <div className="alert-source">{alert.senderName}</div>
                {alert.description && (
                  <div className="alert-desc">{alert.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="current-weather">
          <div className="weather-details-row">
            <div>
              <div className="weather-details">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    className={`weather-icon clickable${expandedCurrent ? ' expanded' : ''}`}
                    onClick={() => setExpandedCurrent(!expandedCurrent)}
                    tabIndex={0}
                    role="button"
                    aria-label="Show current weather details"
                    style={{ marginRight: '0.5em' }}
                  >{current ? getWeatherEmoji(current.icon) : ''}</div>
                  <div className="temp">{current?.temp}°F</div>
                </div>
                <div className="condition-block">
                  <div className="condition">{current?.condition}</div>
                  <div className="daily-range">H {current?.max}° / L {current?.min}°</div>
                  {current && (
                    <div className="feels-like-index" style={{ color: '#fb923c', fontWeight: 600 }}>
                      Feels Like {current.feelsLike}°F
                    </div>
                  )}
                </div>
                <div className="location">Winterville, GA</div>
                <div className="additional">
                  <span>💧 {current?.humidity}%</span>
                  <span>💨 {current?.windSpeed} mph</span>
                </div>
              </div>
            </div>
            {/* Removed forecast-side to prevent duplicate 5-day forecast in header */}
          </div>
        </div>
        {variant === 'compact' ? (
          <div className="forecast-compact">
            {forecast.map((day, idx) => (
              <div
                key={day.date}
                className={`forecast-chip clickable${expandedIndex === idx ? ' expanded' : ''}`}
                onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                tabIndex={0}
                role="button"
                aria-label={`Show details for ${formatForecastDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}`}
              >
                <div className="chip-day">
                  {formatForecastDate(day.date, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div className="chip-icon">{getWeatherEmoji(day.icon)}</div>
                <div className="chip-temps">
                  <span className="high">{day.high}°</span>
                  <span className="low">{day.low}°</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="forecast">
            <h3>5-Day Forecast</h3>
            <div className="forecast-grid">
              {forecast.slice(0, 5).map((day, idx) => (
                <div
                  key={day.date}
                  className={`forecast-item clickable${expandedIndex === idx ? ' expanded' : ''}`}
                  onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Show details for ${formatForecastDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}`}
                >
                  <div className="forecast-date">
                    {formatForecastDate(day.date, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="forecast-icon">{getWeatherEmoji(day.icon)}</div>
                  <div className="forecast-temps">
                    <span className="high">{day.high}°</span>
                    <span className="low">{day.low}°</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Modal overlays rendered at top level for current and forecast details */}
      {current && (
        <div
          className="weather-modal"
          onClick={() => setExpandedCurrent(false)}
          style={{
            visibility: expandedCurrent ? 'visible' : 'hidden',
            opacity: expandedCurrent ? 1 : 0,
            pointerEvents: expandedCurrent ? 'auto' : 'none',
            transition: 'opacity 0.15s ease',
          }}
        >
          <div className="weather-modal-content" onClick={e => e.stopPropagation()}>
            <button className="weather-modal-close" onClick={() => setExpandedCurrent(false)} aria-label="Close weather details" style={{ position: 'absolute', top: '1em', right: '1em', fontSize: '2em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10000 }}>×</button>
            <div className="weather-modal-header" style={{ fontSize: '2em', marginBottom: '1em', display: 'flex', alignItems: 'center', gap: '1em' }}>
              <span className="weather-modal-date">Current Weather</span>
              <span className="weather-modal-icon">{getWeatherEmoji(current.icon)}</span>
            </div>
            <div style={{ display: 'flex', gap: '1em', flex: 1, minHeight: 0, height: '100%', flexWrap: 'wrap' }}>
              <div className="weather-modal-details" style={{ flex: 1, fontSize: '1em', minWidth: '200px', height: '100%', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                <div><strong>Temperature:</strong> {current.temp}°F</div>
                <div><strong>Feels Like:</strong> {current.feelsLike}°F</div>
                <div><strong>Min:</strong> {current.min}°F</div>
                <div><strong>Max:</strong> {current.max}°F</div>
                <div><strong>Condition:</strong> {current.condition} ({current.description})</div>
                <div><strong>Humidity:</strong> {current.humidity}%</div>
                <div><strong>Pressure:</strong> {current.pressure} hPa</div>
                <div><strong>Clouds:</strong> {current.clouds}%</div>
                <div><strong>Visibility:</strong> {current.visibility} m</div>
                <div><strong>Dew Point:</strong> {current.dewPoint ?? 'N/A'}°F</div>
                <div><strong>Precipitation:</strong> Rain {current.rain ?? 0} mm, Snow {current.snow ?? 0} mm</div>
                <div><strong>Wind:</strong> {current.windSpeed} mph, {current.windDeg}°, Gust {current.windGust ?? 'N/A'} mph</div>
                <div><strong>Precipitation Probability:</strong> {current.pop !== undefined ? Math.round((current.pop ?? 0) * 100) : 'N/A'}%</div>
                {uvIndex != null && (
                  <div><strong>UV Index:</strong> <span style={{ color: uvColor(uvIndex) }}>{uvIndex} — {uvLabel(uvIndex)}</span></div>
                )}
                {aqi != null && (
                  <div><strong>Air Quality:</strong> <span style={{ color: aqiColor(aqi) }}>{aqiLabel(aqi)}</span></div>
                )}
                <div><strong>Location:</strong> Winterville, GA</div>
              </div>
              <div className="weather-modal-radar" style={{ flex: 2, minWidth: 0, minHeight: 0, height: '100%', width: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', position: 'relative' }}>
                <AnimatedRadar />
              </div>
            </div>
            <div className="hourly-forecast-modal" style={{ marginTop: '2em', fontSize: isTvView ? '1em' : '1.2em', overflowX: isTvView ? 'hidden' : 'auto' }}>
              <div className="hourly-forecast-title" style={{ fontSize: isTvView ? '1.25em' : '1.5em', marginBottom: '0.5em' }}>Hourly Forecast</div>
              <div
                className="hourly-forecast-row"
                style={
                  isTvView
                    ? {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                        gap: '0.2em',
                        paddingBottom: '0.5em',
                        width: '100%',
                      }
                    : {
                        display: 'flex',
                        gap: '1em',
                        paddingBottom: '1em',
                        flexWrap: 'nowrap',
                        justifyContent: 'center',
                        width: '100%',
                      }
                }
              >
                {hourly.map(hour => (
                  <div
                    className="hourly-block"
                    key={hour.dt}
                    style={{
                      minWidth: isTvView ? '0' : '60px',
                      padding: isTvView ? '0.1em' : '0.25em',
                      background: '#333',
                      borderRadius: '8px',
                      textAlign: 'center',
                      flex: isTvView ? undefined : '0 0 auto',
                      fontSize: isTvView ? '0.55em' : '0.75em',
                    }}
                  >
                    <div className="hourly-time" style={{ fontSize: '0.9em' }}>{new Date(hour.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}</div>
                    <div className="hourly-icon" style={{ fontSize: isTvView ? '1.1em' : '1.3em' }}>{getWeatherEmoji(hour.weather[0].icon)}</div>
                    <div className="hourly-temp">{Math.round(hour.main.temp)}°</div>
                    <div className="hourly-pop">{hour.pop !== undefined ? Math.round(hour.pop * 100) : 'N/A'}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {expandedIndex !== null && forecast[expandedIndex] && (
        <div className="weather-modal" onClick={() => setExpandedIndex(null)}>
          <div className="weather-modal-content" onClick={e => e.stopPropagation()}>
            <button className="weather-modal-close" onClick={() => setExpandedIndex(null)} aria-label="Close weather details" style={{ position: 'absolute', top: '1em', right: '1em', fontSize: '2em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10000 }}>×</button>
            <div className="weather-modal-header" style={{ fontSize: '2em', marginBottom: '1em', display: 'flex', alignItems: 'center', gap: '1em' }}>
              <span className="weather-modal-date">{formatForecastDate(forecast[expandedIndex].date, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              <span className="weather-modal-icon">{getWeatherEmoji(forecast[expandedIndex].icon)}</span>
            </div>
            <div className="weather-modal-details" style={{ fontSize: '1.5em', overflowY: 'auto', minWidth: '350px' }}>
              <div><strong>High:</strong> {forecast[expandedIndex].high}°F</div>
              <div><strong>Low:</strong> {forecast[expandedIndex].low}°F</div>
              <div><strong>Condition:</strong> {forecast[expandedIndex].condition} ({forecast[expandedIndex].description})</div>
              <div><strong>Pressure:</strong> {forecast[expandedIndex].pressure} hPa</div>
              <div><strong>Humidity:</strong> {forecast[expandedIndex].humidity}%</div>
              <div><strong>Clouds:</strong> {forecast[expandedIndex].clouds}%</div>
              <div><strong>Visibility:</strong> {forecast[expandedIndex].visibility} m</div>
              <div><strong>Dew Point:</strong> {forecast[expandedIndex].dewPoint ?? 'N/A'}°F</div>
              <div><strong>Precipitation:</strong> Rain {forecast[expandedIndex].rain ?? 0} mm, Snow {forecast[expandedIndex].snow ?? 0} mm</div>
              <div><strong>Wind:</strong> {forecast[expandedIndex].windSpeed} mph, {forecast[expandedIndex].windDeg}°, Gust {forecast[expandedIndex].windGust ?? 'N/A'} mph</div>
              <div><strong>Precipitation Probability:</strong> {forecast[expandedIndex].pop !== undefined ? Math.round((forecast[expandedIndex].pop ?? 0) * 100) : 'N/A'}%</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
