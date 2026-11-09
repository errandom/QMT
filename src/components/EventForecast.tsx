import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from '@phosphor-icons/react'
import type { Event, Site } from '@/lib/types'
import type { WeatherForecast } from '@/hooks/useWeatherForecast'

function conditions(code: number) {
  if (code === 0) return { Icon: Sun, label: 'Clear' }
  if ([1, 2].includes(code)) return { Icon: CloudSun, label: 'Partly cloudy' }
  if (code === 3) return { Icon: Cloud, label: 'Overcast' }
  if ([45, 48].includes(code)) return { Icon: CloudFog, label: 'Fog' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { Icon: CloudSnow, label: 'Snow' }
  if ([95, 96, 99].includes(code)) return { Icon: CloudLightning, label: 'Thunderstorms' }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { Icon: CloudRain, label: 'Rain / drizzle' }
  return { Icon: Cloud, label: 'Forecast' }
}

export default function EventForecast({ event, site, forecast, loading, enabled, error }: {
  event: Event
  site?: Site
  forecast?: WeatherForecast
  loading?: boolean
  enabled?: boolean
  error?: string | null
}) {
  const away = event.gameLocation === 'away'
  const day = !away && site && forecast?.sites.find(value => value.siteId === site.id)?.days.find(value => value.date === event.date)
  let unavailable = 'Outside forecast range'
  if (away) unavailable = 'Away forecast unavailable'
  else if (!site) unavailable = 'Forecast location unavailable'
  else if (error) unavailable = 'Forecast unavailable'
  else if (loading && !forecast) unavailable = 'Loading forecast...'
  else if (!enabled) unavailable = 'Forecast not enabled'
  else if (!forecast?.sites.some(value => value.siteId === site.id)) unavailable = 'Forecast location unavailable'
  if (!day) return <div className="max-w-24 shrink-0 text-right text-xs text-muted-foreground sm:max-w-36">{unavailable}</div>
  const { Icon, label } = conditions(day.code)
  return <div className="max-w-24 shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-right text-xs text-slate-800 sm:max-w-36">
    <div className="flex items-center justify-end gap-1"><Icon aria-hidden="true" className="shrink-0" size={18} weight="duotone" /><span className="min-w-0 [overflow-wrap:anywhere]">{label}</span></div>
    <div className="font-semibold">{Math.round(day.minC)} to {Math.round(day.maxC)}&deg;C</div>
    {day.rainPercent !== null && <div>Precipitation {Math.round(day.rainPercent)}%</div>}
    <div className="break-words">{site?.name}</div>
    <div className="text-[0.65rem]">{event.date} · daily forecast</div>
    <a className="inline-block py-1 underline" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
  </div>
}
