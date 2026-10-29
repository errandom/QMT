import type { Event, Field, SharedFieldBooking, Site, Team } from './types'

export function withFieldSharing(events: Event[]): Event[] {
  const sharing = new Map<string, SharedFieldBooking[]>()
  const byField = new Map<string, { event: Event; start: number; end: number }[]>()
  for (const event of events) {
    sharing.set(event.id, [])
    if (event.status === 'Cancelled' || event.status === 'Completed') continue
    const start = Date.parse(`${event.date}T${event.startTime}Z`)
    const end = Date.parse(`${event.endDate || event.date}T${event.endTime}Z`)
    for (const fieldId of new Set(event.fieldIds)) {
      const bookings = byField.get(fieldId) || []
      bookings.push({ event, start, end })
      byField.set(fieldId, bookings)
    }
  }
  for (const [fieldId, bookings] of byField) {
    bookings.sort((a, b) => a.start - b.start)
    for (let i = 0; i < bookings.length; i++) {
      const first = bookings[i]
      for (let j = i + 1; j < bookings.length && bookings[j].start < first.end; j++) {
        const second = bookings[j]
        if (first.event.id === second.event.id) continue
        const start = new Date(Math.max(first.start, second.start)).toISOString()
        const end = new Date(Math.min(first.end, second.end)).toISOString()
        const interval = {
          fieldId, date: start.slice(0, 10), endDate: end.slice(0, 10),
          startTime: start.slice(11, 16), endTime: end.slice(11, 16),
        }
        for (const [event, other] of [[first.event, second.event], [second.event, first.event]]) {
          sharing.get(event.id)!.push({
            ...interval, eventId: other.id, title: other.title, teamIds: other.teamIds,
          })
        }
      }
    }
  }
  return events.map(event => ({ ...event, sharedFieldBookings: sharing.get(event.id)! }))
}

export function formatSharedFieldBookings(
  bookings: SharedFieldBooking[], fields: Field[], sites: Site[], teams: Team[],
): string {
  return bookings.map(booking => {
    const field = fields.find(field => field.id === booking.fieldId)
    const site = sites.find(site => site.id === field?.siteId)
    const location = [site?.name, field?.name || `Field ${booking.fieldId}`].filter(Boolean).join(' / ')
    const others = booking.teamIds.map(id => teams.find(team => team.id === id)?.name)
      .filter(Boolean).join(', ') || booking.title || 'another booking'
    const start = `${booking.date} ${booking.startTime}`
    const end = booking.endDate === booking.date ? booking.endTime : `${booking.endDate} ${booking.endTime}`
    return `${location}: ${start} - ${end}, shared with ${others}`
  }).join('; ')
}
