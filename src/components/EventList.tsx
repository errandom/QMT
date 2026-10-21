import { useData } from '@/contexts/DataContext'
import { Event, SportType, Team, Field, Site } from '@/lib/types'
import EventCard from './EventCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CalendarBlank } from '@phosphor-icons/react'

interface EventListProps {
  sportFilter: 'All Sports' | SportType
  teamFilter: string
}

export default function EventList({ sportFilter, teamFilter }: EventListProps) {
  const { events, teams, fields, sites, isLoading, error } = useData()

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
    <div className="grid gap-4 md:grid-cols-2">
      {filteredEvents.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          teams={teams}
          fields={fields}
          sites={sites}
        />
      ))}
    </div>
  )
}
