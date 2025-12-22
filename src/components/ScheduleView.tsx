import { useData } from '@/contexts/DataContext'
import { Event, SportType, Team, Field, Site } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CalendarBlank } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ScheduleViewProps {
  sportFilter: 'All Sports' | SportType
  teamFilter: string
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const TIME_SLOTS = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30']

export default function ScheduleView({ sportFilter, teamFilter }: ScheduleViewProps) {
  const { events, teams, fields, sites } = useData()

  const activeSites = sites
  
  const allEvents = events.filter((event) => {
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
  })

  // Show all events - both recurring and one-time events
  const displayEvents = allEvents

  const getEventPosition = (startTime: string, endTime: string) => {
    const start = timeToMinutes(startTime)
    const end = timeToMinutes(endTime)
    const scheduleStart = 17 * 60
    const scheduleEnd = 22 * 60
    
    if (end <= scheduleStart || start >= scheduleEnd) return null
    
    const visibleStart = Math.max(start, scheduleStart)
    const visibleEnd = Math.min(end, scheduleEnd)
    const totalMinutes = scheduleEnd - scheduleStart
    
    const leftPercent = ((visibleStart - scheduleStart) / totalMinutes) * 100
    const widthPercent = ((visibleEnd - visibleStart) / totalMinutes) * 100
    
    return { left: `${leftPercent}%`, width: `${widthPercent}%` }
  }

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  const getEventsForSiteFieldDay = (siteId: string, fieldId: string, dayIndex: number) => {
    return displayEvents.filter(event => {
      // For recurring events, check if the day matches
      if (event.isRecurring && event.recurringDays) {
        return event.fieldId === fieldId && event.recurringDays.includes(dayIndex)
      }
      // For one-time events, check if the event's date falls on this day of the week
      const eventDate = new Date(event.date)
      const eventDayOfWeek = eventDate.getDay() === 0 ? 7 : eventDate.getDay() // Sunday = 7
      return event.fieldId === fieldId && eventDayOfWeek === dayIndex
    })
  }

  const getTeamColor = (teamIds: string[], index: number) => {
    // Updated color palette - grey and blue tones aligned with site theme
    const colors = [
      { bg: '#248bcc', text: '#ffffff' }, // Primary blue
      { bg: '#4a90a4', text: '#ffffff' }, // Teal blue
      { bg: '#5a6c7d', text: '#ffffff' }, // Grey blue
      { bg: '#202122ff', text: '#ffffff' }, // Light blue
      { bg: '#708090', text: '#ffffff' }, // Slate grey
      { bg: '#4682b4', text: '#ffffff' }  // Steel blue
    ]
    const hash = (teamIds[0]?.charCodeAt(0) || 0) + index
    return colors[hash % colors.length]
  }

  // Check if two events overlap in time
  const eventsOverlap = (event1: Event, event2: Event) => {
    const start1 = timeToMinutes(event1.startTime)
    const end1 = timeToMinutes(event1.endTime)
    const start2 = timeToMinutes(event2.startTime)
    const end2 = timeToMinutes(event2.endTime)
    return start1 < end2 && start2 < end1
  }

  // Assign row positions to prevent overlapping
  const assignEventRows = (events: Event[]) => {
    const sortedEvents = [...events].sort((a, b) => 
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    )
    const rows: Event[][] = []
    
    sortedEvents.forEach(event => {
      let placed = false
      for (let i = 0; i < rows.length; i++) {
        const rowEvents = rows[i]
        const hasOverlap = rowEvents.some(e => eventsOverlap(e, event))
        if (!hasOverlap) {
          rows[i].push(event)
          placed = true
          break
        }
      }
      if (!placed) {
        rows.push([event])
      }
    })
    
    const eventRowMap = new Map<string, number>()
    rows.forEach((row, rowIndex) => {
      row.forEach(event => {
        eventRowMap.set(event.id, rowIndex)
      })
    })
    
    return { rowCount: rows.length, eventRowMap }
  }

  if (displayEvents.length === 0) {
    return (
      <Alert>
        <CalendarBlank className="h-4 w-4" />
        <AlertDescription>
          No events scheduled for the current planning period.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {activeSites.map(site => {
        const siteFields = fields.filter(f => f.siteId === site.id)
        if (siteFields.length === 0) return null

        return (
          <Card key={site.id} className="glass-card border-white/30">
            <CardHeader>
              <CardTitle className="text-base font-semibold" style={{ color: '#001f3f' }}>{site.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="grid grid-cols-6 gap-2 mb-2">
                    <div className="text-sm font-medium" style={{ color: '#6b7280' }}>Field</div>
                    {DAYS.map(day => (
                      <div key={day} className="text-sm font-medium text-center" style={{ color: '#001f3f' }}>
                        {day}
                      </div>
                    ))}
                  </div>

                  {siteFields.map(field => (
                    <div key={field.id} className="grid grid-cols-6 gap-2 mb-4">
                      <div className="text-sm font-medium flex items-center" style={{ color: '#001f3f' }}>
                        {field.name}
                      </div>
                      
                      {DAYS.map((day, dayIndex) => {
                        const dayEvents = getEventsForSiteFieldDay(site.id, field.id, dayIndex + 1)
                        const { rowCount, eventRowMap } = assignEventRows(dayEvents)
                        
                        return (
                          <div key={day} className="relative rounded-lg border" style={{
                            height: '120px', // Fixed height for all day boxes
                            background: 'rgba(255, 255, 255, 0.4)',
                            borderColor: 'rgba(36, 139, 204, 0.3)'
                          }}>
                            <TooltipProvider>
                              {dayEvents.map((event, eventIndex) => {
                                const position = getEventPosition(event.startTime, event.endTime)
                                if (!position) return null
                                
                                const eventTeams = event.teamIds ? teams.filter(t => event.teamIds.includes(t.id)) : []
                                const teamColor = getTeamColor(event.teamIds || [], eventIndex)
                                const isCancelled = event.status === 'Cancelled'
                                const rowIndex = eventRowMap.get(event.id) || 0
                                const totalRows = Math.max(rowCount, 1)
                                const rowHeight = 120 / totalRows
                                
                                return (
                                  <Tooltip key={event.id}>
                                    <TooltipTrigger asChild>
                                      <div
                                        className="absolute rounded px-1 flex items-center justify-center text-xs font-medium cursor-pointer hover:brightness-110 transition-all overflow-hidden shadow-md"
                                        style={{
                                          ...position,
                                          top: `${rowIndex * rowHeight + 4}px`,
                                          height: `${rowHeight - 8}px`,
                                          backgroundColor: isCancelled ? '#9ca3af' : teamColor.bg,
                                          color: teamColor.text,
                                          opacity: isCancelled ? 0.6 : 1,
                                          textDecoration: isCancelled ? 'line-through' : 'none'
                                        }}
                                      >
                                        <span className="truncate">
                                          {event.title || event.eventType}
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="glass-card border-white/30">
                                      <div className="text-xs space-y-1">
                                        <div className="font-semibold">Team(s): {eventTeams.map(t => t.name).join(', ') || 'None'}</div>
                                        <div className="text-muted-foreground">Event Type: {event.eventType}</div>
                                        <div className="text-muted-foreground">Status: {event.status}</div>
                                        <div className="font-medium">{event.startTime} - {event.endTime}</div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )
                              })}
                            </TooltipProvider>
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  <div className="grid grid-cols-6 gap-2 mt-2 pt-2 border-t border-white/30">
                    <div></div>
                    {DAYS.map(day => (
                      <div key={day} className="flex justify-between text-[10px] px-1" style={{ color: '#6b7280' }}>
                        <span>17:00</span>
                        <span>19:30</span>
                        <span>22:00</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
