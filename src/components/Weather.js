import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Weather.css';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
// NOAA/NWS animated radar map centered on Winterville, GA
function RadarMap() {
    // Winterville, GA coordinates
    const center = [33.8485, -83.2139];
    // NWS radar tile layer (animation)
    // Example: https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=YOUR_API_KEY
    // For NWS, use https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi
    // For animation, we can use the latest radar layer
    // Example: https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png
    // We'll use zoom 7 for a broad region
    // Show only the latest radar frame (no animation)
    const radarTileUrl = "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png";
    const openWeatherApiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
    const windTileUrl = openWeatherApiKey
        ? `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${openWeatherApiKey}`
        : null;
    return (_jsx("div", { style: { width: '100%', height: '100%', minHeight: 300 }, children: _jsxs(MapContainer, { center: center, zoom: 9, dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false, boxZoom: false, keyboard: false, zoomControl: false, attributionControl: false, style: { width: '100%', height: '100%', minHeight: 300, borderRadius: '16px', overflow: 'hidden' }, children: [_jsx(TileLayer, { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "\u00A9 OpenStreetMap contributors" }), _jsx(TileLayer, { url: radarTileUrl, attribution: "Radar \u00A9 NOAA/NWS", opacity: 0.7 }), windTileUrl && (_jsx(TileLayer, { url: windTileUrl, attribution: "Wind \u00A9 OpenWeather", opacity: 0.45 }))] }) }));
}
// RainViewer animated radar tiles with NOAA/NWS fallback.
function RainViewerWithFallback() {
    const [mode, setMode] = useState('rainviewer');
    const [isLightTheme, setIsLightTheme] = useState(false);
    const [isTvDevice, setIsTvDevice] = useState(false);
    const [frameUrls, setFrameUrls] = useState([]);
    const [frameIndex, setFrameIndex] = useState(0);
    const [loadingFrames, setLoadingFrames] = useState(true);
    const rainViewerZoom = 7;
    const rainViewerMaxZoom = 7;
    useEffect(() => {
        const ua = navigator.userAgent || '';
        const tvPattern = /(Android TV|SmartTV|HbbTV|NetCast|Tizen|Web0S|BRAVIA|AFT|TV)/i;
        setIsTvDevice(tvPattern.test(ua));
    }, []);
    useEffect(() => {
        const appContainer = document.querySelector('.app-container');
        if (!appContainer)
            return;
        const updateTheme = () => {
            setIsLightTheme(appContainer.classList.contains('theme-light'));
        };
        updateTheme();
        const observer = new MutationObserver(updateTheme);
        observer.observe(appContainer, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        if (mode !== 'rainviewer')
            return;
        let cancelled = false;
        const loadFrames = async () => {
            try {
                setLoadingFrames(true);
                const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
                const data = await response.json();
                const host = data?.host || 'https://tilecache.rainviewer.com';
                const past = data?.radar?.past || [];
                const nowcast = data?.radar?.nowcast || [];
                const frames = [...past, ...nowcast].slice(-12);
                const urls = frames
                    .map((frame) => frame?.path)
                    .filter((path) => Boolean(path))
                    .map((path) => `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`);
                if (!cancelled) {
                    if (urls.length === 0) {
                        setMode('noaa');
                    }
                    else {
                        setFrameUrls(urls);
                        setFrameIndex(0);
                    }
                    setLoadingFrames(false);
                }
            }
            catch {
                if (!cancelled) {
                    setMode('noaa');
                    setLoadingFrames(false);
                }
            }
        };
        loadFrames();
        return () => {
            cancelled = true;
        };
    }, [mode]);
    useEffect(() => {
        if (mode !== 'rainviewer' || frameUrls.length < 2)
            return;
        const interval = setInterval(() => {
            setFrameIndex(index => (index + 1) % frameUrls.length);
        }, 700);
        return () => clearInterval(interval);
    }, [mode, frameUrls]);
    if (mode === 'noaa') {
        return (_jsxs("div", { style: { width: '100%', height: '100%', minHeight: 300, position: 'relative' }, children: [_jsx(RadarMap, {}), !isTvDevice && (_jsx("button", { onClick: () => {
                        setMode('rainviewer');
                    }, tabIndex: -1, style: {
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
                    }, children: "Try Animated Radar" }))] }));
    }
    if (loadingFrames) {
        return (_jsx("div", { style: { width: '100%', height: '100%', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', background: isLightTheme ? '#eef3f8' : '#10151f', color: isLightTheme ? '#172033' : '#ecf0f6' }, children: "Loading animated radar..." }));
    }
    return (_jsxs("div", { style: { width: '100%', height: '100%', minHeight: 300, position: 'relative' }, children: [_jsxs(MapContainer, { center: [33.8485, -83.2139], zoom: rainViewerZoom, minZoom: 4, maxZoom: rainViewerMaxZoom, dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false, boxZoom: false, keyboard: false, zoomControl: false, attributionControl: false, style: { width: '100%', height: '100%', minHeight: 300, borderRadius: '16px', overflow: 'hidden' }, children: [_jsx(TileLayer, { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "\u00A9 OpenStreetMap contributors" }), _jsx(TileLayer, { url: frameUrls[frameIndex], attribution: "Radar \u00A9 RainViewer", opacity: 0.75, maxNativeZoom: rainViewerMaxZoom, maxZoom: rainViewerMaxZoom }, frameUrls[frameIndex])] }), _jsxs("div", { style: {
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    zIndex: 1200,
                    borderRadius: 8,
                    padding: '6px 10px',
                    background: isLightTheme ? 'rgba(255,255,255,0.9)' : 'rgba(16,21,31,0.88)',
                    color: isLightTheme ? '#172033' : '#ecf0f6',
                    fontSize: '0.82rem',
                }, children: ["Animated Radar ", frameIndex + 1, "/", Math.max(frameUrls.length, 1)] }), !isTvDevice && (_jsx("button", { onClick: () => setMode('noaa'), tabIndex: -1, style: {
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
                }, children: "Show NOAA + Wind" }))] }));
}
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
                                            }) }), _jsx("div", { className: "forecast-icon", children: getWeatherEmoji(day.icon) }), _jsxs("div", { className: "forecast-temps", children: [_jsxs("span", { className: "high", children: [day.high, "\u00B0"] }), _jsxs("span", { className: "low", children: [day.low, "\u00B0"] })] })] }, day.date))) })] }))] }), expandedCurrent && current && (_jsx("div", { className: "weather-modal", onClick: () => setExpandedCurrent(false), children: _jsxs("div", { className: "weather-modal-content", onClick: e => e.stopPropagation(), children: [_jsx("button", { className: "weather-modal-close", onClick: () => setExpandedCurrent(false), "aria-label": "Close weather details", style: { position: 'absolute', top: '1em', right: '1em', fontSize: '2em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10000 }, children: "\u00D7" }), _jsxs("div", { className: "weather-modal-header", style: { fontSize: '2em', marginBottom: '1em', display: 'flex', alignItems: 'center', gap: '1em' }, children: [_jsx("span", { className: "weather-modal-date", children: "Current Weather" }), _jsx("span", { className: "weather-modal-icon", children: getWeatherEmoji(current.icon) })] }), _jsxs("div", { style: { display: 'flex', gap: '1em', flex: 1, minHeight: 0, height: '100%', flexWrap: 'wrap' }, children: [_jsxs("div", { className: "weather-modal-details", style: { flex: 1, fontSize: '1em', minWidth: '200px', height: '100%', wordBreak: 'break-word', overflowWrap: 'anywhere' }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Temperature:" }), " ", current.temp, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Feels Like:" }), " ", current.feelsLike, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Min:" }), " ", current.min, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Max:" }), " ", current.max, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Condition:" }), " ", current.condition, " (", current.description, ")"] }), _jsxs("div", { children: [_jsx("strong", { children: "Humidity:" }), " ", current.humidity, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Pressure:" }), " ", current.pressure, " hPa"] }), _jsxs("div", { children: [_jsx("strong", { children: "Clouds:" }), " ", current.clouds, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Visibility:" }), " ", current.visibility, " m"] }), _jsxs("div", { children: [_jsx("strong", { children: "Dew Point:" }), " ", current.dewPoint ?? 'N/A', "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation:" }), " Rain ", current.rain ?? 0, " mm, Snow ", current.snow ?? 0, " mm"] }), _jsxs("div", { children: [_jsx("strong", { children: "Wind:" }), " ", current.windSpeed, " mph, ", current.windDeg, "\u00B0, Gust ", current.windGust ?? 'N/A', " mph"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation Probability:" }), " ", current.pop !== undefined ? Math.round((current.pop ?? 0) * 100) : 'N/A', "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Location:" }), " Winterville, GA"] })] }), _jsx("div", { className: "weather-modal-radar", style: { flex: 2, minWidth: 0, minHeight: 0, height: '100%', width: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', position: 'relative' }, children: _jsx(RainViewerWithFallback, {}) })] }), _jsxs("div", { className: "hourly-forecast-modal", style: { marginTop: '2em', fontSize: isTvView ? '1em' : '1.2em', overflowX: isTvView ? 'hidden' : 'auto' }, children: [_jsx("div", { className: "hourly-forecast-title", style: { fontSize: isTvView ? '1.25em' : '1.5em', marginBottom: '0.5em' }, children: "Hourly Forecast" }), _jsx("div", { className: "hourly-forecast-row", style: isTvView
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
                                        }, children: [_jsx("div", { className: "hourly-time", style: { fontSize: '0.9em' }, children: new Date(hour.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) }), _jsx("div", { className: "hourly-icon", style: { fontSize: isTvView ? '1.1em' : '1.3em' }, children: getWeatherEmoji(hour.weather[0].icon) }), _jsxs("div", { className: "hourly-temp", children: [Math.round(hour.main.temp), "\u00B0"] }), _jsxs("div", { className: "hourly-pop", children: [hour.pop !== undefined ? Math.round(hour.pop * 100) : 'N/A', "%"] })] }, hour.dt))) })] })] }) })), expandedIndex !== null && forecast[expandedIndex] && (_jsx("div", { className: "weather-modal", onClick: () => setExpandedIndex(null), children: _jsxs("div", { className: "weather-modal-content", onClick: e => e.stopPropagation(), children: [_jsx("button", { className: "weather-modal-close", onClick: () => setExpandedIndex(null), "aria-label": "Close weather details", style: { position: 'absolute', top: '1em', right: '1em', fontSize: '2em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10000 }, children: "\u00D7" }), _jsxs("div", { className: "weather-modal-header", style: { fontSize: '2em', marginBottom: '1em', display: 'flex', alignItems: 'center', gap: '1em' }, children: [_jsx("span", { className: "weather-modal-date", children: new Date(forecast[expandedIndex].date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' }) }), _jsx("span", { className: "weather-modal-icon", children: getWeatherEmoji(forecast[expandedIndex].icon) })] }), _jsxs("div", { className: "weather-modal-details", style: { fontSize: '1.5em', overflowY: 'auto', minWidth: '350px' }, children: [_jsxs("div", { children: [_jsx("strong", { children: "High:" }), " ", forecast[expandedIndex].high, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Low:" }), " ", forecast[expandedIndex].low, "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Condition:" }), " ", forecast[expandedIndex].condition, " (", forecast[expandedIndex].description, ")"] }), _jsxs("div", { children: [_jsx("strong", { children: "Pressure:" }), " ", forecast[expandedIndex].pressure, " hPa"] }), _jsxs("div", { children: [_jsx("strong", { children: "Humidity:" }), " ", forecast[expandedIndex].humidity, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Clouds:" }), " ", forecast[expandedIndex].clouds, "%"] }), _jsxs("div", { children: [_jsx("strong", { children: "Visibility:" }), " ", forecast[expandedIndex].visibility, " m"] }), _jsxs("div", { children: [_jsx("strong", { children: "Dew Point:" }), " ", forecast[expandedIndex].dewPoint ?? 'N/A', "\u00B0F"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation:" }), " Rain ", forecast[expandedIndex].rain ?? 0, " mm, Snow ", forecast[expandedIndex].snow ?? 0, " mm"] }), _jsxs("div", { children: [_jsx("strong", { children: "Wind:" }), " ", forecast[expandedIndex].windSpeed, " mph, ", forecast[expandedIndex].windDeg, "\u00B0, Gust ", forecast[expandedIndex].windGust ?? 'N/A', " mph"] }), _jsxs("div", { children: [_jsx("strong", { children: "Precipitation Probability:" }), " ", forecast[expandedIndex].pop !== undefined ? Math.round((forecast[expandedIndex].pop ?? 0) * 100) : 'N/A', "%"] })] })] }) }))] }));
}
