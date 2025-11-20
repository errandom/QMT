import { useKV } from '@github/spark/hooks'
import { Event, SportType, Team, Field, Site } from '@/lib/types'
import EventCard from './EventCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CalendarBlank } from '@phosphor-icons/react'
import { useEffect } from 'react'

interface EventListProps {
  sportFilter: 'All Sports' | SportType
  teamFilter: string
}

export default function EventList({ sportFilter, teamFilter }: EventListProps) {
  const [events = [], setEvents] = useKV<Event[]>('events', [])
  const [teams = []] = useKV<Team[]>('teams', [])
  const [fields = []] = useKV<Field[]>('fields', [])
  const [sites = []] = useKV<Site[]>('sites', [])

  useEffect(() => {
    const now = new Date()
    let needsUpdate = false
    
    const updatedEvents = events.map(event => {
      if (event.status === 'Planned') {
        const eventDate = new Date(event.date + ' ' + event.startTime)
        const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        
        if (hoursUntilEvent < 24 && hoursUntilEvent > 0) {
          needsUpdate = true
          return { ...event, status: 'Confirmed' as const }
        }
      }
      return event
    })
    
    if (needsUpdate) {
      setEvents(updatedEvents)
    }
  }, [events, setEvents])

  const now = new Date()
  
  const filteredEvents = events.filter((event) => {
    const eventDate = new Date(event.date + ' ' + event.startTime)
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
          No upcoming events found. Check back later or adjust your filters.
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