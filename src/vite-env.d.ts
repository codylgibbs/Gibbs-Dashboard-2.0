/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CALENDAR_URLS?: string
  readonly VITE_OPENWEATHER_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
