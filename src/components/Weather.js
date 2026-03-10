import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Weather.css';
export default function Weather({ variant = 'full' }) {
    const [current, setCurrent] = useState(null);
    const [forecast, setForecast] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedIndex, setExpandedIndex] = useState(null);
    const [expandedCurrent, setExpandedCurrent] = useState(false);
    const [hourly, setHourly] = useState([]);
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                setLoading(true);
                const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
                if (!apiKey) {
                    setError('Weather API key not configured');
                    setLoading(false);
                    return;
                }
                // Winterville, GA coordinates: 33.8485, -83.2139
                const lat = 33.8485;
                const lon = -83.2139;
                const response = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`);
                const data = response.data;
                const currentData = data.list[0];
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
                });
                // Grab first 12 hours for hourly forecast
                setHourly(data.list.slice(0, 12));
                // Process forecast (5-day forecast, one per day at noon)
                const forecastMap = {};
                data.list.forEach((item) => {
                    const date = new Date(item.dt * 1000);
                    const dateStr = date.toISOString().split('T')[0];
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
                        };
                    }
                    else {
                        forecastMap[dateStr].high = Math.max(forecastMap[dateStr].high, Math.round(item.main.temp_max));
                        forecastMap[dateStr].low = Math.min(forecastMap[dateStr].low, Math.round(item.main.temp_min));
                        forecastMap[dateStr].pressure = item.main.pressure;
                        forecastMap[dateStr].humidity = item.main.humidity;
                        forecastMap[dateStr].windSpeed = Math.round(item.wind.speed);
                        forecastMap[dateStr].windDeg = item.wind.deg;
                        forecastMap[dateStr].windGust = item.wind.gust;
                        forecastMap[dateStr].visibility = item.visibility;
                        forecastMap[dateStr].dewPoint = item.main.dew_point;
                        forecastMap[dateStr].clouds = item.clouds.all;
                        forecastMap[dateStr].pop = item.pop;
                        forecastMap[dateStr].rain = item.rain?.['3h'] || item.rain?.['1h'] || 0;
                        forecastMap[dateStr].snow = item.snow?.['3h'] || item.snow?.['1h'] || 0;
                        forecastMap[dateStr].condition = item.weather[0].main;
                        forecastMap[dateStr].description = item.weather[0].description;
                        forecastMap[dateStr].icon = item.weather[0].icon;
                    }
                });
                const forecastArray = Object.values(forecastMap).slice(0, 5);
                setForecast(forecastArray);
                try {
                    const alertsResponse = await axios.get(`https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`);
                    const rawAlerts = alertsResponse.data?.alerts ?? [];
                    const normalizedAlerts = rawAlerts.map((alert) => ({
                        event: alert.event || 'Weather Alert',
                        description: alert.description || '',
                        start: alert.start || 0,
                        end: alert.end || 0,
                        senderName: alert.sender_name || 'OpenWeather',
                    }));
                    setAlerts(normalizedAlerts);
                }
                catch (alertError) {
                    setAlerts([]);
                    console.warn('Weather alerts fetch error:', alertError);
                }
                setError('');
            }
            catch (err) {
                setError('Failed to load weather data');
                console.error('Weather fetch error:', err);
            }
            finally {
                setLoading(false);
            }
        };
        fetchWeather();
        const interval = setInterval(fetchWeather, 30 * 60 * 1000); // Refresh every 30 minutes
        return () => clearInterval(interval);
    }, []);
    const getWeatherEmoji = (icon) => {
        const iconMap = {
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
        };
        return iconMap[icon] || '🌡️';
    };
    const formatAlertTime = (timestamp) => {
        if (!timestamp)
            return 'Unknown';
        return new Date(timestamp * 1000).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };
    if (loading) {
        return _jsx("div", { className: `weather-container ${variant}`, children: "Loading weather..." });
    }
    if (error) {
        return _jsx("div", { className: `weather-container error ${variant}`, children: error });
    }
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: `weather-container ${variant}`, children: [alerts.length > 0 && (_jsx("div", { className: `weather-alerts ${variant}`, children: variant === 'compact' ? (_jsxs("div", { className: "alert-compact", children: [_jsx("span", { className: "alert-pill", children: "Alerts" }), _jsx("span", { className: "alert-count", children: alerts.length })] })) : (alerts.map(alert => (_jsxs("div", { className: "alert-card", children: [_jsxs("div", { className: "alert-title", children: ["\u26A0\uFE0F ", alert.event] }), _jsxs("div", { className: "alert-meta", children: [formatAlertTime(alert.start), " - ", formatAlertTime(alert.end)] }), _jsx("div", { className: "alert-source", children: alert.senderName }), alert.description && (_jsx("div", { className: "alert-desc", children: alert.description }))] }, `${alert.event}-${alert.start}`)))) })), _jsx("div", { className: "current-weather", children: _jsx("div", { className: "weather-details-row", children: _jsx("div", { children: _jsxs("div", { className: "weather-details", children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center' }, children: [_jsx("div", { className: `weather-icon clickable${expandedCurrent ? ' expanded' : ''}`, onClick: () => setExpandedCurrent(!expandedCurrent), tabIndex: 0, role: "button", "aria-label": "Show current weather details", style: { marginRight: '0.5em' }, children: current ? getWeatherEmoji(current.icon) : '' }), _jsxs("div", { className: "temp", children: [current?.temp, "\u00B0F"] })] }), _jsx("div", { className: "condition", children: current?.condition }), _jsx("div", { className: "location", children: "Winterville, GA" }), _jsxs("div", { className: "additional", children: [_jsxs("span", { children: ["\uD83D\uDCA7 ", current?.humidity, "%"] }), _jsxs("span", { children: ["\uD83D\uDCA8 ", current?.windSpeed, " mph"] })] })] }) }) }) }), variant === 'compact' ? (_jsx("div", { className: "forecast-compact", children: forecast.map((day, idx) => (_jsxs("div", { className: `forecast-chip clickable${expandedIndex === idx ? ' expanded' : ''}`, onClick: () => setExpandedIndex(expandedIndex === idx ? null : idx), tabIndex: 0, role: "button", "aria-label": `Show details for ${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`, children: [_jsx("div", { className: "chip-day", children: new Date(day.date).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        timeZone: 'America/New_York',
                                    }) }), _jsx("div", { className: "chip-icon", children: getWeatherEmoji(day.icon) }), _jsxs("div", { className: "chip-temps", children: [_jsxs("span", { className: "high", children: [day.high, "\u00B0"] }), _jsxs("span", { className: "low", children: [day.low, "\u00B0"] })] })] }, day.date))) })) : (_jsxs("div", { className: "forecast", children: [_jsx("h3", { children: "5-Day Forecast" }), _jsx("div", { className: "forecast-grid", children: forecast.slice(0, 5).map((day, idx) => (_jsxs("div", { className: `forecast-item clickable${expandedIndex === idx ? ' expanded' : ''}`, onClick: () => setExpandedIndex(expandedIndex === idx ? null : idx), tabIndex: 0, role: "button", "aria-label": `Show details for ${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`, children: [_jsx("div", { className: "forecast-date", children: new Date(day.date).toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                timeZone: 'America/New_York',
                                            }) }), _jsx("div", { className: "forecast-icon", children: getWeatherEmoji(day.icon) }), _jsxs("div", { className: "forecast-temps", children: [_jsxs("span", { className: "high", children: [day.high, "\u00B0"] }), _jsxs("span", { className: "low", children: [day.low, "\u00B0"] })] })] }, day.date))) })] }))] }), expandedCurrent && current && (_jsx("div", { className: "weather-modal", onClick: () => setExpandedCurrent(false), style: { position: 'fixed', top: 0, left: 0, width: '96vw', height: '96vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,20,20,0.95)' }, children: _jsxs("div", { className: "weather-modal-content", onClick: e => e.stopPropagation(), style: { width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', padding: '2em', boxSizing: 'border-box', borderRadius: '32px', background: '#222', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }, children: [_jsx("button", { className: "weather-modal-close", onClick: () => setExpandedCurrent(false), "aria-label": "Close weather details", style: { position: 'absolute', top: '1em', right: '1em', fontSize: '2em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10000 }, children: "\u00D7" }), _jsxs("div", { className: "weather-modal-header", style: { fontSize: '2em', marginBottom: '1em', display: 'flex', alignItems: 'center', gap: '1em' }, children: [_jsx("span", { className: "weather-modal-date", children: "Current Weather" }), _jsx("span", { className: "weather-modal-icon", children: getWeatherEmoji(current.icon) })] }), _jsxs("div", { style: { display: 'flex', gap: '3em', flex: 1, minHeight: 0, height: '40vh' }, children: [_jsxs("div", { className: "weather-modal-details", style: { flex: 1, fontSize: '1.5em', minWidth: '350px', height: '100%' }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Temperature:" }), " ", current.temp, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Feels Like:" }), " ", current.feelsLike, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Min:" }), " ", current.min, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Max:" }), " ", current.max, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Condition:" }), " ", current.condition, " (", current.description, ")"] }), _jsxs("div", { children: [_jsx("strong", { children: "Humidity:" }), " ", current.humidity, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Pressure:" }), " ", current.pressure, " hPa"] }), _jsxs("div", { children: [_jsx("strong", { children: "Clouds:" }), " ", current.clouds, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Visibility:" }), " ", current.visibility, " m"] }), _jsxs("div", { children: [_jsx("strong", { children: "Dew Point:" }), " ", current.dewPoint ?? 'N/A', "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation:" }), " Rain ", current.rain ?? 0, " mm, Snow ", current.snow ?? 0, " mm"] }), _jsxs("div", { children: [_jsx("strong", { children: "Wind:" }), " ", current.windSpeed, " mph, ", current.windDeg, "\u00B0, Gust ", current.windGust ?? 'N/A', " mph"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation Probability:" }), " ", current.pop !== undefined ? Math.round((current.pop ?? 0) * 100) : 'N/A', "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Location:" }), " Winterville, GA"] })] }), _jsx("div", { className: "weather-modal-radar", style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx("iframe", { title: "Windy.com Radar", src: "https://embed.windy.com/embed2.html?lat=33.8485&lon=-83.2139&zoom=8&level=surface&overlay=radar&menu=&message=true&marker=true&calendar=both&pressure=true&type=map&location=coordinates&detail=&detailLat=33.8485&detailLon=-83.2139&metricWind=kt&metricTemp=%C2%B0F", width: "900", height: "650", frameBorder: "0", style: { borderRadius: '16px', background: '#222', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }, allowFullScreen: true }) })] }), _jsxs("div", { className: "hourly-forecast-modal", style: { marginTop: '2em', fontSize: '1.2em', overflowX: 'auto' }, children: [_jsx("div", { className: "hourly-forecast-title", style: { fontSize: '1.5em', marginBottom: '0.5em' }, children: "Hourly Forecast" }), _jsx("div", { className: "hourly-forecast-row", style: { display: 'flex', gap: '1em', paddingBottom: '1em', flexWrap: 'nowrap', justifyContent: 'center', width: '100%' }, children: hourly.map(hour => (_jsxs("div", { className: "hourly-block", style: { minWidth: '90px', padding: '0.5em', background: '#333', borderRadius: '8px', textAlign: 'center', flex: '0 0 auto', fontSize: '0.95em' }, children: [_jsx("div", { className: "hourly-time", style: { fontSize: '0.9em' }, children: new Date(hour.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) }), _jsx("div", { className: "hourly-icon", style: { fontSize: '1.3em' }, children: getWeatherEmoji(hour.weather[0].icon) }), _jsxs("div", { className: "hourly-temp", children: [Math.round(hour.main.temp), "\u00B0"] }), _jsxs("div", { className: "hourly-pop", children: [hour.pop !== undefined ? Math.round(hour.pop * 100) : 'N/A', "%"] })] }, hour.dt))) })] })] }) })), expandedIndex !== null && forecast[expandedIndex] && (_jsx("div", { className: "weather-modal", onClick: () => setExpandedIndex(null), style: { position: 'fixed', top: 0, left: 0, width: 'auto', height: 'auto', minWidth: '420px', minHeight: '320px', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,20,20,0.65)' }, children: _jsxs("div", { className: "weather-modal-content", onClick: e => e.stopPropagation(), style: { width: '420px', minHeight: '320px', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2em', boxSizing: 'border-box', borderRadius: '24px', background: '#222', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }, children: [_jsx("button", { className: "weather-modal-close", onClick: () => setExpandedIndex(null), "aria-label": "Close weather details", style: { position: 'absolute', top: '1em', right: '1em', fontSize: '2em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10000 }, children: "\u00D7" }), _jsxs("div", { className: "weather-modal-header", style: { fontSize: '2em', marginBottom: '1em', display: 'flex', alignItems: 'center', gap: '1em' }, children: [_jsx("span", { className: "weather-modal-date", children: new Date(forecast[expandedIndex].date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' }) }), _jsx("span", { className: "weather-modal-icon", children: getWeatherEmoji(forecast[expandedIndex].icon) })] }), _jsxs("div", { className: "weather-modal-details", style: { fontSize: '1.5em', overflowY: 'auto', minWidth: '350px' }, children: [_jsxs("div", { children: [_jsx("strong", { children: "High:" }), " ", forecast[expandedIndex].high, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Low:" }), " ", forecast[expandedIndex].low, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Condition:" }), " ", forecast[expandedIndex].condition, " (", forecast[expandedIndex].description, ")"] }), _jsxs("div", { children: [_jsx("strong", { children: "Pressure:" }), " ", forecast[expandedIndex].pressure, " hPa"] }), _jsxs("div", { children: [_jsx("strong", { children: "Humidity:" }), " ", forecast[expandedIndex].humidity, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Clouds:" }), " ", forecast[expandedIndex].clouds, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Visibility:" }), " ", forecast[expandedIndex].visibility, " m"] }), _jsxs("div", { children: [_jsx("strong", { children: "Dew Point:" }), " ", forecast[expandedIndex].dewPoint ?? 'N/A', "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation:" }), " Rain ", forecast[expandedIndex].rain ?? 0, " mm, Snow ", forecast[expandedIndex].snow ?? 0, " mm"] }), _jsxs("div", { children: [_jsx("strong", { children: "Wind:" }), " ", forecast[expandedIndex].windSpeed, " mph, ", forecast[expandedIndex].windDeg, "\u00B0, Gust ", forecast[expandedIndex].windGust ?? 'N/A', " mph"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation Probability:" }), " ", forecast[expandedIndex].pop !== undefined ? Math.round((forecast[expandedIndex].pop ?? 0) * 100) : 'N/A', "%"] })] })] }) }))] }));
}
