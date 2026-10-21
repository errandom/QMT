import { useData } from '@/contexts/DataContext'
import { Event, SportType, Team, Field, Site } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CalendarBlank } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useState } from 'react'
import { formatEventTimeRange } from '@/lib/utils'

interface ScheduleViewProps {
  sportFilter: 'All Sports' | SportType
  teamFilter: string
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function mondayOf(date: string) {
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
  return day.toISOString().slice(0, 10)
}

export default function ScheduleView({ sportFilter, teamFilter }: ScheduleViewProps) {
  const { events, teams, fields, sites, eventWindow, refreshData, isLoading, error } = useData()
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date().toISOString().slice(0, 10)))
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekStart}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + index)
    return date.toISOString().slice(0, 10)
  })

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

  // Recurrence is materialized in SQL: display actual dated occurrences, not a synthetic template week.
  const displayEvents = allEvents.flatMap(event => weekDates.flatMap(date => {
    const endDate = event.endDate || event.date
    if (event.date > date || endDate < date) return []
    const startTime = event.date === date ? event.startTime : '00:00'
    const endTime = endDate === date ? event.endTime : '24:00'
    if (endTime <= startTime) return []
    return [{ ...event, date, startTime, endTime, originalEvent: event }]
  }))

  // Helper to get field IDs for an event (supports both fieldIds array and legacy fieldId)
  const getEventFieldIds = (event: any): string[] => {
    if (event.fieldIds && event.fieldIds.length > 0) {
      return event.fieldIds
    }
    if (event.fieldId) {
      return [event.fieldId]
    }
    return []
  }

  // Filter sites to only show those with events, sorted by event count (most events first)
  const activeSites = sites
    .map(site => {
      const siteFields = fields.filter(f => f.siteId === site.id)
      const siteFieldIds = siteFields.map(f => f.id)
      const eventCount = displayEvents.filter(e => {
        const eventFieldIds = getEventFieldIds(e)
        return eventFieldIds.some(fid => siteFieldIds.includes(fid))
      }).length
      return { site, eventCount }
    })
    .filter(({ eventCount }) => eventCount > 0)
    .sort((a, b) => b.eventCount - a.eventCount)
    .map(({ site }) => site)

  const getEventPosition = (startTime: string, endTime: string) => {
    const start = timeToMinutes(startTime)
    const end = timeToMinutes(endTime)
    
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
  const scheduleStart = displayEvents.reduce((start, event) => Math.max(0, Math.min(start, timeToMinutes(event.startTime))), 17 * 60)
  const scheduleEnd = displayEvents.reduce((end, event) => Math.min(24 * 60, Math.max(end, timeToMinutes(event.endTime))), 22 * 60)
  const timeLabel = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

  const getEventsForSiteFieldDay = (siteId: string, fieldId: string, dayIndex: number) => {
    return displayEvents.filter(event => {
      const eventFieldIds = getEventFieldIds(event)
      // Check if this field is one of the event's fields
      if (!eventFieldIds.includes(fieldId)) return false
      
      return event.date === weekDates[dayIndex - 1]
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

  const nextWeek = new Date(`${weekStart}T00:00:00Z`)
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7)
  const weekOutsideWindow = `${weekStart}T00:00:00.000Z` < eventWindow.from
    || nextWeek.toISOString() > eventWindow.to
  const weekControls = <div className="flex flex-wrap items-center gap-3">
    <label>Week containing <input className="rounded border p-2" type="date" value={weekStart} onChange={event => {
      if (event.target.value) setWeekStart(mondayOf(event.target.value))
    }} /></label>
    <span>{weekDates[0]} to {weekDates[6]}</span>
    {weekOutsideWindow && <button className="rounded border p-2" disabled={isLoading}
      onClick={() => void refreshData({ from: `${weekStart}T00:00:00.000Z`, to: nextWeek.toISOString() })}>
      Load this week (outside loaded window)
    </button>}
  </div>

  if (displayEvents.length === 0) {
    return (
      <div className="space-y-4">
      {weekControls}
      <Alert>
        <CalendarBlank className="h-4 w-4" />
        <AlertDescription>
          {isLoading ? 'Loading schedule...' : error ? 'The schedule could not be loaded; retry before relying on availability.'
            : weekOutsideWindow ? 'Load the selected week to check its schedule.' : 'No matching events in the selected week.'}
        </AlertDescription>
      </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {weekControls}
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
                <div className="min-w-[1100px]">
                  <div className="grid grid-cols-8 gap-2 mb-2">
                    <div className="text-sm font-medium" style={{ color: '#6b7280' }}>Location</div>
                    {DAYS.map(day => (
                      <div key={day} className="text-sm font-medium text-center" style={{ color: '#001f3f' }}>
                        {day}
                      </div>
                    ))}
                  </div>

                  {siteFields.map(field => {
                    // Check if this field is used by Meeting/Other events
                    const fieldEvents = displayEvents.filter(e => getEventFieldIds(e).includes(field.id))
                    const isMeetingLocation = fieldEvents.length > 0 && fieldEvents.every(e => e.eventType === 'Meeting' || e.eventType === 'Other')
                    
                    return (
                    <div key={field.id} className="grid grid-cols-8 gap-2 mb-4">
                      <div className="text-sm font-medium flex items-center" style={{ color: '#001f3f' }}>
                        {isMeetingLocation ? site.name : field.name}
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
                                    <TooltipContent className="glass-card border-white/30 max-w-xs">
                                      <div className="text-xs space-y-1.5">
                                        <div className="font-semibold text-sm" style={{ color: '#001f3f' }}>
                                          {event.title || event.eventType}
                                        </div>
                                        <div className="text-muted-foreground">
                                          <span className="font-medium">Type:</span> {event.eventType}
                                        </div>
                                        <div className="text-muted-foreground">
                                          <span className="font-medium">Teams:</span> {eventTeams.map(t => t.name).join(', ') || 'None'}
                                        </div>
                                        {event.otherParticipants && (
                                          <div className="text-muted-foreground">
                                            <span className="font-medium">Participants:</span> {event.otherParticipants}
                                          </div>
                                        )}
                                        <div className="text-muted-foreground">
                                          <span className="font-medium">Time:</span> {event.originalEvent.date} {formatEventTimeRange(event.originalEvent)}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="font-medium text-muted-foreground">Status:</span>
                                          <Badge 
                                            variant={event.status === 'Confirmed' ? 'default' : event.status === 'Cancelled' ? 'destructive' : 'secondary'}
                                            className="text-xs"
                                          >
                                            {event.status}
                                          </Badge>
                                        </div>
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
                    )
                  })}

                  <div className="grid grid-cols-8 gap-2 mt-2 pt-2 border-t border-white/30">
                    <div></div>
                    {DAYS.map(day => (
                      <div key={day} className="flex justify-between text-[10px] px-1" style={{ color: '#6b7280' }}>
                        <span>{timeLabel(scheduleStart)}</span>
                        <span>{timeLabel(Math.round((scheduleStart + scheduleEnd) / 2))}</span>
                        <span>{timeLabel(scheduleEnd)}</span>
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
