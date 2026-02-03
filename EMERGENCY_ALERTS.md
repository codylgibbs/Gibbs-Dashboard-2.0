# Emergency Alerts System

The dashboard now includes an enhanced emergency alert system with automatic fetching from the National Weather Service (NWS) and support for custom local alert feeds.

## Features

### 1. **Automatic Weather Alerts**
- Automatically fetches active weather alerts from the National Weather Service (NWS) for Winterville, GA
- Updates every 5 minutes
- Severity-based sorting (extreme → severe → moderate → minor)
- Color-coded display based on severity level

### 2. **Custom Alert Feeds**
You can configure a local JSON feed for custom alerts by setting the `VITE_ALERT_FEED_URL` environment variable.

**Expected JSON Format:**
```json
[
  {
    "id": "unique-alert-id",
    "headline": "Main alert message",
    "event": "Type of alert (e.g., 'Safety Alert', 'Building Closure')",
    "severity": "extreme|severe|moderate|minor",
    "urgency": "Expected|Likely|Past",
    "area": "Location or area name"
  }
]
```

**Configuration:**
```bash
VITE_ALERT_FEED_URL=https://your-server.com/alerts.json
```

### 3. **Manual Test Alerts (Development Only)**
When running in development mode (`npm run dev`):
- A settings button (⚙️) appears in the bottom-right corner
- Click it to reveal the alert controls panel
- Use "+ Test Alert" to toggle a sample alert for testing the UI
- The test alert shows as "TEST" in the banner label

## Implementation Details

### Component: `EmergencyAlertBanner.tsx`
- **State Management:**
  - `alerts`: Fetched alerts from NWS and custom feed
  - `manualAlert`: Test alert (dev mode only)
  - `loading`: Fetch status
  - `error`: Error messages
  - `showToggle`: Visibility of dev controls

- **Data Flow:**
  1. NWS fetch runs every 5 minutes
  2. Custom feed (if configured) is also fetched
  3. Manual alerts override production alerts when toggled
  4. Alerts sorted by severity for display

### Styling
- Red gradient background for active alerts
- Scrolling marquee animation for alert text
- Severity-based text colors
- Light theme overrides included
- Responsive design with clamp() for all sizes

### API Endpoints
- **NWS**: `https://api.weather.gov/alerts/active?point=33.8485,-83.2139`
- **Custom**: User-provided via `VITE_ALERT_FEED_URL` env var

## Usage Examples

### Example 1: Simple Python Alert Server
```python
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/alerts.json')
def get_alerts():
    return jsonify([
        {
            "id": "alert-001",
            "headline": "Building Evacuation - 3rd Floor",
            "event": "Safety Alert",
            "severity": "severe",
            "urgency": "Immediate",
            "area": "Building A"
        }
    ])

if __name__ == '__main__':
    app.run(port=5000)
```

### Example 2: Static JSON File
Host a static JSON file on your server:
```
https://example.com/alerts.json
```

Then set:
```bash
VITE_ALERT_FEED_URL=https://example.com/alerts.json
```

## Severity Levels & Colors

| Severity | Color | Use Case |
|----------|-------|----------|
| extreme  | #ffe4e4 | Life-threatening situations |
| severe   | #ffe3b3 | Dangerous conditions |
| moderate | #fff5cc | Caution recommended |
| minor    | #d8f7ff | Advisory information |

## Troubleshooting

### Alerts not showing
1. Check browser console for fetch errors
2. Verify `VITE_ALERT_FEED_URL` is valid (if configured)
3. Ensure your custom feed returns valid JSON
4. Check that the NWS API is reachable from your network

### Custom feed not updating
- Verify the endpoint returns valid JSON
- Check CORS headers if fetched from different origin
- Monitor browser Network tab for request failures

### Test alert button missing
- Ensure you're running in development mode (`npm run dev`)
- The button only appears when `import.meta.env.DEV` is true

## Customization

### Change Refresh Interval
In [EmergencyAlertBanner.tsx](src/components/EmergencyAlertBanner.tsx), line with:
```typescript
const interval = setInterval(fetchAlerts, 5 * 60 * 1000)  // 5 minutes
```

### Change Location (NWS alerts)
Update `LAT` and `LON` constants in [EmergencyAlertBanner.tsx](src/components/EmergencyAlertBanner.tsx#L23-L24)

### Customize Alert Label
Change the label text in the JSX:
```tsx
<div className="alert-label">{manualAlert ? 'TEST' : 'Emergency Alert'}</div>
```
