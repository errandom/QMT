import type { Event, Field, PublishedBooking, PublishedSchedule, Site, Team } from './types'

export function publishedSites(event: Event, fields: Field[], sites: Site[]) {
  if (event.gameLocation === 'away' || ['Cancelled', 'Completed'].includes(event.status)) return []
  const siteIds = new Set(fields
    .filter(field => field.locationType === 'field' && event.fieldIds.includes(field.id))
    .map(field => field.siteId))
  return sites.filter(site => siteIds.has(site.id) && site.publishedScheduleUrl)
}

export function publishedScheduleKey(site: Site, date: string) {
  return JSON.stringify([site.id, date, site.publishedScheduleUrl])
}

const nameKey = (name: string) => name.normalize('NFKD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const pitchKey = (name: string) => nameKey(name).replace(/ /g, '')

export interface BookingComparison {
  status: 'matched' | 'deviation' | 'ambiguous' | 'not_found' | 'needs_review'
  message: string
  bookings: PublishedBooking[]
}

export function comparePublishedBooking(
  event: Event, site: Site, fields: Field[], teams: Team[], schedule: PublishedSchedule,
): BookingComparison {
  const review = (message: string): BookingComparison => ({ status: 'needs_review', message, bookings: [] })
  if (schedule.configuredSourceUrl !== site.publishedScheduleUrl) {
    return review('The site source has changed. Refresh QMT site data before comparing.')
  }
  if (schedule.status !== 'available') return review(schedule.message || 'The published plan is unavailable.')
  if (schedule.date !== event.date || schedule.publishedDate !== event.date) {
    return review('The published plan is for a different date.')
  }
  if (event.gameLocation === 'away' || ['Cancelled', 'Completed'].includes(event.status)) {
    return review('This event does not need a home-site booking check.')
  }
  if ((event.endDate && event.endDate !== event.date) || event.endTime <= event.startTime) {
    return review('Overnight or multi-day events require manual review of each published day.')
  }
  const expected = fields.filter(field => field.siteId === site.id
    && field.locationType === 'field' && event.fieldIds.includes(field.id))
  if (!expected.length) return review('No assigned sports field at this site can be compared.')
  const names = site.publishedBookingName?.trim()
    ? [site.publishedBookingName]
    : teams.filter(team => event.teamIds.includes(team.id)).map(team => team.name)
  const identities = new Set(names.map(nameKey).filter(Boolean))
  if (!identities.size) return review('Choose a QMT team or set the site\'s published booking name.')
  const identified = schedule.bookings.filter(booking => identities.has(nameKey(booking.team)))
  const sameTime = (booking: PublishedBooking) =>
    booking.startTime === event.startTime && booking.endTime === event.endTime
  const samePitch = (booking: PublishedBooking, field: Field) => {
    if (!booking.area.trim()) return false
    const whole = ['ganzerplatz', 'ganz', 'gesamt', '1/1'].includes(booking.area.trim().toLowerCase().replace(/ /g, ''))
    if ((whole && field.fieldSize === 'Shared') || (!whole && field.fieldSize === 'Full')) return false
    return pitchKey(field.name) === pitchKey(`${booking.field} ${booking.area}`)
      || (whole && pitchKey(field.name) === pitchKey(booking.field))
  }
  const cancelled = (booking: PublishedBooking) =>
    /abgesagt|cancelled|canceled|annulliert|gesperrt|storniert/i.test(`${booking.kind} ${booking.information || ''}`)
  const needsReview = (booking: PublishedBooking) => Boolean(booking.information)
    || /provisor|vorlaufig|unbestatigt|pending|unconfirmed|anfrage/.test(nameKey(booking.kind))
  const matches = expected.map(field => identified
    .filter(booking => sameTime(booking) && samePitch(booking, field) && !cancelled(booking) && !needsReview(booking)))
  const unique = new Set(matches.flat())
  if (matches.every(rows => rows.length === 1) && unique.size === expected.length) {
    return { status: 'matched', message: 'Published allocation matches the booking name, time and every assigned pitch/section. QMT event status is unchanged.', bookings: [...unique] }
  }
  if (!identified.length) {
    const nearby = schedule.bookings.filter(booking => sameTime(booking)
      || (booking.startTime < event.endTime && booking.endTime > event.startTime
        && expected.some(field => samePitch(booking, field))))
    return {
      status: 'not_found',
      message: `No allocation under ${names.join(' / ')} was found. This is not a cancellation; check the published name and source.`,
      bookings: nearby,
    }
  }
  const related = identified.filter(booking => expected.some(field => samePitch(booking, field))
    || (booking.startTime < event.endTime && booking.endTime > event.startTime))
  const candidates = related.length ? related : identified
  if (candidates.length > 1 || unique.size !== matches.filter(rows => rows.length).length) {
    return { status: 'ambiguous', message: 'Several published allocations could apply, or not every assigned pitch matches. Review the entries before confirming.', bookings: candidates }
  }
  if (needsReview(candidates[0]) && !cancelled(candidates[0])) {
    return { status: 'needs_review', message: 'The source includes additional information or a provisional entry. Review it before confirming the booking.', bookings: candidates }
  }
  return {
    status: 'deviation',
    message: cancelled(candidates[0])
      ? 'The source marks this allocation as cancelled or unavailable. Verify with the facility; QMT is unchanged.'
      : 'Possible time or pitch/section change. Compare the published allocation with QMT; different pitch naming also requires review.',
    bookings: candidates,
  }
}
