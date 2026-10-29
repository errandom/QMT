import type { Event } from './types'

export function buildWeeklyProgram(events: Event[], weekDates: string[], window: { from: string; to: string }) {
  const slots = new Map<string, Event & { originalEvent: Event; programDates: string[] }>()
  for (const event of events) {
    if (!event.isRecurring || event.status === 'Cancelled' || event.status === 'Completed') continue
    const legacyFieldId = 'fieldId' in event && typeof event.fieldId === 'string' ? event.fieldId : undefined
    const fieldIds = event.fieldIds?.length ? event.fieldIds : legacyFieldId ? [legacyFieldId] : []
    const lastDate = event.endDate || event.date
    for (const day = new Date(`${event.date}T00:00:00Z`);
      day.toISOString().slice(0, 10) <= lastDate; day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10)
      const startTime = date === event.date ? event.startTime : '00:00'
      const endTime = date === lastDate ? event.endTime : '24:00'
      if (endTime <= startTime || `${date}T${endTime}:00.000Z` <= window.from
          || `${date}T${startTime}:00.000Z` >= window.to) continue
      const weekday = (day.getUTCDay() + 6) % 7
      const key = JSON.stringify([weekday, startTime, endTime, event.title, event.eventType,
        [...fieldIds].sort(), [...event.teamIds].sort(), event.otherParticipants || ''])
      const sharing = (event.sharedFieldBookings || []).filter(booking =>
        `${booking.date}T${booking.startTime}` < `${date}T${endTime}`
        && `${booking.endDate}T${booking.endTime}` > `${date}T${startTime}`)
      const slot = slots.get(key)
      if (slot) {
        if (!slot.programDates.includes(date)) slot.programDates.push(date)
        slot.sharedFieldBookings!.push(...sharing)
      } else {
        slots.set(key, { ...event, fieldIds, id: `program:${key}`, date: weekDates[weekday], startTime, endTime,
          originalEvent: event, programDates: [date], sharedFieldBookings: [...sharing] })
      }
    }
  }
  return [...slots.values()].map(slot => ({
    ...slot, programDates: slot.programDates.sort(),
    sharedFieldBookings: [...new Map(slot.sharedFieldBookings!.map(booking =>
      [JSON.stringify(booking), booking])).values()],
  })).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title))
}
