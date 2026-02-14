import { useEffect, useMemo, useState } from 'react'
import '../styles/EmergencyAlertBanner.css'

interface NwsAlert {
  id: string
  headline: string
  event: string
  severity: string
  urgency: string
  areaDesc: string
  description?: string // Add description for more detailed info
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
  manualAlertActive?: boolean
}

export default function EmergencyAlertBanner({ 
  onAlertsChange,
  manualAlertActive 
}: EmergencyAlertBannerProps) {
  const [alerts, setAlerts] = useState<NwsAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const fetchAlerts = async () => {
      try {
        setLoading(true)
        const alertsList: NwsAlert[] = []

        // Fetch from NWS
        try {
          const response = await fetch(
            `https://api.weather.gov/alerts/active?point=${LAT},${LON}`,
            {
              headers: {
                'User-Agent': 'tv-dashboard (local display)',
                Accept: 'application/geo+json',
              },
            }
          )

          if (response.ok) {
            const data = await response.json()
            const features = Array.isArray(data.features) ? data.features : []
            const nwsAlerts = features
              .map((feature: any) => {
                const properties = feature?.properties || {}
                return {
                  id: feature?.id || properties?.id || properties?.headline || Math.random().toString(36),
                  headline: properties?.headline || '',
                  event: properties?.event || 'Weather Alert',
                  severity: String(properties?.severity || 'Unknown'),
                  urgency: String(properties?.urgency || 'Unknown'),
                  areaDesc: properties?.areaDesc || 'Local area',
                  description: properties?.description || '',
                }
              })
              .filter((alert: NwsAlert) => alert.headline || alert.event)
            alertsList.push(...nwsAlerts)
          }
        } catch (nwsErr) {
          console.error('NWS alert fetch error:', nwsErr)
        }

        // Fetch from local feed if configured
        const localFeedUrl = import.meta.env.VITE_ALERT_FEED_URL
        if (localFeedUrl) {
          try {
            const response = await fetch(localFeedUrl)
            if (response.ok) {
              const data = await response.json()
              const feedAlerts = Array.isArray(data) ? data : data.alerts || []
              const mapped = feedAlerts.map((item: any) => ({
                id: item.id || item.headline || Math.random().toString(36),
                headline: item.headline || '',
                event: item.event || 'Alert',
                severity: item.severity || 'moderate',
                urgency: item.urgency || 'Unknown',
                areaDesc: item.areaDesc || item.area || 'Local area',
                description: item.description || '',
              }))
              alertsList.push(...mapped)
            }
          } catch (localErr) {
            console.error('Local alert feed error:', localErr)
          }
        }

        if (isMounted) {
          setAlerts(alertsList)
          setError(alertsList.length === 0 && !localFeedUrl ? 'No active alerts' : '')
        }
      } catch (err) {
        console.error('Alert fetch error:', err)
        if (isMounted) {
          setError('')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, 1 * 60 * 1000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const combinedAlerts = useMemo(() => {
    const all = [...alerts]
    if (manualAlertActive) {
      all.unshift({
        id: 'test-' + Date.now(),
        headline: 'This is a test emergency alert',
        event: 'Test Alert',
        severity: 'severe',
        urgency: 'Expected',
        areaDesc: 'Test Display Area',
        description: 'This is a test of the emergency alert system. No action is required.',
      })
    }
    return all
  }, [alerts, manualAlertActive])

  const sortedAlerts = useMemo(() => {
    return [...combinedAlerts].sort((a, b) => {
      const rankA = ALERT_SEVERITY_ORDER[a.severity.toLowerCase()] ?? 99
      const rankB = ALERT_SEVERITY_ORDER[b.severity.toLowerCase()] ?? 99
      return rankA - rankB
    })
  }, [combinedAlerts])

  const hasAlerts = sortedAlerts.length > 0

  useEffect(() => {
    onAlertsChange?.(hasAlerts && !loading && !error)
  }, [hasAlerts, loading, error, onAlertsChange])


  // Prefer description, fallback to headline, then event
  const renderAlertItems = (keyPrefix: string) =>
    sortedAlerts.map(alert => {
      const mainText = alert.description?.trim()
        ? alert.description
        : alert.headline?.trim()
        ? alert.headline
        : alert.event
      return (
        <span
          key={`${keyPrefix}-${alert.id}`}
          className={`alert-item severity-${alert.severity.toLowerCase()}`}
        >
          {mainText}
          {alert.areaDesc && (
            <span className="alert-areas"> — <span className="alert-areas-label">Areas:</span> {alert.areaDesc}</span>
          )}
        </span>
      )
    })

  return (
    <>
      {(loading || !hasAlerts) && !manualAlertActive ? null : (
        <div className={`alert-banner ${hasAlerts || manualAlertActive ? 'active' : 'inactive'}`}>
          <div className="alert-label">{manualAlertActive ? 'TEST' : 'Emergency Alert'}</div>
          <div className="alert-content" aria-live="polite">
            <div className="alert-scroll">
              <div className="alert-scroll-marquee">
                <div className="alert-scroll-track">{renderAlertItems('primary')}</div>
                <div className="alert-scroll-track" aria-hidden="true">
                  {renderAlertItems('duplicate')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}