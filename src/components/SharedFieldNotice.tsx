import { Badge } from '@/components/ui/badge'
import { formatSharedFieldBookings } from '@/lib/fieldSharing'
import type { Event, Field, Site, Team } from '@/lib/types'

export function SharedFieldBadge() {
  return <Badge variant="outline" className="border-amber-600 bg-amber-50 text-amber-900">Shared field</Badge>
}

export default function SharedFieldNotice({ event, fields, sites, teams }: {
  event: Event; fields: Field[]; sites: Site[]; teams: Team[]
}) {
  if (!event.sharedFieldBookings?.length) return null
  return (
    <div className="space-y-1 rounded border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950 break-words">
      <p className="font-semibold">Shared field - full field not exclusively available</p>
      <ul className="space-y-1">
        {event.sharedFieldBookings.map(booking => (
          <li key={`${booking.fieldId}:${booking.eventId}`}>
            {formatSharedFieldBookings([booking], fields, sites, teams)}
          </li>
        ))}
      </ul>
    </div>
  )
}
