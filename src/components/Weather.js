import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/Weather.css';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
const LAT = 33.9671;
const LON = -83.2807;
const ZOOM = 7;
const FRAME_INTERVAL_MS = 500;
function AnimatedRadar() {
    const [frames, setFrames] = useState([]);
    const [frameIndex, setFrameIndex] = useState(0);
    const [status, setStatus] = useState('loading');
    const intervalRef = useRef(null);
    const owApiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
    const lightningUrl = owApiKey
        ? `https://tile.openweathermap.org/map/lightning_distance/{z}/{x}/{y}.png?appid=${owApiKey}`
        : null;
    useEffect(() => {
        let cancelled = false;
        fetch('https://api.rainviewer.com/public/weather-maps.json')
            .then(r => r.json())
            .then(data => {
            if (cancelled)
                return;
            const host = data?.host ?? 'https://tilecache.rainviewer.com';
            const past = data?.radar?.past ?? [];
            const nowcast = data?.radar?.nowcast ?? [];
            const all = [...past, ...nowcast].filter(f => f?.path);
            if (all.length === 0) {
                setStatus('error');
                return;
            }
            setFrames(all.map(f => `${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`));
            setStatus('ready');
        })
            .catch(() => { if (!cancelled)
            setStatus('error'); });
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        if (status !== 'ready' || frames.length < 2)
            return;
        intervalRef.current = setInterval(() => {
            setFrameIndex(i => (i + 1) % frames.length);
        }, FRAME_INTERVAL_MS);
        return () => { if (intervalRef.current)
            clearInterval(intervalRef.current); };
    }, [status, frames]);
    if (status === 'loading') {
        return _jsx("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9aa4b2' }, children: "Loading radar..." });
    }
    if (status === 'error') {
        return _jsx("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9aa4b2' }, children: "Radar unavailable" });
    }
    return (_jsxs(MapContainer, { center: [LAT, LON], zoom: ZOOM, dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false, boxZoom: false, keyboard: false, zoomControl: false, attributionControl: false, style: { width: '100%', height: '100%', minHeight: 300, borderRadius: '16px' }, children: [_jsx(TileLayer, { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", maxZoom: 19 }), frames[frameIndex] && (_jsx(TileLayer, { url: frames[frameIndex], opacity: 0.75, zIndex: 10, maxNativeZoom: 7, maxZoom: 7 }, frames[frameIndex])), lightningUrl && (_jsx(TileLayer, { url: lightningUrl, opacity: 0.9, zIndex: 20, maxNativeZoom: 7, maxZoom: 7 }))] }));
}
const WEATHER_TIME_ZONE = 'America/New_York';
const getDateKeyFromUnix = (timestampSeconds, timezoneOffsetSeconds) => {
    const shifted = new Date((timestampSeconds + timezoneOffsetSeconds) * 1000);
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const getLocalHourFromUnix = (timestampSeconds, timezoneOffsetSeconds) => {
    return new Date((timestampSeconds + timezoneOffsetSeconds) * 1000).getUTCHours();
};
const getDailyIconScore = (timestampSeconds, timezoneOffsetSeconds) => {
    return Math.abs(getLocalHourFromUnix(timestampSeconds, timezoneOffsetSeconds) - 14);
};
const formatForecastDate = (dateKey, options) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const stableDate = new Date(year, month - 1, day, 12);
    return stableDate.toLocaleDateString('en-US', { ...options, timeZone: WEATHER_TIME_ZONE });
};
export default function Weather({ variant = 'full' }) {
    const [current, setCurrent] = useState(null);
    const [forecast, setForecast] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedIndex, setExpandedIndex] = useState(null);
    const [expandedCurrent, setExpandedCurrent] = useState(false);
    const [hourly, setHourly] = useState([]);
    const [isTvView, setIsTvView] = useState(false);
    const [uvIndex, setUvIndex] = useState(null);
    const [aqi, setAqi] = useState(null);
    useEffect(() => {
        const ua = navigator.userAgent || '';
        const tvPattern = /(Android TV|SmartTV|HbbTV|NetCast|Tizen|Web0S|BRAVIA|AFT|TV)/i;
        setIsTvView(tvPattern.test(ua));
    }, []);
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
                const lat = LAT;
                const lon = LON;
                const [currentResponse, forecastResponse] = await Promise.all([
                    axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`),
                    axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`),
                ]);
                const data = forecastResponse.data;
                const currentData = currentResponse.data;
                // Grab first 12 hours for hourly forecast
                setHourly(data.list.slice(0, 12));
                const cityTimezoneOffset = Number(data.city?.timezone ?? 0);
                const todayKey = getDateKeyFromUnix(currentData.dt ?? Math.floor(Date.now() / 1000), cityTimezoneOffset);
                const tomorrowKey = getDateKeyFromUnix(Math.floor(Date.now() / 1000) + 24 * 60 * 60, cityTimezoneOffset);
                // Process forecast by city-local day and only keep the next 5 days starting tomorrow.
                const forecastMap = {};
                data.list.forEach((item) => {
                    const dateStr = getDateKeyFromUnix(item.dt, cityTimezoneOffset);
                    const iconScore = getDailyIconScore(item.dt, cityTimezoneOffset);
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
                        };
                    }
                    else {
                        forecastMap[dateStr].high = Math.max(forecastMap[dateStr].high, Math.round(item.main.temp_max));
                        forecastMap[dateStr].low = Math.min(forecastMap[dateStr].low, Math.round(item.main.temp_min));
                        if (iconScore < forecastMap[dateStr].iconScore) {
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
                            forecastMap[dateStr].iconScore = iconScore;
                        }
                    }
                });
                const todayForecast = forecastMap[todayKey];
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
                });
                const forecastArray = Object.values(forecastMap)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .filter(day => day.date >= tomorrowKey)
                    .slice(0, 5)
                    .map(({ iconScore, ...day }) => day);
                setForecast(forecastArray);
                // Fetch onecall (alerts + UV) and air pollution in parallel
                const [onecallResult, aqiResult] = await Promise.allSettled([
                    axios.get(`https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`),
                    axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`),
                ]);
                if (onecallResult.status === 'fulfilled') {
                    const rawAlerts = onecallResult.value.data?.alerts ?? [];
                    setAlerts(rawAlerts.map((alert) => ({
                        event: alert.event || 'Weather Alert',
                        description: alert.description || '',
                        start: alert.start || 0,
                        end: alert.end || 0,
                        senderName: alert.sender_name || 'OpenWeather',
                    })));
                    const uvi = onecallResult.value.data?.current?.uvi;
                    if (uvi != null)
                        setUvIndex(Math.round(uvi));
                }
                else {
                    setAlerts([]);
                    console.warn('Weather alerts/UV fetch error:', onecallResult.reason);
                }
                if (aqiResult.status === 'fulfilled') {
                    const aqiVal = aqiResult.value.data?.list?.[0]?.main?.aqi;
                    if (aqiVal != null)
                        setAqi(aqiVal);
                }
                else {
                    console.warn('Air quality fetch error:', aqiResult.reason);
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
    const uvLabel = (uv) => {
        if (uv <= 2)
            return 'Low';
        if (uv <= 5)
            return 'Moderate';
        if (uv <= 7)
            return 'High';
        if (uv <= 10)
            return 'Very High';
        return 'Extreme';
    };
    const uvColor = (uv) => {
        if (uv <= 2)
            return '#4ade80';
        if (uv <= 5)
            return '#facc15';
        if (uv <= 7)
            return '#fb923c';
        if (uv <= 10)
            return '#f87171';
        return '#c084fc';
    };
    const aqiLabel = (a) => ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'][a] ?? 'Unknown';
    const aqiColor = (a) => ['', '#4ade80', '#a3e635', '#facc15', '#fb923c', '#f87171'][a] ?? '#9aa4b2';
    if (loading) {
        return _jsx("div", { className: `weather-container ${variant}`, children: "Loading weather..." });
    }
    if (error) {
        return _jsx("div", { className: `weather-container error ${variant}`, children: error });
    }
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: `weather-container ${variant}`, children: [variant !== 'compact' && alerts.length > 0 && (_jsx("div", { className: `weather-alerts ${variant}`, children: alerts.map(alert => (_jsxs("div", { className: "alert-card", children: [_jsxs("div", { className: "alert-title", children: ["\u26A0\uFE0F ", alert.event] }), _jsxs("div", { className: "alert-meta", children: [formatAlertTime(alert.start), " - ", formatAlertTime(alert.end)] }), _jsx("div", { className: "alert-source", children: alert.senderName }), alert.description && (_jsx("div", { className: "alert-desc", children: alert.description }))] }, `${alert.event}-${alert.start}`))) })), _jsx("div", { className: "current-weather", children: _jsx("div", { className: "weather-details-row", children: _jsx("div", { children: _jsxs("div", { className: "weather-details", children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center' }, children: [_jsx("div", { className: `weather-icon clickable${expandedCurrent ? ' expanded' : ''}`, onClick: () => setExpandedCurrent(!expandedCurrent), tabIndex: 0, role: "button", "aria-label": "Show current weather details", style: { marginRight: '0.5em' }, children: current ? getWeatherEmoji(current.icon) : '' }), _jsxs("div", { className: "temp", children: [current?.temp, "\u00B0F"] })] }), _jsxs("div", { className: "condition-block", children: [_jsx("div", { className: "condition", children: current?.condition }), _jsxs("div", { className: "daily-range", children: ["H ", current?.max, "\u00B0 / L ", current?.min, "\u00B0"] }), current && (_jsxs("div", { className: "feels-like-index", style: { color: '#fb923c', fontWeight: 600 }, children: ["Feels Like ", current.feelsLike, "\u00B0F"] }))] }), _jsx("div", { className: "location", children: "Winterville, GA" }), _jsxs("div", { className: "additional", children: [_jsxs("span", { children: ["\uD83D\uDCA7 ", current?.humidity, "%"] }), _jsxs("span", { children: ["\uD83D\uDCA8 ", current?.windSpeed, " mph"] })] })] }) }) }) }), variant === 'compact' ? (_jsx("div", { className: "forecast-compact", children: forecast.map((day, idx) => (_jsxs("div", { className: `forecast-chip clickable${expandedIndex === idx ? ' expanded' : ''}`, onClick: () => setExpandedIndex(expandedIndex === idx ? null : idx), tabIndex: 0, role: "button", "aria-label": `Show details for ${formatForecastDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}`, children: [_jsx("div", { className: "chip-day", children: formatForecastDate(day.date, {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                    }) }), _jsx("div", { className: "chip-icon", children: getWeatherEmoji(day.icon) }), _jsxs("div", { className: "chip-temps", children: [_jsxs("span", { className: "high", children: [day.high, "\u00B0"] }), _jsxs("span", { className: "low", children: [day.low, "\u00B0"] })] })] }, day.date))) })) : (_jsxs("div", { className: "forecast", children: [_jsx("h3", { children: "5-Day Forecast" }), _jsx("div", { className: "forecast-grid", children: forecast.slice(0, 5).map((day, idx) => (_jsxs("div", { className: `forecast-item clickable${expandedIndex === idx ? ' expanded' : ''}`, onClick: () => setExpandedIndex(expandedIndex === idx ? null : idx), tabIndex: 0, role: "button", "aria-label": `Show details for ${formatForecastDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}`, children: [_jsx("div", { className: "forecast-date", children: formatForecastDate(day.date, {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                            }) }), _jsx("div", { className: "forecast-icon", children: getWeatherEmoji(day.icon) }), _jsxs("div", { className: "forecast-temps", children: [_jsxs("span", { className: "high", children: [day.high, "\u00B0"] }), _jsxs("span", { className: "low", children: [day.low, "\u00B0"] })] })] }, day.date))) })] }))] }), current && (_jsx("div", { className: "weather-modal", onClick: () => setExpandedCurrent(false), style: {
                    visibility: expandedCurrent ? 'visible' : 'hidden',
                    opacity: expandedCurrent ? 1 : 0,
                    pointerEvents: expandedCurrent ? 'auto' : 'none',
                    transition: 'opacity 0.15s ease',
                }, children: _jsxs("div", { className: "weather-modal-content", onClick: e => e.stopPropagation(), children: [_jsx("button", { className: "weather-modal-close", onClick: () => setExpandedCurrent(false), "aria-label": "Close weather details", style: { position: 'absolute', top: '1em', right: '1em', fontSize: '2em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10000 }, children: "\u00D7" }), _jsxs("div", { className: "weather-modal-header", style: { fontSize: '2em', marginBottom: '1em', display: 'flex', alignItems: 'center', gap: '1em' }, children: [_jsx("span", { className: "weather-modal-date", children: "Current Weather" }), _jsx("span", { className: "weather-modal-icon", children: getWeatherEmoji(current.icon) })] }), _jsxs("div", { style: { display: 'flex', gap: '1em', flex: 1, minHeight: 0, height: '100%', flexWrap: 'wrap' }, children: [_jsxs("div", { className: "weather-modal-details", style: { flex: 1, fontSize: '1em', minWidth: '200px', height: '100%', wordBreak: 'break-word', overflowWrap: 'anywhere' }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Temperature:" }), " ", current.temp, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Feels Like:" }), " ", current.feelsLike, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Min:" }), " ", current.min, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Max:" }), " ", current.max, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Condition:" }), " ", current.condition, " (", current.description, ")"] }), _jsxs("div", { children: [_jsx("strong", { children: "Humidity:" }), " ", current.humidity, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Pressure:" }), " ", current.pressure, " hPa"] }), _jsxs("div", { children: [_jsx("strong", { children: "Clouds:" }), " ", current.clouds, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Visibility:" }), " ", current.visibility, " m"] }), _jsxs("div", { children: [_jsx("strong", { children: "Dew Point:" }), " ", current.dewPoint ?? 'N/A', "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation:" }), " Rain ", current.rain ?? 0, " mm, Snow ", current.snow ?? 0, " mm"] }), _jsxs("div", { children: [_jsx("strong", { children: "Wind:" }), " ", current.windSpeed, " mph, ", current.windDeg, "\u00B0, Gust ", current.windGust ?? 'N/A', " mph"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation Probability:" }), " ", current.pop !== undefined ? Math.round((current.pop ?? 0) * 100) : 'N/A', "%"] }), uvIndex != null && (_jsxs("div", { children: [_jsx("strong", { children: "UV Index:" }), " ", _jsxs("span", { style: { color: uvColor(uvIndex) }, children: [uvIndex, " \u2014 ", uvLabel(uvIndex)] })] })), aqi != null && (_jsxs("div", { children: [_jsx("strong", { children: "Air Quality:" }), " ", _jsx("span", { style: { color: aqiColor(aqi) }, children: aqiLabel(aqi) })] })), _jsxs("div", { children: [_jsx("strong", { children: "Location:" }), " Winterville, GA"] })] }), _jsx("div", { className: "weather-modal-radar", style: { flex: 2, minWidth: 0, minHeight: 0, height: '100%', width: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', position: 'relative' }, children: _jsx(AnimatedRadar, {}) })] }), _jsxs("div", { className: "hourly-forecast-modal", style: { marginTop: '2em', fontSize: isTvView ? '1em' : '1.2em', overflowX: isTvView ? 'hidden' : 'auto' }, children: [_jsx("div", { className: "hourly-forecast-title", style: { fontSize: isTvView ? '1.25em' : '1.5em', marginBottom: '0.5em' }, children: "Hourly Forecast" }), _jsx("div", { className: "hourly-forecast-row", style: isTvView
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
                                        }, children: hourly.map(hour => (_jsxs("div", { className: "hourly-block", style: {
                                            minWidth: isTvView ? '0' : '60px',
                                            padding: isTvView ? '0.1em' : '0.25em',
                                            background: '#333',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            flex: isTvView ? undefined : '0 0 auto',
                                            fontSize: isTvView ? '0.55em' : '0.75em',
                                        }, children: [_jsx("div", { className: "hourly-time", style: { fontSize: '0.9em' }, children: new Date(hour.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) }), _jsx("div", { className: "hourly-icon", style: { fontSize: isTvView ? '1.1em' : '1.3em' }, children: getWeatherEmoji(hour.weather[0].icon) }), _jsxs("div", { className: "hourly-temp", children: [Math.round(hour.main.temp), "\u00B0"] }), _jsxs("div", { className: "hourly-pop", children: [hour.pop !== undefined ? Math.round(hour.pop * 100) : 'N/A', "%"] })] }, hour.dt))) })] })] }) })), expandedIndex !== null && forecast[expandedIndex] && (_jsx("div", { className: "weather-modal", onClick: () => setExpandedIndex(null), children: _jsxs("div", { className: "weather-modal-content", onClick: e => e.stopPropagation(), children: [_jsx("button", { className: "weather-modal-close", onClick: () => setExpandedIndex(null), "aria-label": "Close weather details", style: { position: 'absolute', top: '1em', right: '1em', fontSize: '2em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10000 }, children: "\u00D7" }), _jsxs("div", { className: "weather-modal-header", style: { fontSize: '2em', marginBottom: '1em', display: 'flex', alignItems: 'center', gap: '1em' }, children: [_jsx("span", { className: "weather-modal-date", children: formatForecastDate(forecast[expandedIndex].date, { weekday: 'long', month: 'long', day: 'numeric' }) }), _jsx("span", { className: "weather-modal-icon", children: getWeatherEmoji(forecast[expandedIndex].icon) })] }), _jsxs("div", { className: "weather-modal-details", style: { fontSize: '1.5em', overflowY: 'auto', minWidth: '350px' }, children: [_jsxs("div", { children: [_jsx("strong", { children: "High:" }), " ", forecast[expandedIndex].high, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Low:" }), " ", forecast[expandedIndex].low, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Condition:" }), " ", forecast[expandedIndex].condition, " (", forecast[expandedIndex].description, ")"] }), _jsxs("div", { children: [_jsx("strong", { children: "Pressure:" }), " ", forecast[expandedIndex].pressure, " hPa"] }), _jsxs("div", { children: [_jsx("strong", { children: "Humidity:" }), " ", forecast[expandedIndex].humidity, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Clouds:" }), " ", forecast[expandedIndex].clouds, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Visibility:" }), " ", forecast[expandedIndex].visibility, " m"] }), _jsxs("div", { children: [_jsx("strong", { children: "Dew Point:" }), " ", forecast[expandedIndex].dewPoint ?? 'N/A', "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation:" }), " Rain ", forecast[expandedIndex].rain ?? 0, " mm, Snow ", forecast[expandedIndex].snow ?? 0, " mm"] }), _jsxs("div", { children: [_jsx("strong", { children: "Wind:" }), " ", forecast[expandedIndex].windSpeed, " mph, ", forecast[expandedIndex].windDeg, "\u00B0, Gust ", forecast[expandedIndex].windGust ?? 'N/A', " mph"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation Probability:" }), " ", forecast[expandedIndex].pop !== undefined ? Math.round((forecast[expandedIndex].pop ?? 0) * 100) : 'N/A', "%"] })] })] }) }))] }));
}
