import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { useCapabilities } from './useCapabilities'

export interface ForecastDay {
  date: string
  minC: number
  maxC: number
  code: number
  rainPercent: number | null
}

export interface WeatherForecast {
  source: string
  timezone: string
  fetchedAt: string
  sites: { siteId: string; days: ForecastDay[] }[]
}

export function useWeatherForecast() {
  const { capabilities, error: capabilitiesError } = useCapabilities()
  const [data, setData] = useState<WeatherForecast>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const enabled = capabilities?.weather === true
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return
      setLoading(true)
      try {
        const forecast = await apiRequest<WeatherForecast>('/weather', {
          signal: controller.signal, headers: { Authorization: '' },
        })
        if (!controller.signal.aborted) { setData(forecast); setError(undefined) }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Weather forecast could not be refreshed:', error)
          setData(undefined)
          setError('Forecast unavailable; retry later')
        }
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 1800000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [enabled])
  return { data: enabled ? data : undefined, loading, enabled, error: capabilitiesError || error }
}
