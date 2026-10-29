import type { Event, Field, Site, Team } from '@/lib/types'
import type { PublishedScheduleState } from '@/hooks/usePublishedSchedules'
import { comparePublishedBooking } from '@/lib/publishedSchedule'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PublishedBookingCheckProps {
  event: Event
  site: Site
  fields: Field[]
  teams: Team[]
  state?: PublishedScheduleState
  onCheck: () => void
}

const labels = {
  matched: 'Published slot matches',
  deviation: 'Possible change',
  ambiguous: 'Ambiguous allocation',
  not_found: 'Booking not found',
  needs_review: 'Manual review needed',
} as const

export default function PublishedBookingCheck({ event, site, fields, teams, state, onCheck }: PublishedBookingCheckProps) {
  const comparison = state?.data ? comparePublishedBooking(event, site, fields, teams, state.data) : undefined
  const expected = fields.filter(field => field.siteId === site.id && event.fieldIds.includes(field.id))
  const source = state?.data && state.data.configuredSourceUrl === site.publishedScheduleUrl
    ? state.data.sourceUrl : site.publishedScheduleUrl
  return (
    <div className="space-y-2 rounded-md border p-3 text-xs" aria-busy={state?.loading || false}>
      <p className="font-medium">Published booking: {site.name}</p>
      <p className="text-muted-foreground">QMT pitch: {expected.map(field => field.name).join(', ')}</p>
      <div role="status" aria-live="polite" className="space-y-1">
        {state?.loading ? <p>Checking published plan...</p> : state?.error ? (
          <p className="text-destructive">Check unavailable: {state.error}. This does not confirm or cancel the booking.</p>
        ) : comparison ? (
          <>
            <Badge variant={comparison.status === 'matched' ? 'secondary' : 'outline'}>
              {labels[comparison.status]}
            </Badge>
            <p>{comparison.message}</p>
            {comparison.bookings.slice(0, 5).map((booking, index) => (
              <p key={index} className="text-muted-foreground">
                {booking.startTime} - {booking.endTime} | {booking.field} {booking.area} | {booking.team} | {booking.kind}
                {booking.information && <> | {booking.information}</>}
              </p>
            ))}
            {comparison.bookings.length > 5 && <p>More entries are available in the published source.</p>}
          </>
        ) : <p>Not checked yet.</p>}
      </div>
      {state?.data?.checkedAt && !state.loading && !state.error && (
        <p className="text-muted-foreground">
          {state.data.status === 'available' ? 'Source checked' : 'Last check attempt'}{' '}
          <time dateTime={state.data.checkedAt}>{new Date(state.data.checkedAt).toLocaleString()}</time>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" className="h-auto min-h-8 whitespace-normal text-xs"
          disabled={state?.loading} onClick={onCheck}>
          {state?.loading ? 'Checking...' : state?.data || state?.error ? 'Check again' : 'Check published booking'}
        </Button>
        {source && <a href={source} target="_blank" rel="noopener noreferrer" className="text-primary underline">Open published source</a>}
      </div>
    </div>
  )
}
