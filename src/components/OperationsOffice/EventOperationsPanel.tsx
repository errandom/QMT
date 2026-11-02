import { useEffect, useState } from 'react'
import { operationsApi, gameReadiness, type EventOperations, type OperationsEvent, type ReadinessItem } from '@/lib/operations'
import type { FieldAllocation } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useData } from '@/contexts/DataContext'

const selectClass = 'min-h-12 rounded-md border bg-background px-3 text-base'
const iso = (value: string) => new Date(value).toISOString()
const localInput = (value: string) => value.slice(0, 16)
const fromInput = (value: string) => `${value}:00.000Z`
const defaults = (): ReadinessItem[] => [
  ['Facility', 'Facility allocation and conditions'],
  ['Food / drinks', 'Food, drinks and sales: verify applicable permissions'],
  ['Music', 'Music / amplified sound: verify applicable permissions'],
  ['Equipment', 'Equipment and event operations'],
].map(([category, title]) => ({
  id: crypto.randomUUID(), category: category as ReadinessItem['category'], title,
  status: 'Not started', owner: '', dueDate: '', evidence: '',
}))

export default function EventOperationsPanel({ event, metadata, onSaved }: {
  event: OperationsEvent; metadata?: EventOperations; onSaved: () => Promise<void>
}) {
  const { fields } = useData()
  const [owner, setOwner] = useState(metadata?.owner || '')
  const [checklist, setChecklist] = useState<ReadinessItem[]>(metadata?.checklist || [])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [series, setSeries] = useState<OperationsEvent[]>([])
  const [scope, setScope] = useState<'this' | 'future' | 'all'>('this')
  const [startTime, setStartTime] = useState(event.start_time.slice(11, 16))
  const [endTime, setEndTime] = useState(event.end_time.slice(11, 16))
  const [status, setStatus] = useState(['Confirmed', 'Cancelled'].includes(event.status) ? event.status : 'Planned')
  const [approved, setApproved] = useState(false)
  const eventFields = (event.field_ids || String(event.field_id || '')).split(',').filter(Boolean)
  const [allocations, setAllocations] = useState<FieldAllocation[]>(() => {
    const saved: FieldAllocation[] = event.allocation_json ? JSON.parse(event.allocation_json) : []
    return eventFields.flatMap(fieldId => saved.some(item => item.fieldId === fieldId)
      ? saved.filter(item => item.fieldId === fieldId)
      : [{ fieldId, zones: [], start: iso(event.start_time), end: iso(event.end_time) }])
  })
  useEffect(() => {
    if (!event.series_id) return
    let active = true
    operationsApi.seriesEvents(event.series_id).then(rows => { if (active) setSeries(rows) })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Series could not be loaded') })
    return () => { active = false }
  }, [event.series_id])
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await operation() }
    catch (error) { setError(error instanceof Error ? error.message : 'Event operations were not saved') }
    finally { setBusy(false) }
  }
  const save = async (includeAllocations: boolean) => {
    await operationsApi.saveEvent(event.id, { owner, checklist, expectedRevision: metadata?.revision || 0,
      ...(includeAllocations ? { allocations } : {}) })
    toast.success(includeAllocations ? 'Allocation and readiness saved' : 'Owner and readiness saved')
    await onSaved()
  }
  const updateItem = (id: string, patch: Partial<ReadinessItem>) =>
    setChecklist(current => current.map(item => item.id === id ? { ...item, ...patch } : item))
  const targets = series.filter(item => scope === 'all' || (scope === 'this' ? item.id === event.id : item.start_time >= event.start_time))
  return <section className="space-y-5 rounded-lg border p-4">
    <h3 className="text-lg font-semibold">{event.description || event.event_type} · {event.start_time.slice(0, 10)}</h3>
    <p className="text-sm">Booking: {event.status} · Readiness: {gameReadiness(event, metadata)}. A confirmed booking does not establish permit approval.</p>
    {error && <p role="alert" className="whitespace-pre-wrap text-destructive">{error}</p>}
    <form className="space-y-4" onSubmit={submit => { submit.preventDefault(); void run(() => save(false)) }}>
      <label className="block space-y-1">Responsible owner<Input value={owner} maxLength={255} onChange={input => setOwner(input.target.value)} /></label>
      <fieldset className="space-y-3">
        <legend className="font-medium">Event readiness / approvals</legend>
        <p className="text-sm text-muted-foreground">These are review prompts, not legal determinations. Record requirements for this event with the responsible authority; use “Not required” with a reason where appropriate.</p>
        {!checklist.length && <Button type="button" variant="outline" onClick={() => setChecklist(defaults())}>Start standard readiness review</Button>}
        {checklist.map(item => <fieldset key={item.id} className="grid gap-3 rounded border p-3 sm:grid-cols-2">
          <legend>{item.title}</legend>
          <label>Requirement<Input required maxLength={255} value={item.title} onChange={input => updateItem(item.id, { title: input.target.value })} /></label>
          <label>Category<select className={`${selectClass} w-full`} value={item.category} onChange={input => updateItem(item.id, { category: input.target.value as ReadinessItem['category'] })}>
            {['Facility', 'Food / drinks', 'Music', 'Equipment', 'Other'].map(value => <option key={value}>{value}</option>)}
          </select></label>
          <label>Status<select className={`${selectClass} w-full`} value={item.status} onChange={input => updateItem(item.id, { status: input.target.value as ReadinessItem['status'] })}>
            {['Not started', 'In progress', 'Approved', 'Not required', 'Blocked'].map(value => <option key={value}>{value}</option>)}
          </select></label>
          <label>Owner<Input maxLength={255} value={item.owner} onChange={input => updateItem(item.id, { owner: input.target.value })} /></label>
          <label>Deadline<Input type="date" value={item.dueDate} onChange={input => updateItem(item.id, { dueDate: input.target.value })} /></label>
          <label className="sm:col-span-2">Evidence / reference / reason<Textarea maxLength={2000}
            required={['Approved', 'Not required'].includes(item.status)} value={item.evidence} onChange={input => updateItem(item.id, { evidence: input.target.value })} /></label>
        </fieldset>)}
        <Button type="button" variant="outline" disabled={checklist.length >= 50} onClick={() => setChecklist(current => [...current, {
          id: crypto.randomUUID(), category: 'Other', title: 'Additional requirement', status: 'Not started', owner: '', dueDate: '', evidence: '',
        }])}>Add requirement</Button>
      </fieldset>
      <Button type="submit" disabled={busy}>Save owner and readiness</Button>
    </form>

    {eventFields.length > 0 && <form className="space-y-3" onSubmit={submit => { submit.preventDefault(); void run(() => save(true)) }}>
      <h4 className="font-medium">Time-dependent field allocation</h4>
      <p className="text-sm text-muted-foreground">North and South are the two agreed halves of each field. Whole field blocks both. Cover the entire booking without gaps; split at the time access changes. Agree the physical boundaries with other users.</p>
      {allocations.map((item, index) => <fieldset key={index} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
        <legend>{fields.find(field => field.id === item.fieldId)?.name || `Location ${item.fieldId}`} · segment {index + 1}</legend>
        <label>From<Input type="datetime-local" required value={localInput(item.start)} onChange={input => setAllocations(current => current.map((value, i) => i === index ? { ...value, start: fromInput(input.target.value) } : value))} /></label>
        <label>Until<Input type="datetime-local" required value={localInput(item.end)} onChange={input => setAllocations(current => current.map((value, i) => i === index ? { ...value, end: fromInput(input.target.value) } : value))} /></label>
        <label>Space<select className={`${selectClass} w-full`} value={item.zones.length === 1 ? item.zones[0] : 'whole'}
          onChange={input => setAllocations(current => current.map((value, i) => i === index ? { ...value, zones: input.target.value === 'whole' ? [] : [input.target.value as 'north' | 'south'] } : value))}>
          <option value="whole">Whole location</option>
          {fields.find(field => field.id === item.fieldId)?.locationType !== 'meeting_room' && <><option value="north">North half</option><option value="south">South half</option></>}
        </select></label>
        <Button type="button" variant="outline" onClick={() => setAllocations(current => current.filter((_, i) => i !== index))}>Remove segment from draft</Button>
      </fieldset>)}
      <div className="flex flex-wrap gap-2">{eventFields.map(fieldId => <Button key={fieldId} type="button" variant="outline" onClick={() => setAllocations(current => {
        const segments = current.filter(item => item.fieldId === fieldId).sort((a, b) => a.end.localeCompare(b.end))
        return [...current, { fieldId, zones: [], start: segments.at(-1)?.end || iso(event.start_time), end: iso(event.end_time) }]
      })}>Add segment: {fields.find(field => field.id === fieldId)?.name || fieldId}</Button>)}</div>
      <Button type="submit" disabled={busy}>Validate and save allocation + readiness</Button>
    </form>}

    {event.series_id && <form className="space-y-3" onSubmit={submit => {
      submit.preventDefault()
      void run(async () => {
        await operationsApi.series(event.series_id!, { anchorId: event.id, scope, startTime, endTime, status,
          expected: targets.map(item => ({ id: item.id, updatedAt: iso(item.updated_at) })) })
        toast.success(`${targets.length} series occurrence(s) updated`)
        await onSaved()
      })
    }}>
      <h4 className="font-medium">Change a recurring series</h4>
      <p className="text-sm text-muted-foreground">Existing allocation timelines move with the start time. Duration changes for explicitly allocated events need a complete replacement timeline through an allocation-aware booking update; this series form cannot silently expand shared access.</p>
      <label className="block">Apply to<select className={`${selectClass} w-full`} value={scope} onChange={input => { setScope(input.target.value as typeof scope); setApproved(false) }}>
        <option value="this">This occurrence only</option><option value="future">This and future occurrences</option><option value="all">Entire series, including past occurrences</option>
      </select></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>Start<Input type="time" required value={startTime} onChange={input => { setStartTime(input.target.value); setApproved(false) }} /></label>
        <label>End<Input type="time" required value={endTime} onChange={input => { setEndTime(input.target.value); setApproved(false) }} /></label>
        <label>Status<select className={`${selectClass} w-full`} value={status} onChange={input => { setStatus(input.target.value); setApproved(false) }}>
          <option>Planned</option><option>Confirmed</option><option>Cancelled</option>
        </select></label>
      </div>
      <details><summary className="cursor-pointer">Review {targets.length} affected occurrences</summary>
        <ul className="max-h-48 overflow-auto text-sm">{targets.map(item => <li key={item.id}>{item.start_time.slice(0, 10)} · {item.start_time.slice(11, 16)}–{item.end_time.slice(11, 16)} → {startTime}–{endTime} · {status}</li>)}</ul>
      </details>
      <label className="flex min-h-12 items-center gap-2"><input type="checkbox" required checked={approved} onChange={input => setApproved(input.target.checked)} />I approve changes to these {targets.length} occurrences. Notify affected people separately.</label>
      <Button type="submit" disabled={busy || !targets.length || !approved}>Check conflicts and apply series change</Button>
    </form>}
  </section>
}
