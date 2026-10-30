import { useData } from '@/contexts/DataContext'
import type { Event, SportType } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CalendarBlank, CaretDown, Clock, MapPin, Users } from '@phosphor-icons/react'
import { useState, type CSSProperties } from 'react'
import { formatEventTimeRange } from '@/lib/utils'
import { formatSharedFieldBookings } from '@/lib/fieldSharing'
import SharedFieldNotice from './SharedFieldNotice'
import { buildWeeklyProgram } from '@/lib/scheduleProgram'
import { Button } from '@/components/ui/button'
import { getTeamColor } from '@/lib/teamColors'
import './ScheduleView.css'

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
  const [view, setView] = useState<'program' | 'week'>('program')
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

  const weeklyEvents = allEvents.flatMap(event => weekDates.flatMap(date => {
    const endDate = event.endDate || event.date
    if (event.date > date || endDate < date) return []
    const startTime = event.date === date ? event.startTime : '00:00'
    const endTime = endDate === date ? event.endTime : '24:00'
    if (endTime <= startTime) return []
    return [{ ...event, date, startTime, endTime, originalEvent: event }]
  }))
  const displayEvents: (Event & { originalEvent: Event; programDates?: string[] })[] = view === 'program'
    ? buildWeeklyProgram(allEvents, weekDates, eventWindow) : weeklyEvents

  const getEventFieldIds = (event: Event): string[] => {
    if (event.fieldIds?.length) return event.fieldIds
    return 'fieldId' in event && typeof event.fieldId === 'string' ? [event.fieldId] : []
  }

  const bookedFieldIds = new Set(displayEvents.flatMap(getEventFieldIds))
  const bookedFields = fields.filter(field => bookedFieldIds.has(field.id))

  // Filter sites to only show those with events, sorted by event count (most events first)
  const activeSites = sites
    .map(site => {
      const siteFields = bookedFields.filter(f => f.siteId === site.id)
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

  const fieldRows = activeSites.flatMap(site => bookedFields
    .filter(field => field.siteId === site.id)
    .map(field => ({ site, field, days: weekDates.map(date => displayEvents
      .filter(event => getEventFieldIds(event).includes(field.id) && event.date === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title))) })))
  const dayCounts = weekDates.map((_, index) => fieldRows.reduce((count, row) => count + row.days[index].length, 0))
  const dayWeights = dayCounts.map(count => count ? 1 + Math.min(count - 1, 4) * 0.18 : 0)
  const totalWeight = dayWeights.reduce((sum, weight) => sum + weight, 0)
  const quietDays = DAYS.filter((_, index) => !dayCounts[index])
  const shortDate = (date: string) => new Date(`${date}T00:00:00Z`)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

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
  const viewControls = <div className="space-y-3">
    <div role="group" aria-label="Schedule view" className="flex flex-wrap gap-2">
      <Button variant={view === 'program' ? 'default' : 'charcoal'} aria-pressed={view === 'program'}
        onClick={() => setView('program')}>Weekly program</Button>
      <Button variant={view === 'week' ? 'default' : 'charcoal'} aria-pressed={view === 'week'}
        onClick={() => setView('week')}>Specific week</Button>
    </div>
    {view === 'program'
      ? <p className="text-sm text-muted-foreground">
        Recurring program from loaded bookings ({eventWindow.from.slice(0, 10)} to {eventWindow.to.slice(0, 10)}).
        {' '}Repeated dates are combined. Use Specific week for actual bookings, one-off events and exceptions.
      </p> : weekControls}
  </div>

  if (displayEvents.length === 0) {
    return (
      <div className="space-y-4">
      {viewControls}
      <Alert>
        <CalendarBlank className="h-4 w-4" />
        <AlertDescription>
          {isLoading ? 'Loading schedule...' : error ? 'The schedule could not be loaded; retry before relying on availability.'
            : view === 'program' ? 'No matching recurring events in the loaded schedule.'
            : weekOutsideWindow ? 'Load the selected week to check its schedule.' : 'No matching events in the selected week.'}
        </AlertDescription>
      </Alert>
      </div>
    )
  }

  return (
    <div className="schedule-view space-y-4">
      {viewControls}
      <p className="text-xs text-muted-foreground">Team colors stay consistent. Select a booking for details and sharing information.</p>
      <table className="schedule-board" role="table">
        <caption className="sr-only">{view === 'program' ? 'Recurring weekly program' : 'Bookings for the selected week'}, by day and location</caption>
        <colgroup>
          {DAYS.map((day, index) => <col key={day} data-day={day} data-active={dayCounts[index] > 0}
            style={{ width: dayWeights[index]
              ? `${(100 - quietDays.length * 4) * dayWeights[index] / totalWeight}%`
              : '4%' }} />)}
        </colgroup>
        <thead role="rowgroup">
          <tr role="row">
            {DAYS.map((day, index) => <th key={day} scope="col" role="columnheader" data-active={dayCounts[index] > 0}>
              <abbr title={day}>{day.slice(0, 3)}</abbr>
              {view === 'week' && <span className="schedule-header-date">{shortDate(weekDates[index])}</span>}
              {!dayCounts[index] && <span className="sr-only">: no bookings shown</span>}
            </th>)}
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr role="row">
            {DAYS.map((day, dayIndex) => <td key={day} role="cell" aria-colindex={dayIndex + 1}
              data-day={day} data-has-events={dayCounts[dayIndex] > 0}>
              <div className="schedule-mobile-day" aria-hidden="true">
                {day}{view === 'week' && <span>{shortDate(weekDates[dayIndex])}</span>}
              </div>
              {!dayCounts[dayIndex] ? <span className="schedule-empty" aria-label="No bookings shown">-</span>
                : fieldRows.filter(row => row.days[dayIndex].length > 0)
                  .sort((a, b) => a.days[dayIndex][0].startTime.localeCompare(b.days[dayIndex][0].startTime))
                  .map(({ site, field, days }) => <section key={field.id} className="schedule-location-group"
                    aria-label={`${site.name} / ${field.name}`}>
                    <h3 className="schedule-location">
                      <span className="schedule-site"><MapPin aria-hidden="true" size={14} />{site.name}</span>
                      <span className="schedule-field">{field.name}</span>
                    </h3>
                    <div className="schedule-bookings">{days[dayIndex].map(event => {
                      const eventTeamIds = [...new Set(event.teamIds || [])].sort()
                      const teamColor = eventTeamIds.length === 1 ? getTeamColor(eventTeamIds[0]) : undefined
                      const sharedFieldBookings = (event.sharedFieldBookings || []).filter(booking =>
                        booking.fieldId === field.id
                        && (view === 'program' || (`${booking.date}T${booking.startTime}` < `${event.date}T${event.endTime}`
                        && `${booking.endDate}T${booking.endTime}` > `${event.date}T${event.startTime}`)))
                      const sharingLabel = view === 'program' ? 'Shared on some dates' : 'Shared field'
                      return <details key={event.id} className="schedule-booking" data-event-id={event.originalEvent.id}
                        data-status={view === 'week' ? event.status : undefined}
                        style={{ '--booking-accent': teamColor?.foreground || '#475569' } as CSSProperties}>
                        <summary aria-label={`${day}, ${event.startTime} - ${event.endTime}, ${eventTeamIds.map(id => teams.find(team => team.id === id)?.name || `Team ${id}`).join(', ')}, ${event.title || event.eventType}${view === 'week' ? `, ${event.status}` : ''}${sharedFieldBookings.length
                          ? `; ${sharingLabel} - full field not exclusively available. ${formatSharedFieldBookings(sharedFieldBookings, fields, sites, teams)}`
                          : ''}`}>
                          <span className="schedule-time"><Clock aria-hidden="true" size={13} />{event.startTime} - {event.endTime}<CaretDown aria-hidden="true" size={12} className="schedule-expand" /></span>
                          {eventTeamIds.length > 0 && <span className="schedule-teams">{eventTeamIds.map(id => {
                            const color = getTeamColor(id)
                            return <span key={id} className="schedule-team" data-team-id={id}
                              style={{ color: color.foreground, backgroundColor: color.background }}>
                              {teams.find(team => team.id === id)?.name || `Team ${id}`}
                            </span>
                          })}</span>}
                          <span className="schedule-title">{event.title || event.eventType}</span>
                          <span className="schedule-kind">{event.eventType}{view === 'week' && <> · {event.status}</>}</span>
                          {sharedFieldBookings.length > 0 && <span className="schedule-sharing"><Users aria-hidden="true" size={13} />{sharingLabel}</span>}
                        </summary>
                        <div className="schedule-booking-details">
                          {event.otherParticipants && <div>Participants: {event.otherParticipants}</div>}
                          <div>Time: {view === 'program' ? `${event.startTime} - ${event.endTime}`
                            : `${event.originalEvent.date} ${formatEventTimeRange(event.originalEvent)}`}</div>
                          {event.programDates && <div>Loaded occurrences: {event.programDates[0]} to {event.programDates[event.programDates.length - 1]} ({event.programDates.length} dates)</div>}
                          {view === 'week' && <Badge variant={event.status === 'Confirmed' ? 'default'
                            : event.status === 'Cancelled' ? 'destructive' : 'secondary'}>{event.status}</Badge>}
                          <SharedFieldNotice event={{ ...event.originalEvent, sharedFieldBookings }} fields={fields} sites={sites} teams={teams} />
                        </div>
                      </details>
                    })}</div>
                  </section>)}
            </td>)}
          </tr>
        </tbody>
      </table>
      {quietDays.length > 0 && <p className="schedule-quiet-note">No bookings shown: {quietDays.join(', ')}.</p>}
    </div>
  )
}
