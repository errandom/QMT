import type { Event } from './types'

export interface AttendanceCounts {
  confirmed: number
  unanswered: number
  declined: number
}

export function eventAttendance(event: Event): AttendanceCounts | undefined {
  const confirmed = event.attendanceAccepted, unanswered = event.attendanceUnanswered, declined = event.attendanceDeclined
  if (typeof confirmed !== 'number' || typeof unanswered !== 'number' || typeof declined !== 'number'
    || ![confirmed, unanswered, declined].every(value => Number.isSafeInteger(value) && value >= 0)) return undefined
  return { confirmed, unanswered, declined }
}

export function teamAttendance(event: Event, teamId: string, allEvents: Event[] = [event]): AttendanceCounts | undefined {
  const ids = [...new Set(event.teamIds)]
  // Combined provider counts cannot be divided between multiple QMT teams.
  if (ids.length !== 1 || ids[0] !== teamId) return undefined
  const counts = eventAttendance(event)
  if (!counts || !event.spondId) return counts
  const peers = allEvents.filter(peer => peer.spondId === event.spondId)
  if (peers.some(peer => peer.teamIds.some(id => id !== teamId))) return undefined
  if (peers.some(peer => {
    const other = eventAttendance(peer)
    return !other || other.confirmed !== counts.confirmed || other.unanswered !== counts.unanswered || other.declined !== counts.declined
  })) return undefined
  return counts
}

export function teamAttendanceTotal(events: Event[], teamId: string, allEvents: Event[] = events) {
  const distinct = [...new Map(events.filter(event => event.status !== 'Cancelled'
    && event.teamIds.includes(teamId)).map(event => [event.id, event])).values()]
  const unique = [...new Map(distinct.map(event => [event.spondId ? `spond:${event.spondId}` : `qmt:${event.id}`, event])).values()]
  let covered = 0
  const counts: AttendanceCounts = { confirmed: 0, unanswered: 0, declined: 0 }
  for (const event of unique) {
    const attendance = teamAttendance(event, teamId, allEvents)
    if (!attendance) continue
    covered++
    counts.confirmed += attendance.confirmed
    counts.unanswered += attendance.unanswered
    counts.declined += attendance.declined
  }
  return { counts: covered ? counts : undefined, covered, total: unique.length }
}
