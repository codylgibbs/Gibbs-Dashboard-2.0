import { useState, useEffect } from 'react'
import axios from 'axios'
import '../styles/Weather.css'


import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// NOAA/NWS animated radar map centered on Winterville, GA
function RadarMap() {
  // Winterville, GA coordinates
  const center: [number, number] = [33.8485, -83.2139];
  // NWS radar tile layer (animation)
  // Example: https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=YOUR_API_KEY
  // For NWS, use https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi
  // For animation, we can use the latest radar layer
  // Example: https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png
  // We'll use zoom 7 for a broad region
  // Show only the latest radar frame (no animation)
  const radarTileUrl = "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png";
  const openWeatherApiKey = import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined
  const windTileUrl = openWeatherApiKey
    ? `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${openWeatherApiKey}`
    : null
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 300 }}>
      <MapContainer
        center={center}
        zoom={9}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%', minHeight: 300, borderRadius: '16px', overflow: 'hidden' }}
      >
        {/* Base map (OpenStreetMap) */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {/* Latest NOAA/NWS radar overlay */}
        <TileLayer
          url={radarTileUrl}
          attribution="Radar &copy; NOAA/NWS"
          opacity={0.7}
        />
        {windTileUrl && (
          <TileLayer
            url={windTileUrl}
            attribution="Wind &copy; OpenWeather"
            opacity={0.45}
          />
        )}
      </MapContainer>
    </div>
  );
}

// RainViewer animated radar tiles with NOAA/NWS fallback.
function RainViewerWithFallback() {
  const [mode, setMode] = useState<'noaa' | 'rainviewer'>('rainviewer')
  const [isLightTheme, setIsLightTheme] = useState(false)
  const [isTvDevice, setIsTvDevice] = useState(false)
  const [frameUrls, setFrameUrls] = useState<string[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [loadingFrames, setLoadingFrames] = useState(true)
  const rainViewerZoom = 7
  const rainViewerMaxZoom = 7

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const tvPattern = /(Android TV|SmartTV|HbbTV|NetCast|Tizen|Web0S|BRAVIA|AFT|TV)/i
    setIsTvDevice(tvPattern.test(ua))
  }, [])

  useEffect(() => {
    const appContainer = document.querySelector('.app-container')
    if (!appContainer) return

    const updateTheme = () => {
      setIsLightTheme(appContainer.classList.contains('theme-light'))
    }

    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(appContainer, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (mode !== 'rainviewer') return

    let cancelled = false

    const loadFrames = async () => {
      try {
        setLoadingFrames(true)
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json')
        const data = await response.json()
        const host = data?.host || 'https://tilecache.rainviewer.com'
        const past = data?.radar?.past || []
        const nowcast = data?.radar?.nowcast || []
        const frames = [...past, ...nowcast].slice(-12)

        const urls = frames
          .map((frame: { path?: string }) => frame?.path)
          .filter((path: string | undefined): path is string => Boolean(path))
          .map((path: string) => `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`)

        if (!cancelled) {
          if (urls.length === 0) {
            setMode('noaa')
          } else {
            setFrameUrls(urls)
            setFrameIndex(0)
          }
          setLoadingFrames(false)
        }
      } catch {
        if (!cancelled) {
          setMode('noaa')
          setLoadingFrames(false)
        }
      }
    }

    loadFrames()

    return () => {
      cancelled = true
    }
  }, [mode])

  useEffect(() => {
    if (mode !== 'rainviewer' || frameUrls.length < 2) return

    const interval = setInterval(() => {
      setFrameIndex(index => (index + 1) % frameUrls.length)
    }, 700)

    return () => clearInterval(interval)
  }, [mode, frameUrls])

  if (mode === 'noaa') {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: 300, position: 'relative' }}>
        <RadarMap />
        {!isTvDevice && (
          <button
            onClick={() => {
              setMode('rainviewer')
            }}
            tabIndex={-1}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 1200,
              border: 'none',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
              background: isLightTheme ? 'rgba(255,255,255,0.9)' : 'rgba(16,21,31,0.88)',
              color: isLightTheme ? '#172033' : '#ecf0f6',
              fontSize: '0.85rem',
            }}
          >
            Try Animated Radar
          </button>
        )}
      </div>
    )
  }

  if (loadingFrames) {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', background: isLightTheme ? '#eef3f8' : '#10151f', color: isLightTheme ? '#172033' : '#ecf0f6' }}>
        Loading animated radar...
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 300, position: 'relative' }}>
      <MapContainer
        center={[33.8485, -83.2139]}
        zoom={rainViewerZoom}
        minZoom={4}
        maxZoom={rainViewerMaxZoom}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%', minHeight: 300, borderRadius: '16px', overflow: 'hidden' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <TileLayer
          key={frameUrls[frameIndex]}
          url={frameUrls[frameIndex]}
          attribution="Radar &copy; RainViewer"
          opacity={0.75}
          maxNativeZoom={rainViewerMaxZoom}
          maxZoom={rainViewerMaxZoom}
        />
      </MapContainer>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1200,
          borderRadius: 8,
          padding: '6px 10px',
          background: isLightTheme ? 'rgba(255,255,255,0.9)' : 'rgba(16,21,31,0.88)',
          color: isLightTheme ? '#172033' : '#ecf0f6',
          fontSize: '0.82rem',
        }}
      >
        Animated Radar {frameIndex + 1}/{Math.max(frameUrls.length, 1)}
      </div>
      {!isTvDevice && (
        <button
          onClick={() => setMode('noaa')}
          tabIndex={-1}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1200,
            border: 'none',
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
            background: isLightTheme ? 'rgba(255,255,255,0.9)' : 'rgba(16,21,31,0.88)',
            color: isLightTheme ? '#172033' : '#ecf0f6',
            fontSize: '0.85rem',
          }}
        >
          Show NOAA + Wind
        </button>
      )}
    </div>
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

        // Winterville, GA coordinates: 33.8485, -83.2139
        const lat = 33.8485
        const lon = -83.2139

        const response = await axios.get(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`
        )

        const data = response.data
        const currentData = data.list[0]

        setCurrent({
          temp: Math.round(currentData.main.temp),
          feelsLike: Math.round(currentData.main.feels_like),
          min: Math.round(currentData.main.temp_min),
          max: Math.round(currentData.main.temp_max),
          pressure: currentData.main.pressure,
          humidity: currentData.main.humidity,
          windSpeed: Math.round(currentData.wind.speed),
          windDeg: currentData.wind.deg,
          windGust: currentData.wind.gust,
          visibility: currentData.visibility,
          dewPoint: currentData.main.dew_point,
          clouds: currentData.clouds.all,
          pop: currentData.pop,
          rain: currentData.rain?.['3h'] || currentData.rain?.['1h'] || 0,
          snow: currentData.snow?.['3h'] || currentData.snow?.['1h'] || 0,
          condition: currentData.weather[0].main,
          description: currentData.weather[0].description,
          icon: currentData.weather[0].icon,
        })

        // Grab first 12 hours for hourly forecast
        setHourly(data.list.slice(0, 12))

        const cityTimezoneOffset = Number(data.city?.timezone ?? 0)
        const tomorrowKey = getDateKeyFromUnix(
          Math.floor(Date.now() / 1000) + 24 * 60 * 60,
          cityTimezoneOffset
        )

        // Process forecast by city-local day and only keep the next 5 days starting tomorrow.
        const forecastMap: Record<string, ForecastDay> = {}
        
        data.list.forEach((item: any) => {
          const dateStr = getDateKeyFromUnix(item.dt, cityTimezoneOffset)
          
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
            }
          } else {
            forecastMap[dateStr].high = Math.max(forecastMap[dateStr].high, Math.round(item.main.temp_max))
            forecastMap[dateStr].low = Math.min(forecastMap[dateStr].low, Math.round(item.main.temp_min))
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
          }
        })

        const forecastArray = Object.values(forecastMap)
          .sort((a, b) => a.date.localeCompare(b.date))
          .filter(day => day.date >= tomorrowKey)
          .slice(0, 5)
        setForecast(forecastArray)

        try {
          const alertsResponse = await axios.get(
            `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`
          )
          const rawAlerts = alertsResponse.data?.alerts ?? []
          const normalizedAlerts = rawAlerts.map((alert: any) => ({
            event: alert.event || 'Weather Alert',
            description: alert.description || '',
            start: alert.start || 0,
            end: alert.end || 0,
            senderName: alert.sender_name || 'OpenWeather',
          }))
          setAlerts(normalizedAlerts)
        } catch (alertError) {
          setAlerts([])
          console.warn('Weather alerts fetch error:', alertError)
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

  if (loading) {
    return <div className={`weather-container ${variant}`}>Loading weather...</div>
  }

  if (error) {
    return <div className={`weather-container error ${variant}`}>{error}</div>
  }

  return (
    <>
      <div className={`weather-container ${variant}`}>
        {alerts.length > 0 && (
          <div className={`weather-alerts ${variant}`}>
            {variant === 'compact' ? (
              <div className="alert-compact">
                <span className="alert-pill">Alerts</span>
                <span className="alert-count">{alerts.length}</span>
              </div>
            ) : (
              alerts.map(alert => (
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
              ))
            )}
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
                <div className="condition">{current?.condition}</div>
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
      {expandedCurrent && current && (
        <div className="weather-modal" onClick={() => setExpandedCurrent(false)}>
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
                <div><strong>Location:</strong> Winterville, GA</div>
              </div>
              <div className="weather-modal-radar" style={{ flex: 2, minWidth: 0, minHeight: 0, height: '100%', width: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', position: 'relative' }}>
                <RainViewerWithFallback />
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
