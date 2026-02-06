import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import Clock from './components/Clock';
import Calendar from './components/Calendar';
import Weather from './components/Weather';
import EmergencyAlertBanner from './components/EmergencyAlertBanner';
import './App.css';
function App() {
    const [hasAlerts, setHasAlerts] = useState(false);
    const [manualAlertActive, setManualAlertActive] = useState(false);
    const [theme, setTheme] = useState(() => {
        try {
            const stored = localStorage.getItem('appTheme');
            if (stored === 'light' || stored === 'dark' || stored === 'auto') {
                return stored;
            }
            return 'dark';
        }
        catch {
            return 'dark';
        }
    });
    const [resolvedTheme, setResolvedTheme] = useState('dark');
    const [sunTimes, setSunTimes] = useState(null);
    useEffect(() => {
        if (theme !== 'auto') {
            return;
        }
        let isMounted = true;
        const lat = 33.8485;
        const lon = -83.2139;
        const fetchSunTimes = async () => {
            try {
                const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
                if (apiKey) {
                    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`);
                    if (!response.ok) {
                        throw new Error(`OpenWeather ${response.status}`);
                    }
                    const data = await response.json();
                    const sunrise = Number(data?.sys?.sunrise);
                    const sunset = Number(data?.sys?.sunset);
                    if (Number.isFinite(sunrise) && Number.isFinite(sunset) && isMounted) {
                        setSunTimes({ sunrise, sunset });
                        return;
                    }
                }
                const fallback = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`);
                if (!fallback.ok) {
                    throw new Error(`Sunrise API ${fallback.status}`);
                }
                const fallbackData = await fallback.json();
                const sunriseIso = fallbackData?.results?.sunrise;
                const sunsetIso = fallbackData?.results?.sunset;
                const sunrise = sunriseIso ? Date.parse(sunriseIso) / 1000 : NaN;
                const sunset = sunsetIso ? Date.parse(sunsetIso) / 1000 : NaN;
                if (Number.isFinite(sunrise) && Number.isFinite(sunset) && isMounted) {
                    setSunTimes({ sunrise, sunset });
                }
            }
            catch {
                // keep previous sun times if available
            }
        };
        fetchSunTimes();
        const interval = setInterval(fetchSunTimes, 6 * 60 * 60 * 1000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [theme]);
    useEffect(() => {
        const resolveTheme = () => {
            if (theme === 'dark' || theme === 'light') {
                setResolvedTheme(theme);
                return;
            }
            if (!sunTimes) {
                setResolvedTheme('dark');
                return;
            }
            const nowSeconds = Date.now() / 1000;
            const isDaytime = nowSeconds >= sunTimes.sunrise && nowSeconds < sunTimes.sunset;
            setResolvedTheme(isDaytime ? 'light' : 'dark');
        };
        resolveTheme();
        const interval = setInterval(resolveTheme, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [theme, sunTimes]);
    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        try {
            localStorage.setItem('appTheme', newTheme);
        }
        catch {
            // localStorage not available
        }
    };
    return (_jsxs("div", { className: `app-container ${hasAlerts ? 'has-alerts' : ''} theme-${resolvedTheme}`, children: [_jsxs("header", { className: "top-bar", children: [_jsx("div", { className: "top-left", children: _jsx(Weather, { variant: "compact" }) }), _jsx("div", { className: "top-right", children: _jsx(Clock, {}) })] }), _jsx("main", { className: "main-content", children: _jsx(Calendar, { theme: theme, onThemeChange: handleThemeChange, manualAlertActive: manualAlertActive, onToggleManualAlert: () => setManualAlertActive(!manualAlertActive) }) }), _jsx(EmergencyAlertBanner, { onAlertsChange: setHasAlerts, manualAlertActive: manualAlertActive })] }));
}
export default App;
