import { useState, useEffect } from 'react'
import axios from 'axios'
import '../styles/Weather.css'

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

        // Process forecast (5-day forecast, one per day at noon)
        const forecastMap: Record<string, ForecastDay> = {}
        
        data.list.forEach((item: any) => {
          const date = new Date(item.dt * 1000)
          const dateStr = date.toISOString().split('T')[0]
          
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

        const forecastArray = Object.values(forecastMap).slice(0, 5)
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
                aria-label={`Show details for ${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
              >
                <div className="chip-day">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'America/New_York',
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
                  aria-label={`Show details for ${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                >
                  <div className="forecast-date">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'America/New_York',
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
        <div className="weather-modal" onClick={() => setExpandedCurrent(false)} style={{ position: 'fixed', top: 0, left: 0, width: '96vw', height: '96vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,20,20,0.95)' }}>
          <div className="weather-modal-content" onClick={e => e.stopPropagation()} style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', padding: '2em', boxSizing: 'border-box', borderRadius: '32px', background: '#222', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <button className="weather-modal-close" onClick={() => setExpandedCurrent(false)} aria-label="Close weather details" style={{ position: 'absolute', top: '1em', right: '1em', fontSize: '2em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10000 }}>×</button>
            <div className="weather-modal-header" style={{ fontSize: '2em', marginBottom: '1em', display: 'flex', alignItems: 'center', gap: '1em' }}>
              <span className="weather-modal-date">Current Weather</span>
              <span className="weather-modal-icon">{getWeatherEmoji(current.icon)}</span>
            </div>
            <div style={{ display: 'flex', gap: '3em', flex: 1, minHeight: 0, height: '40vh' }}>
              <div className="weather-modal-details" style={{ flex: 1, fontSize: '1.5em', minWidth: '350px', height: '100%' }}>
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
              <div className="weather-modal-radar" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <iframe
                  title="Windy.com Radar"
                  src="https://embed.windy.com/embed2.html?lat=33.8485&lon=-83.2139&zoom=8&level=surface&overlay=radar&menu=&message=true&marker=true&calendar=now&pressure=true&type=map&location=coordinates&detail=&detailLat=33.8485&detailLon=-83.2139&metricWind=kt&metricTemp=%C2%B0F"
                  width="900"
                  height="650"
                  frameBorder="0"
                  style={{ borderRadius: '16px', background: '#222', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
                  allowFullScreen
                ></iframe>
              </div>
            </div>
            <div className="hourly-forecast-modal" style={{ marginTop: '2em', fontSize: '1.2em', overflowX: 'auto' }}>
              <div className="hourly-forecast-title" style={{ fontSize: '1.5em', marginBottom: '0.5em' }}>Hourly Forecast</div>
              <div className="hourly-forecast-row" style={{ display: 'flex', gap: '1em', paddingBottom: '1em', flexWrap: 'nowrap', justifyContent: 'center', width: '100%' }}>
                {hourly.map(hour => (
                  <div className="hourly-block" key={hour.dt} style={{ minWidth: '90px', padding: '0.5em', background: '#333', borderRadius: '8px', textAlign: 'center', flex: '0 0 auto', fontSize: '0.95em' }}>
                    <div className="hourly-time" style={{ fontSize: '0.9em' }}>{new Date(hour.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}</div>
                    <div className="hourly-icon" style={{ fontSize: '1.3em' }}>{getWeatherEmoji(hour.weather[0].icon)}</div>
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
        <div className="weather-modal" onClick={() => setExpandedIndex(null)} style={{ position: 'fixed', top: 0, left: 0, width: 'auto', height: 'auto', minWidth: '420px', minHeight: '320px', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,20,20,0.65)' }}>
          <div className="weather-modal-content" onClick={e => e.stopPropagation()} style={{ width: '420px', minHeight: '320px', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2em', boxSizing: 'border-box', borderRadius: '24px', background: '#222', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <button className="weather-modal-close" onClick={() => setExpandedIndex(null)} aria-label="Close weather details" style={{ position: 'absolute', top: '1em', right: '1em', fontSize: '2em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10000 }}>×</button>
            <div className="weather-modal-header" style={{ fontSize: '2em', marginBottom: '1em', display: 'flex', alignItems: 'center', gap: '1em' }}>
              <span className="weather-modal-date">{new Date(forecast[expandedIndex].date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' })}</span>
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

