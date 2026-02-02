# Gibbs Dashboard 2.0

A full-screen, TV-friendly dashboard displaying the current time (EST), a multi-calendar view with color-coded events, and live weather for Winterville, GA.

## Features

- **Live Clock**: Displays current time in EST with 1-second updates
- **Multi-Calendar Support**: 
  - Fetch events from multiple ICS calendar URLs
  - Color-coded calendars (up to 6 colors)
  - Multi-day event support with visual spanning
  - "Today" highlighting
  - Event collapse/overflow handling for crowded days
- **Current & Forecast Weather**:
  - Real-time weather for Winterville, GA (33.8485°N, 83.2139°W)
  - 5-day forecast with high/low temps
  - Weather icons and conditions
  - Humidity and wind speed display
- **TV-Optimized UI**:
  - Full-screen, dark theme with large readable fonts
  - Responsive grid layout (2-column on desktop, 1-column on smaller screens)
  - Auto-refresh calendars every 5 minutes, weather every 10 minutes

## Project Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your API keys:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_OPENWEATHER_API_KEY=your_api_key_here
VITE_CALENDAR_URLS=https://example.com/calendar1.ics,https://example.com/calendar2.ics
```

**Get an OpenWeatherMap API Key:**
1. Sign up at [openweathermap.org](https://openweathermap.org)
2. Go to API keys section and copy your key
3. Paste into `VITE_OPENWEATHER_API_KEY`

**Add Calendar URLs:**
- Export your calendars as `.ics` files from Google Calendar, Outlook, etc.
- Host them on a web server or use public calendar sharing links
- Comma-separate multiple URLs in `VITE_CALENDAR_URLS`

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production

```bash
npm run build
```

Output goes to `dist/` directory.

## Deployment to TV/Kiosk

### Option A: macOS (Startup Item)

Create a LaunchAgent to autostart the app on login:

```bash
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/com.user.tv-dashboard.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.user.tv-dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>-a</string>
    <string>Safari</string>
    <string>http://localhost:5173</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/tv-dashboard.log</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.user.tv-dashboard.plist
```

### Option B: Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "preview"]
```

Build and run:

```bash
docker build -t tv-dashboard .
docker run -p 5173:5173 \
  -e VITE_OPENWEATHER_API_KEY=your_key \
  -e VITE_CALENDAR_URLS=your_urls \
  tv-dashboard
```

### Option C: Linux Systemd Service

Create `/etc/systemd/system/tv-dashboard.service`:

```ini
[Unit]
Description=Gibbs Dashboard 2.0
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/tv-dashboard
ExecStart=/usr/bin/npm run preview
Restart=always
RestartSec=10

Environment="VITE_OPENWEATHER_API_KEY=your_key"
Environment="VITE_CALENDAR_URLS=your_urls"

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable tv-dashboard
sudo systemctl start tv-dashboard
```

## Full-Screen Browser Mode

### macOS Safari
In Safari, press `Control + Command + F` to enter full-screen mode.

### Chrome/Chromium (Any OS)
```bash
google-chrome --kiosk http://localhost:5173
# or
chromium --kiosk http://localhost:5173
```

### Firefox
```bash
firefox --fullscreen http://localhost:5173
```

## File Structure

```
tv-dashboard/
├── src/
│   ├── components/
│   │   ├── Clock.tsx          # EST time display
│   │   ├── Calendar.tsx       # Multi-calendar with ICS parsing
│   │   └── Weather.tsx        # Weather fetcher & forecast
│   ├── styles/
│   │   ├── Clock.css
│   │   ├── Calendar.css
│   │   └── Weather.css
│   ├── App.tsx                # Main layout
│   ├── main.tsx               # React entry point
│   └── index.css              # Global styles
├── public/
│   └── index.html             # HTML template
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Customization

### Change Colors
Edit the `COLORS` array in [src/components/Calendar.tsx](src/components/Calendar.tsx#L8):

```typescript
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F']
```

### Adjust Refresh Intervals
- **Calendars**: Change `5 * 60 * 1000` to your desired milliseconds in [Calendar.tsx](src/components/Calendar.tsx#L32)
- **Weather**: Change `10 * 60 * 1000` in [Weather.tsx](src/components/Weather.tsx#L67)

### Change Location
Update latitude/longitude in [Weather.tsx](src/components/Weather.tsx#L62) for a different city.

## Troubleshooting

**Weather not loading?**
- Verify API key is correct in `.env.local`
- Check OpenWeatherMap website for API status
- Ensure location coordinates are valid

**Calendars not showing?**
- Test ICS URLs in a browser to ensure they're accessible
- Check browser console for CORS errors
- Some calendars require authentication headers

**Time shows wrong timezone?**
- Verify system timezone is correct (EST is America/New_York)

## License

MIT

## Support

For issues or feature requests, check the code comments and verify your environment variables are set correctly.
