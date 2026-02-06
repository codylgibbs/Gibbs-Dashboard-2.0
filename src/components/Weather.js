import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Weather.css';
export default function Weather({ variant = 'full' }) {
    const [current, setCurrent] = useState(null);
    const [forecast, setForecast] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
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
                    condition: currentData.weather[0].main,
                    humidity: currentData.main.humidity,
                    windSpeed: Math.round(currentData.wind.speed),
                    icon: currentData.weather[0].icon,
                });
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
                            condition: item.weather[0].main,
                            icon: item.weather[0].icon,
                        };
                    }
                    else {
                        forecastMap[dateStr].high = Math.max(forecastMap[dateStr].high, Math.round(item.main.temp_max));
                        forecastMap[dateStr].low = Math.min(forecastMap[dateStr].low, Math.round(item.main.temp_min));
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
        const interval = setInterval(fetchWeather, 1 * 60 * 1000); // Refresh every 1 minute
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
    return (_jsxs("div", { className: `weather-container ${variant}`, children: [alerts.length > 0 && (_jsx("div", { className: `weather-alerts ${variant}`, children: variant === 'compact' ? (_jsxs("div", { className: "alert-compact", children: [_jsx("span", { className: "alert-pill", children: "Alerts" }), _jsx("span", { className: "alert-count", children: alerts.length })] })) : (alerts.map(alert => (_jsxs("div", { className: "alert-card", children: [_jsxs("div", { className: "alert-title", children: ["\u26A0\uFE0F ", alert.event] }), _jsxs("div", { className: "alert-meta", children: [formatAlertTime(alert.start), " - ", formatAlertTime(alert.end)] }), _jsx("div", { className: "alert-source", children: alert.senderName }), alert.description && (_jsx("div", { className: "alert-desc", children: alert.description }))] }, `${alert.event}-${alert.start}`)))) })), _jsxs("div", { className: "current-weather", children: [_jsx("div", { className: "weather-icon", children: current ? getWeatherEmoji(current.icon) : '' }), _jsxs("div", { className: "weather-details", children: [_jsxs("div", { className: "temp", children: [current?.temp, "\u00B0F"] }), _jsx("div", { className: "condition", children: current?.condition }), _jsx("div", { className: "location", children: "Winterville, GA" }), _jsxs("div", { className: "additional", children: [_jsxs("span", { children: ["\uD83D\uDCA7 ", current?.humidity, "%"] }), _jsxs("span", { children: ["\uD83D\uDCA8 ", current?.windSpeed, " mph"] })] })] })] }), variant === 'compact' ? (_jsx("div", { className: "forecast-compact", children: forecast.map(day => (_jsxs("div", { className: "forecast-chip", children: [_jsx("div", { className: "chip-day", children: new Date(day.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                            }) }), _jsx("div", { className: "chip-icon", children: getWeatherEmoji(day.icon) }), _jsxs("div", { className: "chip-temps", children: [_jsxs("span", { className: "high", children: [day.high, "\u00B0"] }), _jsxs("span", { className: "low", children: [day.low, "\u00B0"] })] })] }, day.date))) })) : (_jsxs("div", { className: "forecast", children: [_jsx("h3", { children: "5-Day Forecast" }), _jsx("div", { className: "forecast-grid", children: forecast.map(day => (_jsxs("div", { className: "forecast-item", children: [_jsx("div", { className: "forecast-date", children: new Date(day.date).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                    }) }), _jsx("div", { className: "forecast-icon", children: getWeatherEmoji(day.icon) }), _jsxs("div", { className: "forecast-temps", children: [_jsxs("span", { className: "high", children: [day.high, "\u00B0"] }), _jsxs("span", { className: "low", children: [day.low, "\u00B0"] })] })] }, day.date))) })] }))] }));
}
