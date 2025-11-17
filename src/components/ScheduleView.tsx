import { useKV } from '@github/spark/hooks'
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
  const [events = []] = useKV<Event[]>('events', [])
  const [teams = []] = useKV<Team[]>('teams', [])
  const [fields = []] = useKV<Field[]>('fields', [])
  const [sites = []] = useKV<Site[]>('sites', [])

  const activeSites = sites.filter(s => s.isActive && s.isSportsFacility)
  
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

  const recurringEvents = allEvents.filter(event => event.isRecurring)

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
    return recurringEvents.filter(event => {
      return event.fieldId === fieldId && event.recurringDays?.includes(dayIndex)
    })
  }

  const getTeamColor = (teamIds: string[]) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500'
    ]
    const hash = teamIds[0]?.charCodeAt(0) || 0
    return colors[hash % colors.length]
  }

  if (recurringEvents.length === 0) {
    return (
      <Alert>
        <CalendarBlank className="h-4 w-4" />
        <AlertDescription>
          No recurring events scheduled for the current planning period.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {activeSites.map(site => {
        const siteFields = fields.filter(f => f.siteId === site.id && f.isActive)
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
                        
                        return (
                          <div key={day} className="relative h-12 rounded-lg border" style={{
                            background: 'rgba(255, 255, 255, 0.4)',
                            borderColor: 'rgba(36, 139, 204, 0.3)'
                          }}>
                            <TooltipProvider>
                              {dayEvents.map(event => {
                                const position = getEventPosition(event.startTime, event.endTime)
                                if (!position) return null
                                
                                const eventTeams = event.teamIds ? teams.filter(t => event.teamIds.includes(t.id)) : []
                                const teamColor = getTeamColor(event.teamIds || [])
                                const isCancelled = event.status === 'Cancelled'
                                
                                return (
                                  <Tooltip key={event.id}>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`absolute top-1 bottom-1 ${isCancelled ? 'bg-gray-400 opacity-60' : teamColor} rounded px-1 flex items-center justify-center text-white text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity overflow-hidden shadow-md ${isCancelled ? 'line-through' : ''}`}
                                        style={position}
                                      >
                                        <span className="truncate">
                                          {eventTeams.map(t => t.name).join(', ')}
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="glass-card border-white/30">
                                      <div className="text-xs space-y-1">
                                        <div className="font-semibold">{event.title}</div>
                                        <div>{event.startTime} - {event.endTime}</div>
                                        <div>{eventTeams.map(t => t.name).join(', ')}</div>
                                        <div className="text-muted-foreground">Status: {event.status}</div>
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