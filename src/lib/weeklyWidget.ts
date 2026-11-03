import type { Event } from './types'

function dayTimes(event: Pick<Event, 'date' | 'endDate' | 'startTime' | 'endTime'>, date: string) {
  return {
    start: event.date === date ? event.startTime : '00:00',
    end: (event.endDate || event.date) === date ? event.endTime : '24:00',
  }
}

function overlapsDay(event: Pick<Event, 'date' | 'endDate' | 'startTime' | 'endTime'>, date: string) {
  const { start, end } = dayTimes(event, date)
  return event.date <= date && (event.endDate || event.date) >= date && end > start
}

export function widgetDays(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00Z`)
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== weekStart) {
    throw new Error('Invalid widget week')
  }
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start)
    day.setUTCDate(day.getUTCDate() + index)
    return day.toISOString().slice(0, 10)
  })
}

export function widgetBookings(events: Event[], date: string, team: string) {
  return events.filter(event => (team === 'all' || event.teamIds.includes(team)) && overlapsDay(event, date)).map(event => ({
    event: { ...event, sharedFieldBookings: event.sharedFieldBookings?.filter(booking => overlapsDay(booking, date)) },
    ...dayTimes(event, date),
  }))
    .sort((a, b) => a.start.localeCompare(b.start) || a.event.title.localeCompare(b.event.title))
}

export function widgetUrl(origin: string, week: string, team: string) {
  const url = new URL('/embed/week', origin)
  if (week) url.searchParams.set('week', week)
  if (team !== 'all') url.searchParams.set('team', team)
  return url.href
}
