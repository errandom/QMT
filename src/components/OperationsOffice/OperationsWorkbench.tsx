import { useCallback, useEffect, useMemo, useState } from 'react'
import { operationsApi, gameReadiness, requestNextAction, type ExternalAllocation, type OperationsState } from '@/lib/operations'
import type { FieldAllocation } from '@/lib/types'
import { needsFacilityAttention } from '@/lib/facilityWorkflow'
import { useData } from '@/contexts/DataContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import EventOperationsPanel from './EventOperationsPanel'

const selectClass = 'min-h-12 w-full rounded-md border bg-background px-3 text-base'
const todayInZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date())

export default function OperationsWorkbench({ onRequests }: { onRequests: () => void }) {
  const { facilityRequests, equipmentRequests, cancellationRequests, refreshData, refreshRequests } = useData()
  const [data, setData] = useState<OperationsState>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [eventId, setEventId] = useState('')
  const [externalId, setExternalId] = useState('')
  const [externalOpen, setExternalOpen] = useState(false)
  const today = todayInZurich()
  const load = useCallback(async () => {
    setBusy(true); setError('')
    try { setData(await operationsApi.state()); await refreshRequests() }
    catch (error) { setError(error instanceof Error ? error.message : 'Operations could not be loaded') }
    finally { setBusy(false) }
  }, [refreshRequests])
  useEffect(() => { void load() }, [load])
  const saved = async () => { await load(); await refreshData() }
  const queue = useMemo(() => {
    const requests = facilityRequests.filter(needsFacilityAttention).map(request => ({
      id: `request-${request.id}`, title: `${request.eventType}: ${request.requestorName}`,
      owner: request.workflow?.owner || '', due: request.workflow?.followUpDate || '',
      action: requestNextAction(request), dependency: request.workflow?.stage === 'Awaiting response'
        ? request.workflow.department || request.workflow.route || 'External response' : '',
      eventId: '', urgent: ['Received', 'Response received', 'Approved', 'Rejected'].includes(request.workflow?.stage || 'Received'),
    }))
    const games = (data?.events || []).filter(event => event.event_type === 'Game' && !['Cancelled', 'Completed'].includes(event.status)).flatMap(event => {
      const metadata = data?.metadata.find(item => item.eventId === String(event.id))
      const state = gameReadiness(event, metadata)
      const unfinished = metadata?.checklist.filter(item => !['Approved', 'Not required'].includes(item.status)) || []
      if (state === 'Ready') return []
      if (unfinished.length) return unfinished.map(item => ({
        id: `permit-${item.id}`, title: `${event.description}: ${item.title}`, owner: item.owner || metadata?.owner || '',
        due: item.dueDate || event.start_time.slice(0, 10), action: item.status === 'Blocked' ? 'Resolve blocked requirement' : 'Complete readiness requirement',
        dependency: item.category, eventId: String(event.id), urgent: item.status === 'Blocked',
      }))
      return [{ id: `event-${event.id}`, title: event.description || 'Game', owner: metadata?.owner || '',
        due: event.start_time.slice(0, 10), action: state === 'Location needed' ? 'Allocate a location' : 'Start game readiness review',
        dependency: state, eventId: String(event.id), urgent: false }]
    })
    const otherRequests = [
      ...equipmentRequests.filter(item => item.status === 'Pending').map(item => ({ id: `equipment-${item.id}`, title: `Equipment: ${item.requestorName}`, due: item.date, action: 'Review equipment request' })),
      ...cancellationRequests.filter(item => item.status === 'Pending').map(item => ({ id: `cancel-${item.id}`, title: `Cancellation: ${item.eventTitle}`, due: item.eventDate, action: 'Review cancellation request' })),
    ].map(item => ({ ...item, owner: '', dependency: '', eventId: '', urgent: true }))
    return [...requests, ...games, ...otherRequests].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
  }, [facilityRequests, equipmentRequests, cancellationRequests, data])
  const visible = queue.filter(item =>
    (!ownerFilter || item.owner.toLowerCase().includes(ownerFilter.toLowerCase())) &&
    (filter === 'all' || (filter === 'today' ? (item.due ? item.due <= today : item.urgent) :
      filter === 'overdue' ? Boolean(item.due && item.due < today) : !item.owner)))
  const selectedEvent = data?.events.find(event => String(event.id) === eventId)
  const metadata = data?.metadata.find(item => item.eventId === eventId)
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Operations actions</h2>
      <Button variant="outline" disabled={busy} onClick={() => void load()}>Refresh queue</Button>
    </div>
    <p className="text-sm text-muted-foreground">Request follow-ups and game readiness for {data?.from || today} to {data?.to || 'one year ahead'}. Reminders are shown here; no emails are sent automatically.</p>
    {error && <p role="alert" className="text-destructive">{error} Previously loaded information may be stale.</p>}
    {busy && <p role="status">Loading operations…</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Queue view<select className={selectClass} value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="all">All outstanding work</option><option value="today">Today / due now</option>
        <option value="overdue">Overdue</option><option value="unassigned">Unassigned</option>
      </select></label>
      <label>Filter by owner<Input value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)} /></label>
    </div>
    <div className="space-y-2" aria-live="polite">
      {!visible.length && data && !error && <p>No outstanding work matches this view.</p>}
      {visible.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-medium break-words">{item.title}</h3>
          <p className="text-sm">{item.action} · Owner: {item.owner || 'Unassigned'} · Due: {item.due || 'Not set'}</p>
          {item.dependency && <p className="text-sm text-muted-foreground">Dependency: {item.dependency}</p>}
          {item.due && item.due < today && <Badge variant="destructive">Overdue</Badge>}
        </div>
        <Button size="sm" onClick={() => item.eventId ? setEventId(item.eventId) : onRequests()}>{item.eventId ? 'Open readiness' : 'Open requests / workflow'}</Button>
      </article>)}
    </div>
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Event readiness, spatial allocation and series changes</h3>
      <label className="block">Select event<select className={selectClass} value={eventId} onChange={event => setEventId(event.target.value)}>
        <option value="">Choose an upcoming event</option>
        {data?.events.map(event => <option key={event.id} value={event.id}>{event.start_time.slice(0, 10)} {event.start_time.slice(11, 16)} · {event.description || event.event_type}{event.series_id ? ' · Series' : ''}</option>)}
      </select></label>
      {selectedEvent && <EventOperationsPanel key={`${eventId}-${selectedEvent.updated_at}-${metadata?.revision || 0}`} event={selectedEvent} metadata={metadata} onSaved={saved} />}
    </section>
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">External users / allocation blocks</h3>
        <Button variant="outline" onClick={() => { setExternalId(''); setExternalOpen(true) }}>Add external allocation</Button>
      </div>
      <p className="text-sm text-muted-foreground">Record other clubs and time-limited field access here. Whole-location blocks conflict with every zone; disjoint halves can coexist.</p>
      {data?.external.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
        <p>{item.participant} · {item.start_time.slice(0, 10)} {item.start_time.slice(11, 16)}–{item.end_time.slice(11, 16)} · {JSON.parse(item.zones).join(' + ') || 'Whole location'}</p>
        <Button size="sm" variant="outline" onClick={() => { setExternalId(item.id); setExternalOpen(true) }}>Edit allocation</Button>
      </article>)}
      {externalOpen && <ExternalAllocationForm key={externalId || 'new'} item={data?.external.find(item => item.id === externalId)}
        onSaved={async () => { setExternalOpen(false); await saved() }} onClose={() => setExternalOpen(false)} />}
    </section>
  </div>
}

function ExternalAllocationForm({ item, onSaved, onClose }: {
  item?: ExternalAllocation; onSaved: () => Promise<void>; onClose: () => void
}) {
  const { fields } = useData()
  const [id] = useState(item?.id || crypto.randomUUID())
  const [fieldId, setFieldId] = useState(String(item?.field_id || ''))
  const [participant, setParticipant] = useState(item?.participant || '')
  const [start, setStart] = useState(item?.start_time.slice(0, 16) || '')
  const [end, setEnd] = useState(item?.end_time.slice(0, 16) || '')
  const [zone, setZone] = useState(item && JSON.parse(item.zones).length === 1 ? JSON.parse(item.zones)[0] as string : 'whole')
  const [active, setActive] = useState(true)
  const [allowConflicts, setAllowConflicts] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="space-y-3 rounded-lg border p-4" onSubmit={event => {
    event.preventDefault(); setBusy(true); setError('')
    void operationsApi.saveExternal(id, { fieldId, participant, start: `${start}:00.000Z`, end: `${end}:00.000Z`,
      zones: (zone === 'whole' ? [] : [zone]) as FieldAllocation['zones'], active,
      expectedRevision: item?.revision || 0, allowConflicts })
      .then(async () => { toast.success(active ? 'External allocation saved' : 'External allocation retired'); await onSaved() })
      .catch(error => setError(error instanceof Error ? error.message : 'Allocation was not saved'))
      .finally(() => setBusy(false))
  }}>
    <h4 className="font-medium">{item ? 'Edit' : 'New'} external allocation</h4>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <label className="block">External user / club<Input required maxLength={255} value={participant} onChange={event => setParticipant(event.target.value)} /></label>
    <label className="block">Location<select required className={selectClass} value={fieldId} onChange={event => { setFieldId(event.target.value); setZone('whole'); setAllowConflicts(false) }}>
      <option value="">Select a location</option>{fields.filter(field => field.isActive).map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Start<Input required type="datetime-local" value={start} onChange={event => { setStart(event.target.value); setAllowConflicts(false) }} /></label>
      <label>End<Input required type="datetime-local" value={end} onChange={event => { setEnd(event.target.value); setAllowConflicts(false) }} /></label>
    </div>
    <label className="block">Space<select className={selectClass} value={zone} onChange={event => { setZone(event.target.value); setAllowConflicts(false) }}>
      <option value="whole">Whole location</option>{fields.find(field => field.id === fieldId)?.locationType !== 'meeting_room' && <><option value="north">North half</option><option value="south">South half</option></>}
    </select></label>
    <label className="flex min-h-12 items-center gap-2"><input type="checkbox" checked={allowConflicts} onChange={event => setAllowConflicts(event.target.checked)} />I explicitly accept overlapping use of this space and time with existing bookings.</label>
    {item && <label className="flex min-h-12 items-center gap-2"><input type="checkbox" checked={!active} onChange={event => setActive(!event.target.checked)} />Retire this external allocation (keep its record)</label>}
    <div className="flex gap-2"><Button type="submit" disabled={busy}>Validate and save allocation</Button><Button type="button" variant="outline" onClick={onClose}>Cancel</Button></div>
  </form>
}
