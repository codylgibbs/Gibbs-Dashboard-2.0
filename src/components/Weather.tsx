import { useState, useEffect } from 'react'
import axios from 'axios'
import '../styles/Weather.css'

interface WeatherData {
  temp: number
  condition: string
  humidity: number
  windSpeed: number
  icon: string
}

interface ForecastDay {
  date: string
  high: number
  low: number
  condition: string
  icon: string
}

type WeatherVariant = 'compact' | 'full'

interface WeatherProps {
  variant?: WeatherVariant
}

export default function Weather({ variant = 'full' }: WeatherProps) {
  const [current, setCurrent] = useState<WeatherData | null>(null)
  const [forecast, setForecast] = useState<ForecastDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
          condition: currentData.weather[0].main,
          humidity: currentData.main.humidity,
          windSpeed: Math.round(currentData.wind.speed),
          icon: currentData.weather[0].icon,
        })

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
              condition: item.weather[0].main,
              icon: item.weather[0].icon,
            }
          } else {
            forecastMap[dateStr].high = Math.max(forecastMap[dateStr].high, Math.round(item.main.temp_max))
            forecastMap[dateStr].low = Math.min(forecastMap[dateStr].low, Math.round(item.main.temp_min))
          }
        })

        const forecastArray = Object.values(forecastMap).slice(0, 5)
        setForecast(forecastArray)
        setError('')
      } catch (err) {
        setError('Failed to load weather data')
        console.error('Weather fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
    const interval = setInterval(fetchWeather, 1 * 60 * 1000) // Refresh every 1 minute
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

  if (loading) {
    return <div className={`weather-container ${variant}`}>Loading weather...</div>
  }

  if (error) {
    return <div className={`weather-container error ${variant}`}>{error}</div>
  }

  return (
    <div className={`weather-container ${variant}`}>
      <div className="current-weather">
        <div className="weather-icon">{current ? getWeatherEmoji(current.icon) : ''}</div>
        <div className="weather-details">
          <div className="temp">{current?.temp}°F</div>
          <div className="condition">{current?.condition}</div>
          <div className="location">Winterville, GA</div>
          <div className="additional">
            <span>💧 {current?.humidity}%</span>
            <span>💨 {current?.windSpeed} mph</span>
          </div>
        </div>
      </div>

      {variant === 'compact' ? (
        <div className="forecast-compact">
          {forecast.map(day => (
            <div key={day.date} className="forecast-chip">
              <div className="chip-day">
                {new Date(day.date).toLocaleDateString('en-US', {
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
            {forecast.map(day => (
              <div key={day.date} className="forecast-item">
                <div className="forecast-date">
                  {new Date(day.date).toLocaleDateString('en-US', {
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
  )
}
