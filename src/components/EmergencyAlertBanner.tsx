import { useEffect, useMemo, useState } from 'react'
import '../styles/EmergencyAlertBanner.css'

interface NwsAlert {
  id: string
  headline: string
  event: string
  severity: string
  urgency: string
  areaDesc: string
}

const ALERT_SEVERITY_ORDER: Record<string, number> = {
  extreme: 1,
  severe: 2,
  moderate: 3,
  minor: 4,
  unknown: 5,
}

const LAT = 33.8485
const LON = -83.2139

interface EmergencyAlertBannerProps {
  onAlertsChange?: (hasAlerts: boolean) => void
}

export default function EmergencyAlertBanner({ onAlertsChange }: EmergencyAlertBannerProps) {
  const [alerts, setAlerts] = useState<NwsAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const fetchAlerts = async () => {
      try {
        setLoading(true)
        const response = await fetch(
          `https://api.weather.gov/alerts/active?point=${LAT},${LON}`,
          {
            headers: {
              'User-Agent': 'tv-dashboard (local display)',
              Accept: 'application/geo+json',
            },
          }
        )

        if (!response.ok) {
          throw new Error(`NWS error: ${response.status}`)
        }

        const data = await response.json()
        const features = Array.isArray(data.features) ? data.features : []

        const mappedAlerts: NwsAlert[] = features
          .map((feature: any) => {
            const properties = feature?.properties || {}
            return {
              id: feature?.id || properties?.id || properties?.headline || Math.random().toString(36),
              headline: properties?.headline || '',
              event: properties?.event || 'Weather Alert',
              severity: String(properties?.severity || 'Unknown'),
              urgency: String(properties?.urgency || 'Unknown'),
              areaDesc: properties?.areaDesc || 'Local area',
            }
          })
          .filter((alert: NwsAlert) => alert.headline || alert.event)

        if (isMounted) {
          setAlerts(mappedAlerts)
          setError('')
        }
      } catch (err) {
        console.error('NWS alert fetch error:', err)
        if (isMounted) {
          setError('Alert feed unavailable')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      const rankA = ALERT_SEVERITY_ORDER[a.severity.toLowerCase()] ?? 99
      const rankB = ALERT_SEVERITY_ORDER[b.severity.toLowerCase()] ?? 99
      return rankA - rankB
    })
  }, [alerts])

  const hasAlerts = sortedAlerts.length > 0

  useEffect(() => {
    onAlertsChange?.(hasAlerts && !loading && !error)
  }, [hasAlerts, loading, error, onAlertsChange])

  if (loading || error || !hasAlerts) {
    return null
  }

  return (
    <div className="alert-banner active">
      <div className="alert-label">Emergency Alert</div>
      <div className="alert-content" aria-live="polite">
        <div className="alert-scroll">
          {sortedAlerts.map(alert => (
            <span
              key={alert.id}
              className={`alert-item severity-${alert.severity.toLowerCase()}`}
            >
              {alert.event}: {alert.headline || 'Stay alert'} — {alert.areaDesc}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
