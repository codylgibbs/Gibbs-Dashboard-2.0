# Copilot instructions for tv-dashboard

## Big picture
- Vite + React app with a simple top-level layout in [src/App.tsx](src/App.tsx) and entry in [src/main.tsx](src/main.tsx).
- UI is composed of three independent components: `Clock`, `Calendar`, `Weather` in [src/components](src/components) with component-scoped CSS in [src/styles](src/styles).
- Data flows are client-side only: `Calendar` fetches ICS URLs and parses them locally; `Weather` calls OpenWeather’s forecast API and derives current + 5‑day summary in the component state.

## Configuration & integration points
- Environment variables are required for runtime data:
  - `VITE_OPENWEATHER_API_KEY`
  - `VITE_CALENDAR_URLS` (comma-separated ICS URLs)
  See [README.md](README.md) and [.env.example](.env.example).
- `Calendar` uses a lightweight, custom ICS parser in [src/components/Calendar.tsx](src/components/Calendar.tsx), not a third‑party parser.
- `Weather` calls OpenWeather forecast endpoint with fixed lat/lon for Winterville, GA; location change is a constant edit in [src/components/Weather.tsx](src/components/Weather.tsx).

## Component behavior patterns
- `Clock` is fixed to America/New_York via `Intl.DateTimeFormat` in [src/components/Clock.tsx](src/components/Clock.tsx).
- `Calendar` fetches each URL serially, merges events, and assigns colors by calendar index using the `COLORS` array in [src/components/Calendar.tsx](src/components/Calendar.tsx).
- `Calendar` renders per-day bars with overflow handling (>3 events), so UI changes should preserve this layout pattern.
- `Weather` derives “current” from `data.list[0]` and aggregates highs/lows per day in [src/components/Weather.tsx](src/components/Weather.tsx).
- Auto-refresh intervals are hardcoded: calendar 5 minutes, weather 10 minutes; update in the respective components.

## Developer workflows
- Dev server: `npm run dev` (Vite). Build: `npm run build`. Type check: `npm run type-check` in [package.json](package.json).

## Conventions to follow
- Keep component state local; there is no global state/store.
- Styling lives in [src/styles](src/styles) and is imported directly by each component.
- Prefer small, readable UI logic inside the component files rather than new services or hooks unless the feature is reused across components.
