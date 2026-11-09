import { useData } from '@/contexts/DataContext'
import type { SportType, User } from '@/lib/types'
import EventCard from './EventCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CalendarBlank } from '@phosphor-icons/react'
import AttendanceSummary from './AttendanceSummary'
import { teamAttendanceTotal } from '@/lib/attendance'
import { useWeatherForecast } from '@/hooks/useWeatherForecast'

interface EventListProps {
  sportFilter: 'All Sports' | SportType
  teamFilter: string
  currentUser: User | null
}

export default function EventList({ sportFilter, teamFilter, currentUser }: EventListProps) {
  const { events, teams, fields, sites, isLoading, error } = useData()
  const weather = useWeatherForecast()

  const now = new Date()
  
  const filteredEvents = events.filter((event) => {
    const eventDate = new Date(`${event.endDate || event.date}T${event.endTime}`)
    const hoursFromNow = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursFromNow < -12) return false
    
    if (teamFilter !== 'all') {
      if (!event.teamIds || !event.teamIds.includes(teamFilter)) return false
    }

    if (sportFilter !== 'All Sports') {
      if (!event.teamIds) return false
      const eventTeams = teams.filter(t => event.teamIds.includes(t.id))
      if (eventTeams.length === 0) return false
      if (!eventTeams.some(t => t.sportType === sportFilter)) return false
    }

    return true
  }).sort((a, b) => {
    const dateA = new Date(a.date + ' ' + a.startTime).getTime()
    const dateB = new Date(b.date + ' ' + b.startTime).getTime()
    return dateA - dateB
  })

  if (filteredEvents.length === 0) {
    return (
      <Alert>
        <CalendarBlank className="h-4 w-4" />
        <AlertDescription>
          {isLoading ? 'Loading events...' : error
            ? 'The schedule is unavailable; retry loading before relying on availability.'
            : 'No upcoming events in the loaded window match your filters. Adjust the dates or filters.'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white/70 p-4">
        <h2 className="font-semibold">Team attendance totals</h2>
        <p className="mb-3 text-xs text-muted-foreground">Responses across the non-cancelled events shown, not unique players. Missing responses are not counted as zero.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.filter(team => filteredEvents.some(event => event.teamIds.includes(team.id))).map(team => {
            const total = teamAttendanceTotal(filteredEvents, team.id, events)
            return <div key={team.id} className="min-w-0 rounded-lg border p-2">
              <h3 className="text-sm font-medium">{team.name}</h3>
              <AttendanceSummary counts={total.counts} />
              <p className="text-xs text-muted-foreground">{total.covered}/{total.total} events with team counts
                {total.covered < total.total && ' · Incomplete total'}</p>
            </div>
          })}
        </div>
      </section>
      {weather.error && <p role="status" className="text-sm text-muted-foreground">{weather.error}</p>}
      {weather.data && <p className="text-xs text-muted-foreground">Forecasts retrieved: {new Date(weather.data.fetchedAt).toLocaleString('en-GB', { timeZone: weather.data.timezone })} ({weather.data.timezone})</p>}
      <div className="grid gap-4 md:grid-cols-2">
      {filteredEvents.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          teams={teams}
          fields={fields}
          sites={sites}
          currentUser={currentUser}
          weather={weather}
          attendanceEvents={events}
        />
      ))}
      </div>
    </div>
  )
}
