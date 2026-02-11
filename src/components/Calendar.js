import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import '../styles/Calendar.css';
const DEFAULT_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
export default function Calendar({ theme, onThemeChange, manualAlertActive, onToggleManualAlert }) {
    const [events, setEvents] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [daysInMonth, setDaysInMonth] = useState([]);
    const [firstDayOffset, setFirstDayOffset] = useState(0);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsRef = useRef(null);
    const settingsButtonRef = useRef(null);
    const [viewMode, setViewMode] = useState(() => {
        try {
            const stored = localStorage.getItem('calendarViewMode');
            if (stored === 'monthly' || stored === 'weekly' || stored === 'daily') {
                return stored;
            }
            return 'monthly';
        }
        catch {
            return 'monthly';
        }
    });
    const [hiddenCalendars, setHiddenCalendars] = useState(() => {
        try {
            const stored = localStorage.getItem('hiddenCalendars');
            if (!stored)
                return [];
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed.filter((value) => Number.isFinite(value)) : [];
        }
        catch {
            return [];
        }
    });
    const getCalendarColors = (count) => {
        const colors = [];
        for (let i = 1; i <= count; i++) {
            const raw = import.meta.env?.[`VITE_Calendar_color_${i}`];
            if (raw && raw.trim().length > 0) {
                colors.push(raw.trim().replace(/^['"]|['"]$/g, ''));
            }
        }
        if (colors.length === 0) {
            return DEFAULT_COLORS;
        }
        return colors;
    };
    const getCalendarName = (index) => {
        const raw = import.meta.env?.[`VITE_Calendar_name_${index}`];
        if (raw && raw.trim().length > 0) {
            return raw.trim().replace(/^['"]|['"]$/g, '');
        }
        return `Calendar ${index}`;
    };
    const toggleCalendarVisibility = (index) => {
        setHiddenCalendars((prev) => prev.includes(index) ? prev.filter((value) => value !== index) : [...prev, index]);
        setSettingsOpen(false);
    };
    const toggleTheme = (newTheme) => {
        onThemeChange(newTheme);
        setSettingsOpen(false);
    };
    const fetchIcs = async (url) => {
        // Convert Google Calendar URL to use Vite proxy
        let proxyUrl = url;
        try {
            const parsed = new URL(url);
            if (parsed.hostname === 'calendar.google.com') {
                proxyUrl = url.replace('https://calendar.google.com/calendar', '/api/calendar');
            }
            else if (parsed.hostname === 'import.calendar.google.com') {
                proxyUrl = url.replace('https://import.calendar.google.com/calendar', '/api/calendar-import');
            }
        }
        catch {
            // leave proxyUrl as-is for non-standard URLs
        }
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.text();
        }
        catch (error) {
            console.error(`Failed to fetch calendar from ${url}:`, error);
            // Try fallback proxies
            const proxies = [
                `https://corsproxy.io/?${encodeURIComponent(url)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
            ];
            for (const proxy of proxies) {
                try {
                    const response = await fetch(proxy);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    return response.text();
                }
                catch (proxyError) {
                    console.warn(`Calendar proxy failed for ${url}:`, proxyError);
                }
            }
            throw error;
        }
    };
    useEffect(() => {
        const fetchCalendars = async () => {
            const calendarUrlsStr = import.meta.env?.VITE_CALENDAR_URLS;
            if (!calendarUrlsStr) {
                console.warn('No calendar URLs configured in VITE_CALENDAR_URLS');
                return;
            }
            const urls = calendarUrlsStr.split(',').map(u => u.trim());
            const calendarColors = getCalendarColors(urls.length);
            const allEvents = [];
            const rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const rangeEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
            let eventCounter = 0;
            for (let i = 0; i < urls.length; i++) {
                try {
                    const calendarName = getCalendarName(i + 1);
                    const data = await fetchIcs(urls[i]);
                    const parsed = parseICS(data);
                    // Debug: Log Family calendar parsing
                    if (calendarName === 'Family') {
                        console.log(`[Family Calendar] Fetched and parsed ${parsed.length} events`);
                        console.log(`[Family Calendar] Date range: ${rangeStart.toDateString()} to ${rangeEnd.toDateString()}`);
                    }
                    parsed.forEach((event) => {
                        const occurrences = expandRecurringEvent(event, rangeStart, rangeEnd);
                        // Debug: Log Family calendar expansions
                        if (calendarName === 'Family' && event.title) {
                            if (occurrences.length > 0) {
                                console.log(`[Family Calendar] "${event.title}" expanded to ${occurrences.length} occurrence(s)`);
                                occurrences.forEach(occ => {
                                    console.log(`  - ${occ.start.toDateString()}`);
                                });
                            }
                            else if (event.rrule || (event.start.getMonth() === currentDate.getMonth() && event.start.getFullYear() === currentDate.getFullYear())) {
                                console.log(`[Family Calendar] "${event.title}" (${event.start.toDateString()}) - NO occurrences in range`);
                            }
                        }
                        occurrences.forEach(occurrence => {
                            const startDate = new Date(occurrence.start);
                            const endDate = new Date(occurrence.end);
                            const daysSpanned = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                            allEvents.push({
                                id: `${i}-${occurrence.title}-${occurrence.start.getTime()}-${eventCounter++}`,
                                title: occurrence.title,
                                start: startDate,
                                end: endDate,
                                color: calendarColors[i % calendarColors.length],
                                calendarIndex: i,
                                daysSpanned,
                                location: occurrence.location,
                            });
                        });
                    });
                }
                catch (error) {
                    console.error(`Failed to fetch calendar from ${urls[i]}:`, error);
                }
            }
            // Deduplicate events based on title and start time
            const uniqueEvents = allEvents.filter((event, index, self) => {
                return index === self.findIndex((e) => e.title === event.title &&
                    e.start.getTime() === event.start.getTime());
            });
            setEvents(uniqueEvents);
        };
        fetchCalendars();
        const interval = setInterval(fetchCalendars, 1 * 60 * 1000); // Refresh every 1 minute
        return () => clearInterval(interval);
    }, [currentDate]);
    useEffect(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        setFirstDayOffset(firstDay.getDay());
        const days = [];
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(i);
        }
        setDaysInMonth(days);
    }, [currentDate]);
    useEffect(() => {
        localStorage.setItem('hiddenCalendars', JSON.stringify(hiddenCalendars));
    }, [hiddenCalendars]);
    useEffect(() => {
        localStorage.setItem('calendarViewMode', viewMode);
    }, [viewMode]);
    useEffect(() => {
        if (!settingsOpen)
            return;
        const handleClickOutside = (event) => {
            const target = event.target;
            if (settingsRef.current?.contains(target))
                return;
            if (settingsButtonRef.current?.contains(target))
                return;
            setSettingsOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setSettingsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [settingsOpen]);
    const goToToday = () => setCurrentDate(new Date());
    const goToPrev = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const day = currentDate.getDate();
        if (viewMode === 'monthly') {
            setCurrentDate(new Date(year, month - 1, 1));
        }
        else if (viewMode === 'weekly') {
            setCurrentDate(new Date(year, month, day - 7));
        }
        else {
            setCurrentDate(new Date(year, month, day - 1));
        }
    };
    const goToNext = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const day = currentDate.getDate();
        if (viewMode === 'monthly') {
            setCurrentDate(new Date(year, month + 1, 1));
        }
        else if (viewMode === 'weekly') {
            setCurrentDate(new Date(year, month, day + 7));
        }
        else {
            setCurrentDate(new Date(year, month, day + 1));
        }
    };
    const parseICS = (icsText) => {
        const events = [];
        const cancellations = new Set();
        const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
        const lines = unfolded.split(/\r?\n/);
        let currentEvent = {};
        let inEvent = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === 'BEGIN:VEVENT') {
                inEvent = true;
                currentEvent = {};
            }
            else if (trimmed === 'END:VEVENT') {
                // Track cancellations
                if (currentEvent.status === 'CANCELLED' && currentEvent.uid) {
                    cancellations.add(currentEvent.uid);
                }
                // Only add event if not cancelled
                if (currentEvent.title && currentEvent.start && (!currentEvent.uid || !cancellations.has(currentEvent.uid)) && currentEvent.status !== 'CANCELLED') {
                    let endDate = currentEvent.end;
                    if (!endDate) {
                        if (currentEvent.durationMs) {
                            endDate = new Date(currentEvent.start.getTime() + currentEvent.durationMs);
                        }
                        else if (currentEvent.allDay) {
                            endDate = addDays(currentEvent.start, 1);
                        }
                        else {
                            endDate = new Date(currentEvent.start.getTime() + 60 * 60 * 1000);
                        }
                    }
                    events.push({
                        title: currentEvent.title,
                        start: currentEvent.start,
                        end: endDate,
                        rrule: currentEvent.rrule,
                        allDay: currentEvent.allDay,
                        location: currentEvent.location,
                    });
                }
                inEvent = false;
            }
            else if (inEvent) {
                if (trimmed.startsWith('SUMMARY:')) {
                    currentEvent.title = trimmed.substring(8);
                }
                else if (trimmed.startsWith('DTSTART')) {
                    const dateStr = trimmed.split(':').slice(1).join(':');
                    currentEvent.allDay = trimmed.includes('VALUE=DATE');
                    currentEvent.start = parseICSDate(dateStr);
                }
                else if (trimmed.startsWith('DTEND')) {
                    const dateStr = trimmed.split(':').slice(1).join(':');
                    currentEvent.allDay = currentEvent.allDay ?? trimmed.includes('VALUE=DATE');
                    currentEvent.end = parseICSDate(dateStr);
                }
                else if (trimmed.startsWith('RRULE:')) {
                    currentEvent.rrule = trimmed.substring(6);
                }
                else if (trimmed.startsWith('DURATION:')) {
                    const durationStr = trimmed.substring(9);
                    currentEvent.durationMs = parseDurationMs(durationStr);
                }
                else if (trimmed.startsWith('LOCATION:')) {
                    const rawLocation = trimmed.substring(9);
                    // Unescape ICS text: replace \n with spaces, \, with commas, and \\ with \
                    currentEvent.location = rawLocation
                        .replace(/\\n/g, ', ')
                        .replace(/\\,/g, ',')
                        .replace(/\\\\/g, '\\')
                        .trim();
                }
                else if (trimmed.startsWith('UID:')) {
                    currentEvent.uid = trimmed.substring(4);
                }
                else if (trimmed.startsWith('STATUS:')) {
                    currentEvent.status = trimmed.substring(7);
                }
            }
        }
        return events;
    };
    const expandRecurringEvent = (event, rangeStart, rangeEnd) => {
        if (!event.rrule) {
            return eventInRange(event, rangeStart, rangeEnd) ? [event] : [];
        }
        const rule = parseRRule(event.rrule);
        if (!rule.freq) {
            return eventInRange(event, rangeStart, rangeEnd) ? [event] : [];
        }
        const occurrences = [];
        const durationMs = event.end.getTime() - event.start.getTime();
        const interval = rule.interval ?? 1;
        const until = rule.until;
        if (rule.freq === 'DAILY') {
            let cursor = new Date(event.start);
            let count = 0;
            while (cursor < rangeEnd) {
                if (until && cursor > until)
                    break;
                if (cursor >= rangeStart) {
                    occurrences.push({
                        title: event.title,
                        start: new Date(cursor),
                        end: new Date(cursor.getTime() + durationMs),
                    });
                }
                count += 1;
                if (rule.count && count >= rule.count)
                    break;
                cursor = addDays(cursor, interval);
            }
            return occurrences;
        }
        if (rule.freq === 'MONTHLY') {
            const startMonthIndex = event.start.getFullYear() * 12 + event.start.getMonth();
            const rangeStartIndex = rangeStart.getFullYear() * 12 + rangeStart.getMonth();
            const rangeEndIndex = rangeEnd.getFullYear() * 12 + rangeEnd.getMonth();
            let count = 0;
            for (let monthIndex = rangeStartIndex; monthIndex <= rangeEndIndex; monthIndex += 1) {
                if ((monthIndex - startMonthIndex) % interval !== 0)
                    continue;
                const year = Math.floor(monthIndex / 12);
                const month = monthIndex % 12;
                if (rule.byday && rule.byday.length > 0) {
                    for (const entry of rule.byday) {
                        const parsed = parseByDayEntry(entry);
                        if (!parsed)
                            continue;
                        const occDate = getNthWeekdayOfMonth(year, month, weekdayToIndex(parsed.day), parsed.ordinal);
                        if (!occDate)
                            continue;
                        occDate.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds(), event.start.getMilliseconds());
                        if (occDate < event.start)
                            continue;
                        if (until && occDate > until)
                            continue;
                        if (occDate >= rangeStart && occDate < rangeEnd) {
                            occurrences.push({
                                title: event.title,
                                start: new Date(occDate),
                                end: new Date(occDate.getTime() + durationMs),
                                location: event.location,
                            });
                            count += 1;
                            if (rule.count && count >= rule.count)
                                return occurrences;
                        }
                    }
                }
                else {
                    const cursor = new Date(year, month, event.start.getDate());
                    cursor.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds(), event.start.getMilliseconds());
                    if (cursor < event.start)
                        continue;
                    if (until && cursor > until)
                        continue;
                    if (cursor >= rangeStart && cursor < rangeEnd) {
                        occurrences.push({
                            title: event.title,
                            start: new Date(cursor),
                            end: new Date(cursor.getTime() + durationMs),
                            location: event.location,
                        });
                        count += 1;
                        if (rule.count && count >= rule.count)
                            return occurrences;
                    }
                }
            }
            return occurrences;
        }
        if (rule.freq === 'WEEKLY') {
            const byDays = rule.byday?.length
                ? rule.byday.map(entry => parseByDayEntry(entry)?.day).filter(Boolean)
                : [weekdayToRrule(event.start.getDay())];
            const rangeCursorStart = new Date(rangeStart);
            rangeCursorStart.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds(), event.start.getMilliseconds());
            let dayCursor = new Date(rangeCursorStart);
            while (dayCursor < rangeEnd) {
                if (until && dayCursor > until)
                    break;
                const weeksDiff = Math.floor((dayCursor.getTime() - event.start.getTime()) / (7 * 24 * 60 * 60 * 1000));
                if (weeksDiff >= 0 && weeksDiff % interval === 0) {
                    const dayCode = weekdayToRrule(dayCursor.getDay());
                    if (byDays.includes(dayCode)) {
                        const occStart = new Date(dayCursor);
                        if (occStart >= event.start) {
                            occurrences.push({
                                title: event.title,
                                start: new Date(occStart),
                                end: new Date(occStart.getTime() + durationMs),
                                location: event.location,
                            });
                        }
                    }
                }
                dayCursor = addDays(dayCursor, 1);
            }
            return occurrences;
        }
        if (rule.freq === 'YEARLY') {
            const startYear = event.start.getFullYear();
            const rangeStartYear = rangeStart.getFullYear();
            const rangeEndYear = rangeEnd.getFullYear();
            let count = 0;
            for (let year = rangeStartYear; year <= rangeEndYear; year++) {
                if ((year - startYear) % interval !== 0)
                    continue;
                let occDate = null;
                if (rule.byday && rule.byday.length > 0 && rule.bymonth) {
                    // Handle BYDAY with BYMONTH (e.g., 2nd Sunday of November)
                    for (const entry of rule.byday) {
                        const parsed = parseByDayEntry(entry);
                        if (!parsed)
                            continue;
                        const month = rule.bymonth[0] - 1; // Convert to 0-indexed
                        occDate = getNthWeekdayOfMonth(year, month, weekdayToIndex(parsed.day), parsed.ordinal);
                        if (!occDate)
                            continue;
                        occDate.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds(), event.start.getMilliseconds());
                        if (occDate < event.start)
                            continue;
                        if (until && occDate > until)
                            continue;
                        if (occDate >= rangeStart && occDate < rangeEnd) {
                            occurrences.push({
                                title: event.title,
                                start: new Date(occDate),
                                end: new Date(occDate.getTime() + durationMs),
                                location: event.location,
                            });
                            count += 1;
                            if (rule.count && count >= rule.count)
                                return occurrences;
                        }
                    }
                }
                else {
                    // Simple yearly: same month and day
                    occDate = new Date(year, event.start.getMonth(), event.start.getDate(), event.start.getHours(), event.start.getMinutes(), event.start.getSeconds(), event.start.getMilliseconds());
                    if (occDate < event.start)
                        continue;
                    if (until && occDate > until)
                        continue;
                    if (occDate >= rangeStart && occDate < rangeEnd) {
                        occurrences.push({
                            title: event.title,
                            start: new Date(occDate),
                            end: new Date(occDate.getTime() + durationMs),
                            location: event.location,
                        });
                        count += 1;
                        if (rule.count && count >= rule.count)
                            return occurrences;
                    }
                }
            }
            return occurrences;
        }
        return eventInRange(event, rangeStart, rangeEnd) ? [event] : [];
    };
    const eventInRange = (event, rangeStart, rangeEnd) => {
        return event.start < rangeEnd && event.end > rangeStart;
    };
    const parseRRule = (rrule) => {
        const parts = rrule.split(';');
        const data = {};
        parts.forEach(part => {
            const [key, value] = part.split('=');
            if (!key || !value)
                return;
            if (key === 'FREQ')
                data.freq = value;
            if (key === 'INTERVAL')
                data.interval = Number(value);
            if (key === 'COUNT')
                data.count = Number(value);
            if (key === 'UNTIL')
                data.until = parseICSDate(value);
            if (key === 'BYDAY')
                data.byday = value.split(',');
            if (key === 'BYMONTH')
                data.bymonth = value.split(',').map(m => Number(m));
        });
        return data;
    };
    const addDays = (date, days) => {
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
    };
    const parseByDayEntry = (entry) => {
        const match = entry.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
        if (!match)
            return null;
        const ordinal = match[1] ? Number(match[1]) : undefined;
        return { ordinal, day: match[2] };
    };
    const weekdayToIndex = (day) => {
        return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(day);
    };
    const getNthWeekdayOfMonth = (year, month, weekdayIndex, ordinal) => {
        if (weekdayIndex < 0)
            return null;
        if (!ordinal) {
            ordinal = 1;
        }
        if (ordinal > 0) {
            const firstOfMonth = new Date(year, month, 1);
            const firstWeekdayOffset = (weekdayIndex - firstOfMonth.getDay() + 7) % 7;
            const day = 1 + firstWeekdayOffset + (ordinal - 1) * 7;
            const candidate = new Date(year, month, day);
            return candidate.getMonth() === month ? candidate : null;
        }
        const lastOfMonth = new Date(year, month + 1, 0);
        const lastWeekdayOffset = (lastOfMonth.getDay() - weekdayIndex + 7) % 7;
        const day = lastOfMonth.getDate() - lastWeekdayOffset + (ordinal + 1) * 7;
        const candidate = new Date(year, month, day);
        return candidate.getMonth() === month ? candidate : null;
    };
    const weekdayToRrule = (day) => {
        return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][day];
    };
    const parseICSDate = (dateStr) => {
        // Handle both YYYYMMDD and YYYYMMDDTHHMMSS formats
        const isUTC = dateStr.endsWith('Z');
        const normalized = dateStr.replace(/Z$/, '');
        if (normalized.includes('T')) {
            const [date, time] = normalized.split('T');
            const year = parseInt(date.substring(0, 4));
            const month = parseInt(date.substring(4, 6)) - 1;
            const day = parseInt(date.substring(6, 8));
            const hours = parseInt(time.substring(0, 2));
            const minutes = parseInt(time.substring(2, 4));
            const seconds = parseInt(time.substring(4, 6));
            if (isUTC) {
                // Use UTC constructor and let JavaScript convert to local time
                return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
            }
            return new Date(year, month, day, hours, minutes, seconds);
        }
        else {
            const year = parseInt(normalized.substring(0, 4));
            const month = parseInt(normalized.substring(4, 6)) - 1;
            const day = parseInt(normalized.substring(6, 8));
            return new Date(year, month, day);
        }
    };
    const parseDurationMs = (duration) => {
        // Supports formats like P1D, PT2H, PT30M, P1DT2H30M
        const match = duration.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
        if (!match)
            return 0;
        const days = Number(match[1] ?? 0);
        const hours = Number(match[2] ?? 0);
        const minutes = Number(match[3] ?? 0);
        const seconds = Number(match[4] ?? 0);
        return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
    };
    const getEventsForDay = (day) => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const targetDate = new Date(year, month, day);
        targetDate.setHours(0, 0, 0, 0);
        const filteredEvents = events.filter(event => {
            if (hiddenCalendars.includes(event.calendarIndex)) {
                return false;
            }
            // Skip all-day events (they're shown as spanning bars)
            if (isAllDayEvent(event)) {
                return false;
            }
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            eventStart.setHours(0, 0, 0, 0);
            eventEnd.setHours(0, 0, 0, 0);
            // Skip multi-day events (they're shown in the multi-day section)
            const sameDay = eventStart.toDateString() === getAdjustedEndDate(event.end).toDateString();
            if (!sameDay || event.daysSpanned > 1) {
                return false;
            }
            if (eventEnd.getTime() === eventStart.getTime()) {
                return targetDate.getTime() === eventStart.getTime();
            }
            return targetDate >= eventStart && targetDate < eventEnd;
        });
        // Sort events by start time
        return filteredEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
    };
    const isToday = (day) => {
        const today = new Date();
        return (day === today.getDate() &&
            currentDate.getMonth() === today.getMonth() &&
            currentDate.getFullYear() === today.getFullYear());
    };
    const monthShort = currentDate.toLocaleString('en-US', { month: 'short' });
    const year = currentDate.getFullYear();
    const lastDayOfMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
    // Generate title label based on view mode
    let titleLabel = '';
    if (viewMode === 'monthly') {
        titleLabel = `${monthShort} 1 - ${monthShort} ${lastDayOfMonth}, ${year}`;
    }
    else if (viewMode === 'weekly') {
        const dayOfWeek = currentDate.getDay();
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - dayOfWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const startMonth = weekStart.toLocaleString('en-US', { month: 'short' });
        const endMonth = weekEnd.toLocaleString('en-US', { month: 'short' });
        if (startMonth === endMonth) {
            titleLabel = `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
        }
        else {
            titleLabel = `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
        }
    }
    else {
        // daily view
        titleLabel = currentDate.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    const monthStart = new Date(year, currentDate.getMonth(), 1);
    const monthEnd = new Date(year, currentDate.getMonth(), lastDayOfMonth, 23, 59, 59, 999);
    const calendarUrlsStr = import.meta.env?.VITE_CALENDAR_URLS;
    const calendarUrls = calendarUrlsStr ? calendarUrlsStr.split(',').map(u => u.trim()) : [];
    const calendarColors = getCalendarColors(calendarUrls.length);
    const calendarNames = calendarUrls.map((_, index) => getCalendarName(index + 1));
    const getAdjustedEndDate = (date) => {
        const adjusted = new Date(date);
        if (adjusted.getHours() === 0 &&
            adjusted.getMinutes() === 0 &&
            adjusted.getSeconds() === 0 &&
            adjusted.getMilliseconds() === 0) {
            adjusted.setDate(adjusted.getDate() - 1);
        }
        return adjusted;
    };
    // Helper to check if event is all-day
    const isAllDayEvent = (event) => {
        const start = event.start;
        const end = event.end;
        return (start.getHours() === 0 &&
            start.getMinutes() === 0 &&
            end.getHours() === 0 &&
            end.getMinutes() === 0 &&
            event.daysSpanned >= 1);
    };
    const formatEventTime = (event) => {
        const start = event.start;
        const end = event.end;
        const startHours = start.getHours();
        const startMinutes = start.getMinutes();
        const endHours = end.getHours();
        const endMinutes = end.getMinutes();
        const isAllDay = startHours === 0 &&
            startMinutes === 0 &&
            endHours === 0 &&
            endMinutes === 0 &&
            event.daysSpanned >= 1;
        if (isAllDay)
            return 'All day';
        const startHour12 = startHours % 12 || 12;
        const startMinuteText = startMinutes === 0 ? '' : `:${String(startMinutes).padStart(2, '0')}`;
        const startSuffix = startHours >= 12 ? 'pm' : 'am';
        const endHour12 = endHours % 12 || 12;
        const endMinuteText = endMinutes === 0 ? '' : `:${String(endMinutes).padStart(2, '0')}`;
        const endSuffix = endHours >= 12 ? 'pm' : 'am';
        return `${startHour12}${startMinuteText}${startSuffix} - ${endHour12}${endMinuteText}${endSuffix}`;
    };
    const formatEventStartTime = (event) => {
        const start = event.start;
        const startHours = start.getHours();
        const startMinutes = start.getMinutes();
        const isAllDay = startHours === 0 &&
            startMinutes === 0 &&
            event.daysSpanned >= 1;
        if (isAllDay)
            return 'All day';
        const startHour12 = startHours % 12 || 12;
        const startMinuteText = startMinutes === 0 ? '' : `:${String(startMinutes).padStart(2, '0')}`;
        const startSuffix = startHours >= 12 ? 'pm' : 'am';
        return `${startHour12}${startMinuteText}${startSuffix}`;
    };
    const buildMultiDaySegments = () => {
        const segments = [];
        events.forEach(event => {
            if (hiddenCalendars.includes(event.calendarIndex))
                return;
            const eventStart = new Date(event.start);
            const eventEnd = getAdjustedEndDate(event.end);
            const sameDay = eventStart.toDateString() === eventEnd.toDateString();
            // Include multi-day events or all-day events (even if single-day)
            if (sameDay && event.daysSpanned <= 1 && !isAllDayEvent(event))
                return;
            if (eventEnd < monthStart || eventStart > monthEnd)
                return;
            const startDay = eventStart < monthStart ? 1 : eventStart.getDate();
            const endDay = eventEnd > monthEnd ? lastDayOfMonth : eventEnd.getDate();
            if (endDay < startDay)
                return;
            let dayCursor = startDay;
            while (dayCursor <= endDay) {
                const dayIndex = firstDayOffset + (dayCursor - 1);
                const weekIndex = Math.floor(dayIndex / 7);
                const weekStartDay = weekIndex * 7 - firstDayOffset + 1;
                const weekEndDay = weekStartDay + 6;
                const segmentStartDay = dayCursor;
                const segmentEndDay = Math.min(endDay, weekEndDay);
                const startCol = (firstDayOffset + (segmentStartDay - 1)) % 7;
                const span = segmentEndDay - segmentStartDay + 1;
                segments.push({
                    id: `${event.id}-${segmentStartDay}`,
                    title: event.title,
                    color: event.color,
                    weekIndex,
                    startCol,
                    span,
                });
                dayCursor = segmentEndDay + 1;
            }
        });
        return segments;
    };
    const buildWeekLanes = (segments) => {
        const sorted = [...segments].sort((a, b) => a.startCol - b.startCol || b.span - a.span);
        const lanes = [];
        const laneEnds = [];
        sorted.forEach(segment => {
            let laneIndex = laneEnds.findIndex(end => segment.startCol > end);
            if (laneIndex === -1) {
                laneIndex = laneEnds.length;
                laneEnds.push(segment.startCol + segment.span - 1);
                lanes.push([segment]);
                return;
            }
            laneEnds[laneIndex] = segment.startCol + segment.span - 1;
            lanes[laneIndex].push(segment);
        });
        return lanes;
    };
    const totalSlots = firstDayOffset + daysInMonth.length;
    const weekCount = Math.ceil(totalSlots / 7);
    const weeks = Array.from({ length: weekCount }, (_, weekIndex) => Array.from({ length: 7 }, (_, dayIndex) => {
        const dayNumber = weekIndex * 7 + dayIndex - firstDayOffset + 1;
        return dayNumber >= 1 && dayNumber <= daysInMonth.length ? dayNumber : null;
    }));
    const multiDaySegments = buildMultiDaySegments();
    const segmentsByWeek = multiDaySegments.reduce((acc, segment) => {
        if (!acc[segment.weekIndex])
            acc[segment.weekIndex] = [];
        acc[segment.weekIndex].push(segment);
        return acc;
    }, {});
    // Helper function for weekly view
    const getWeekDays = () => {
        const dayOfWeek = currentDate.getDay();
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - dayOfWeek);
        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            return day;
        });
    };
    // Helper function to get events for a specific date
    const getEventsForDate = (date) => {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        return events.filter(event => {
            if (hiddenCalendars.includes(event.calendarIndex)) {
                return false;
            }
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            // Check if event overlaps with this day at all
            // Event overlaps if it starts before the end of this day AND ends after the start of this day
            return eventStart < nextDay && eventEnd > targetDate;
        }).sort((a, b) => a.start.getTime() - b.start.getTime());
    };
    // Helper function to check if a date is today
    const isDateToday = (date) => {
        const today = new Date();
        return (date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear());
    };
    // Helper to get hour slots for timeline view (00:00 to 23:00)
    const getHourSlots = () => {
        return Array.from({ length: 24 }, (_, i) => i);
    };
    const formatHourLabel = (hour) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 === 0 ? 12 : hour % 12;
        return `${hour12} ${period}`;
    };
    // Helper to get event position and height in timeline
    const getEventTimelinePosition = (event, date) => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        // Clamp to the day boundaries
        const displayStart = eventStart < dayStart ? dayStart : eventStart;
        const displayEnd = eventEnd > dayEnd ? dayEnd : eventEnd;
        const startMinutes = displayStart.getHours() * 60 + displayStart.getMinutes();
        const endMinutes = displayEnd.getHours() * 60 + displayEnd.getMinutes();
        const durationMinutes = endMinutes - startMinutes;
        return {
            top: (startMinutes / 60) * 60, // 60px per hour
            height: Math.max((durationMinutes / 60) * 60, 30), // minimum 30px
            startMinutes,
            endMinutes,
        };
    };
    // Helper to check if two events overlap
    const eventsOverlap = (event1, event2, date) => {
        const pos1 = getEventTimelinePosition(event1, date);
        const pos2 = getEventTimelinePosition(event2, date);
        return pos1.startMinutes < pos2.endMinutes && pos2.startMinutes < pos1.endMinutes;
    };
    // Helper to assign events to columns to avoid overlap
    const layoutEventsInColumns = (events, date) => {
        if (events.length === 0)
            return [];
        // Sort events by start time, then by duration (longer first)
        const sortedEvents = [...events].sort((a, b) => {
            const aPos = getEventTimelinePosition(a, date);
            const bPos = getEventTimelinePosition(b, date);
            if (aPos.startMinutes !== bPos.startMinutes) {
                return aPos.startMinutes - bPos.startMinutes;
            }
            return bPos.height - aPos.height;
        });
        const columns = [];
        const eventColumns = new Map();
        for (const event of sortedEvents) {
            let placed = false;
            for (let colIndex = 0; colIndex < columns.length; colIndex++) {
                const column = columns[colIndex];
                const hasOverlap = column.some(e => eventsOverlap(e, event, date));
                if (!hasOverlap) {
                    column.push(event);
                    eventColumns.set(event.id, colIndex);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                columns.push([event]);
                eventColumns.set(event.id, columns.length - 1);
            }
        }
        return sortedEvents.map(event => ({
            event,
            column: eventColumns.get(event.id) || 0,
            totalColumns: columns.length,
        }));
    };
    // Helper to get current time position
    const getCurrentTimePosition = () => {
        const now = new Date();
        const minutes = now.getHours() * 60 + now.getMinutes();
        return (minutes / 60) * 60 + 60; // 60px per hour + all-day row height
    };
    return (_jsxs("div", { className: "calendar", children: [_jsxs("div", { className: "calendar-toolbar", children: [viewMode !== 'monthly' && _jsx("h2", { className: "calendar-title", children: titleLabel }), _jsxs("div", { className: "calendar-controls", children: [_jsx("button", { className: "calendar-btn icon", "aria-label": "Settings", "aria-pressed": settingsOpen, onClick: () => setSettingsOpen((open) => !open), ref: settingsButtonRef, children: "\u2699\uFE0E" }), settingsOpen && (_jsxs("div", { className: "calendar-settings", role: "dialog", "aria-label": "Calendar settings", ref: settingsRef, children: [_jsx("div", { className: "settings-title", children: "Navigate" }), _jsxs("div", { className: "settings-nav-buttons", children: [_jsx("button", { className: "calendar-btn nav", onClick: () => {
                                                    goToPrev();
                                                    setSettingsOpen(false);
                                                }, "aria-label": `Previous ${viewMode === 'monthly' ? 'month' : viewMode === 'weekly' ? 'week' : 'day'}`, children: "\u2190 Prev" }), _jsx("button", { className: "calendar-btn nav", onClick: () => {
                                                    goToToday();
                                                    setSettingsOpen(false);
                                                }, "aria-label": "Go to today", children: "Today" }), _jsx("button", { className: "calendar-btn nav", onClick: () => {
                                                    goToNext();
                                                    setSettingsOpen(false);
                                                }, "aria-label": `Next ${viewMode === 'monthly' ? 'month' : viewMode === 'weekly' ? 'week' : 'day'}`, children: "Next \u2192" })] }), _jsx("div", { className: "settings-title", children: "View" }), _jsxs("div", { className: "settings-view-modes", children: [_jsx("button", { className: `view-mode-btn ${viewMode === 'monthly' ? 'active' : ''}`, onClick: () => {
                                                    setViewMode('monthly');
                                                    setSettingsOpen(false);
                                                }, "aria-pressed": viewMode === 'monthly', children: "Monthly" }), _jsx("button", { className: `view-mode-btn ${viewMode === 'weekly' ? 'active' : ''}`, onClick: () => {
                                                    setViewMode('weekly');
                                                    setSettingsOpen(false);
                                                }, "aria-pressed": viewMode === 'weekly', children: "Weekly" }), _jsx("button", { className: `view-mode-btn ${viewMode === 'daily' ? 'active' : ''}`, onClick: () => {
                                                    setViewMode('daily');
                                                    setSettingsOpen(false);
                                                }, "aria-pressed": viewMode === 'daily', children: "Daily" })] }), _jsx("div", { className: "settings-title", children: "Calendars" }), _jsx("div", { className: "settings-list", children: calendarUrls.length === 0 ? (_jsx("div", { className: "settings-empty", children: "No calendars configured" })) : (calendarUrls.map((_, index) => {
                                            const isHidden = hiddenCalendars.includes(index);
                                            const color = calendarColors[index % calendarColors.length];
                                            const name = calendarNames[index];
                                            return (_jsxs("label", { className: `settings-row ${isHidden ? 'is-hidden' : ''}`, children: [_jsx("input", { type: "checkbox", checked: !isHidden, onChange: () => toggleCalendarVisibility(index), "aria-label": `Toggle ${name}` }), _jsx("span", { className: "settings-color", style: { backgroundColor: color } }), _jsx("span", { className: "settings-name", children: name })] }, `calendar-setting-${index}`));
                                        })) }), _jsx("div", { className: "settings-title", children: "Theme" }), _jsxs("div", { className: "settings-view-modes", children: [_jsx("button", { className: `view-mode-btn ${theme === 'dark' ? 'active' : ''}`, onClick: () => toggleTheme('dark'), "aria-pressed": theme === 'dark', children: "Dark" }), _jsx("button", { className: `view-mode-btn ${theme === 'light' ? 'active' : ''}`, onClick: () => toggleTheme('light'), "aria-pressed": theme === 'light', children: "Light" }), _jsx("button", { className: `view-mode-btn ${theme === 'auto' ? 'active' : ''}`, onClick: () => toggleTheme('auto'), "aria-pressed": theme === 'auto', children: "Auto" })] }), import.meta.env.DEV && (_jsxs(_Fragment, { children: [_jsx("div", { className: "settings-title", children: "Testing" }), _jsx("div", { className: "settings-view-modes", children: _jsx("button", { className: `view-mode-btn ${manualAlertActive ? 'active' : ''}`, onClick: onToggleManualAlert, "aria-pressed": manualAlertActive, children: manualAlertActive ? '✓ Test Alert' : '+ Test Alert' }) })] }))] }))] })] }), viewMode === 'monthly' && (_jsxs("div", { className: "calendar-grid", children: [_jsx("div", { className: "calendar-header", children: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (_jsx("div", { className: "calendar-header-cell", children: day }, day))) }), weeks.map((week, weekIndex) => {
                        const weekSegments = segmentsByWeek[weekIndex] ?? [];
                        const weekLanes = buildWeekLanes(weekSegments).slice(0, 2);
                        return (_jsxs("div", { className: "calendar-week", children: [_jsx("div", { className: "week-multiday", children: weekLanes.map((lane, laneIndex) => lane.map(segment => (_jsx("div", { className: "multiday-pill", style: {
                                            gridColumn: `${segment.startCol + 1} / span ${segment.span}`,
                                            gridRow: `${laneIndex + 1}`,
                                            backgroundColor: segment.color,
                                        }, title: segment.title, children: _jsx("span", { className: "multiday-title", children: segment.title }) }, segment.id)))) }), week.map((day, dayIndex) => {
                                    if (!day) {
                                        return _jsx("div", { className: "calendar-cell empty" }, `empty-${weekIndex}-${dayIndex}`);
                                    }
                                    const dayEvents = getEventsForDay(day);
                                    const isTodayFlag = isToday(day);
                                    const shouldScroll = dayEvents.length > 3;
                                    return (_jsxs("div", { className: `calendar-cell ${isTodayFlag ? 'today' : ''}`, children: [_jsx("div", { className: "day-number", children: _jsx("span", { className: "day-date", children: day }) }), _jsx("div", { className: `day-events ${shouldScroll ? 'scrollable' : ''}`, children: dayEvents.map(event => (_jsxs("div", { className: "event-row", title: event.title, children: [_jsx("span", { className: "event-dot", style: { backgroundColor: event.color } }), _jsx("span", { className: "event-time", children: formatEventStartTime(event) }), _jsx("span", { className: "event-title", children: event.title })] }, event.id))) })] }, day));
                                })] }, `week-${weekIndex}`));
                    })] })), viewMode === 'weekly' && (_jsxs("div", { className: "calendar-grid weekly-timeline", children: [_jsxs("div", { className: "timeline-header", children: [_jsx("div", { className: "timeline-header-corner" }), getWeekDays().map((date, index) => {
                                const isTodayFlag = isDateToday(date);
                                return (_jsx("div", { className: `timeline-header-day ${isTodayFlag ? 'today' : ''}`, children: _jsxs("div", { className: "timeline-day-name", children: [['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index], " ", _jsx("span", { className: "timeline-day-num", children: date.getDate() })] }) }, index));
                            })] }), _jsxs("div", { className: "timeline-body", children: [_jsxs("div", { className: "timeline-hours", children: [_jsx("div", { className: "timeline-all-day-label", children: "all-day" }), getHourSlots().map(hour => (_jsx("div", { className: "timeline-hour-label", children: formatHourLabel(hour) }, hour)))] }), _jsxs("div", { className: "timeline-grid", children: [_jsx("div", { className: "timeline-all-day-row", children: getWeekDays().map((date, dayIndex) => {
                                            const dayEvents = getEventsForDate(date).filter(e => isAllDayEvent(e));
                                            return (_jsx("div", { className: "timeline-all-day-cell", children: dayEvents.map(event => (_jsx("div", { className: "timeline-all-day-event", style: { backgroundColor: event.color }, title: event.title, children: event.title }, event.id))) }, dayIndex));
                                        }) }), _jsx("div", { className: "timeline-time-grid", children: getHourSlots().map(hour => (_jsx("div", { className: "timeline-hour-row", children: getWeekDays().map((_date, dayIndex) => (_jsx("div", { className: "timeline-hour-cell" }, dayIndex))) }, hour))) }), _jsx("div", { className: "timeline-events-overlay", children: getWeekDays().map((date, dayIndex) => {
                                            const dayEvents = getEventsForDate(date).filter(e => !isAllDayEvent(e));
                                            const layoutedEvents = layoutEventsInColumns(dayEvents, date);
                                            return (_jsx("div", { className: "timeline-day-events", style: { left: `${(dayIndex / 7) * 100}%` }, children: layoutedEvents.map(({ event, column, totalColumns }) => {
                                                    const position = getEventTimelinePosition(event, date);
                                                    const columnWidth = 100 / totalColumns;
                                                    const leftOffset = column * columnWidth;
                                                    return (_jsxs("div", { className: "timeline-event", style: {
                                                            top: `${position.top}px`,
                                                            height: `${position.height}px`,
                                                            left: `${leftOffset}%`,
                                                            width: `${columnWidth}%`,
                                                            backgroundColor: event.color,
                                                        }, title: event.title, children: [_jsx("div", { className: "timeline-event-time", children: formatEventTime(event) }), _jsx("div", { className: "timeline-event-title", children: event.title })] }, event.id));
                                                }) }, dayIndex));
                                        }) }), _jsxs("div", { className: "timeline-current-time", style: { top: `${getCurrentTimePosition()}px` }, children: [_jsx("div", { className: "timeline-current-time-dot" }), _jsx("div", { className: "timeline-current-time-line" })] })] })] })] })), viewMode === 'daily' && (_jsxs("div", { className: "calendar-grid daily-view", children: [_jsx("div", { className: "daily-header", children: _jsxs("div", { className: "daily-date", children: [currentDate.toLocaleString('en-US', { weekday: 'long' }), " ", currentDate.getDate()] }) }), _jsxs("div", { className: "daily-events", children: [getEventsForDate(currentDate).map(event => (_jsxs("div", { className: "daily-event-row", style: { borderLeftColor: event.color }, children: [_jsx("div", { className: "daily-event-time", children: formatEventTime(event) }), _jsxs("div", { className: "daily-event-details", children: [_jsx("div", { className: "daily-event-title", children: event.title }), event.location && _jsx("div", { className: "daily-event-location", children: event.location })] })] }, event.id))), getEventsForDate(currentDate).length === 0 && (_jsx("div", { className: "daily-no-events", children: "No events scheduled" }))] })] }))] }));
}
