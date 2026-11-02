import { Badge } from '@/components/ui/badge'
import { formatSharedFieldBookings } from '@/lib/fieldSharing'
import type { Event, Field, Site, Team } from '@/lib/types'

export function SharedFieldBadge() {
  return <Badge variant="outline" className="border-amber-600 bg-amber-50 text-amber-900">Shared field</Badge>
}

export default function SharedFieldNotice({ event, fields, sites, teams }: {
  event: Event; fields: Field[]; sites: Site[]; teams: Team[]
}) {
  if (!event.sharedFieldBookings?.length && !event.externalAllocations?.length && !event.allocations?.length) return null
  return (
    <div className="space-y-1 rounded border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950 break-words">
      <p className="font-semibold">{event.sharedFieldBookings?.length || event.externalAllocations?.length
        ? 'Shared field - full field not exclusively available' : 'Field allocation'}</p>
      <ul className="space-y-1">
        {event.sharedFieldBookings?.map(booking => (
          <li key={`${booking.fieldId}:${booking.eventId}`}>
            {formatSharedFieldBookings([booking], fields, sites, teams)}
          </li>
        ))}
        {event.externalAllocations?.map((booking, index) => <li key={`external-${index}`}>
          {booking.participant}: {booking.start_time.slice(11, 16)}–{booking.end_time.slice(11, 16)}
          {' · '}{fields.find(field => field.id === String(booking.field_id))?.name || 'Location'}
          {' · '}{JSON.parse(booking.zones).join(' + ') || 'Whole location'}
        </li>)}
        {event.allocations?.map((allocation, index) => <li key={`allocation-${index}`}>
          Your allocation: {allocation.start.slice(11, 16)}–{allocation.end.slice(11, 16)}
          {' · '}{fields.find(field => field.id === allocation.fieldId)?.name || 'Location'}
          {' · '}{allocation.zones.join(' + ') || 'Whole location'}
        </li>)}
      </ul>
    </div>
  )
}
