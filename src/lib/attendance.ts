import type { Event } from './types'

export interface AttendanceCounts {
  confirmed: number
  unanswered: number
  declined: number
}

function validCounts(counts: AttendanceCounts | undefined): counts is AttendanceCounts {
  return Boolean(counts && [counts.confirmed, counts.unanswered, counts.declined]
    .every(value => Number.isSafeInteger(value) && value >= 0))
}

const sourceKey = (event: Event) => event.attendanceSourceIds?.length
  ? [...new Set(event.attendanceSourceIds)].sort().join(',') : event.spondId

export function eventAttendance(event: Event): AttendanceCounts | undefined {
  const confirmed = event.attendanceAccepted, unanswered = event.attendanceUnanswered, declined = event.attendanceDeclined
  if (typeof confirmed !== 'number' || typeof unanswered !== 'number' || typeof declined !== 'number'
    || ![confirmed, unanswered, declined].every(value => Number.isSafeInteger(value) && value >= 0)) return undefined
  return { confirmed, unanswered, declined }
}

export function teamAttendance(event: Event, teamId: string, allEvents: Event[] = [event]): AttendanceCounts | undefined {
  if (event.attendanceSourceIds?.length) {
    const counts = event.attendanceByTeam?.[teamId]
    if (event.attendanceError || !event.teamIds.includes(teamId) || !validCounts(counts)) return undefined
    const shared = allEvents.filter(peer => peer.id !== event.id &&
      peer.attendanceSourceIds?.some(id => event.attendanceSourceIds?.includes(id)))
    if (shared.some(peer => {
      const other = peer.attendanceByTeam?.[teamId]
      return sourceKey(peer) !== sourceKey(event) || peer.attendanceError || !validCounts(other) ||
        other.confirmed !== counts.confirmed || other.unanswered !== counts.unanswered || other.declined !== counts.declined
    })) return undefined
    return counts
  }
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
  const unique = [...new Map(distinct.map(event => [sourceKey(event) ? `spond:${sourceKey(event)}` : `qmt:${event.id}`, event])).values()]
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
