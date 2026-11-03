import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { meetingRoomColumns, meetingRoomRows, meetingRoomTsv, meetingRoomWorksheet } from '@/lib/facilityWorkbook'
import type { FacilityRequest, FacilityWorkflowAction, MeetingRoomDetails } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const detailFields: {
  key: Exclude<keyof MeetingRoomDetails, 'participants' | 'comments'>
  label: string
  maxLength: number
  type?: 'email' | 'url'
  autoComplete?: string
}[] = [
  { key: 'room', label: 'F: Requested room / facility section', maxLength: 255 },
  { key: 'occasion', label: 'J: Occasion / purpose', maxLength: 500 },
  { key: 'club', label: 'K: Club', maxLength: 255, autoComplete: 'organization' },
  { key: 'responsibleName', label: 'M: On-site responsible person', maxLength: 255, autoComplete: 'name' },
  { key: 'responsiblePhone', label: 'M: On-site phone', maxLength: 50, autoComplete: 'tel' },
  { key: 'responsibleEmail', label: 'M: On-site email', maxLength: 254, type: 'email', autoComplete: 'email' },
  { key: 'workbookUrl', label: 'IGACR workbook link', maxLength: 2000, type: 'url' },
]

export default function MeetingRoomWorkbookPanel({ request, busy, onAction }: {
  request: FacilityRequest
  busy: boolean
  onAction: (action: FacilityWorkflowAction) => Promise<FacilityRequest | undefined>
}) {
  const workbook = request.workflow?.workbook
  const entry = workbook?.entry
  const canPrepare = request.status === 'Pending' && request.workflow?.stage === 'In evaluation' && !entry
  const [details, setDetails] = useState<MeetingRoomDetails>(() => workbook?.details || {
    room: '', occasion: request.purpose || request.eventType, club: '', participants: 0,
    responsibleName: '', responsiblePhone: '', responsibleEmail: '', comments: request.description || '', workbookUrl: '',
  })
  const [firstRow, setFirstRow] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [copying, setCopying] = useState(false)
  const unsaved = !workbook || Object.entries(details).some(([key, value]) => value !== workbook.details[key as keyof MeetingRoomDetails])
  const rows = workbook ? meetingRoomRows(request, workbook.details, workbook.dates) : []
  const tsv = meetingRoomTsv(rows)

  useEffect(() => {
    if (workbook?.details.workbookUrl) return
    let active = true
    api.getMeetingRoomWorkbookTarget().then(target => {
      const url = target.url
      if (active && url) setDetails(current => current.workbookUrl ? current : { ...current, workbookUrl: url })
    }).catch(failure => {
      if (active) setError(`${failure instanceof Error ? failure.message : 'Default workbook link could not be loaded'}. Paste the workbook link below.`)
    })
    return () => { active = false }
  }, [workbook?.details.workbookUrl])

  const copy = async () => {
    if (copying || busy || !workbook || unsaved || entry) return
    setCopying(true)
    setError('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable')
      await navigator.clipboard.writeText(tsv)
      toast.success(`${rows.length} Excel row(s) copied. Workbook entry is still manual.`)
    } catch (failure) {
      const message = `${failure instanceof Error ? failure.message : 'Excel rows could not be copied'}. Select and copy the prepared rows below.`
      setError(message)
      toast.error(message)
    } finally { setCopying(false) }
  }
  const save = async () => {
    setError('')
    const saved = await onAction({ action: 'prepare-workbook', details })
    if (saved?.workflow?.workbook) {
      setDetails(saved.workflow.workbook.details)
      setConfirmed(false)
    }
  }
  return <section className="min-w-0 space-y-3 rounded-md border p-3">
    <h4 className="font-semibold">Assisted meeting-room submission</h4>
    <p className="text-sm"><strong>Worksheet:</strong> {meetingRoomWorksheet}. Only columns F–N are prepared. QMT does not write to SharePoint.</p>
    <p role="status" className="text-sm">{entry
      ? `Entered - manually confirmed by ${entry.by} on ${new Date(entry.at).toLocaleString()}; F${entry.firstRow}:N${entry.lastRow}. Not independently verified; not an approval.`
      : workbook ? 'Prepared - awaiting workbook entry by an authorised editor.' : 'Save routing and start evaluation, then prepare the workbook rows.'}</p>
    {error && <p role="alert" className="whitespace-pre-wrap text-destructive">{error}</p>}
    <form onSubmit={event => { event.preventDefault(); void save() }}>
      <fieldset disabled={busy || copying || !canPrepare} className="space-y-3">
        <legend className="mb-2 font-medium">Workbook details</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {detailFields.map(field => <div key={field.key} className="space-y-1">
            <Label htmlFor={`${field.key}-${request.id}`}>{field.label} *</Label>
            <Input id={`${field.key}-${request.id}`} name={field.key} required type={field.type || 'text'}
              autoComplete={field.autoComplete} value={details[field.key]} maxLength={field.maxLength}
              onChange={event => { setDetails({ ...details, [field.key]: event.target.value }); setConfirmed(false) }} />
          </div>)}
          <div className="space-y-1">
            <Label htmlFor={`participants-${request.id}`}>L: Number of participants *</Label>
            <Input id={`participants-${request.id}`} name="participants" required type="number" min={1} max={100000} step={1}
              value={details.participants || ''} onChange={event => { setDetails({ ...details, participants: Number(event.target.value) }); setConfirmed(false) }} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">The on-site contact must be the actual responsible person, not automatically the requester or ZVIS contact. G, H and I are calculated from every requested date and time.</p>
        <div className="space-y-1">
          <Label htmlFor={`workbook-comments-${request.id}`}>N: Club comments / alternative dates (optional)</Label>
          <Textarea id={`workbook-comments-${request.id}`} name="comments" value={details.comments} maxLength={1000}
            onChange={event => { setDetails({ ...details, comments: event.target.value }); setConfirmed(false) }} />
        </div>
        {canPrepare && <Button type="submit" variant="outline">Save workbook details &amp; prepare rows</Button>}
      </fieldset>
    </form>
    {workbook && <>
      {unsaved && <p role="status">Workbook edits are not saved. Save before copying or confirming entry.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="mb-2 text-left">Saved preview: {rows.length} row(s), in requested-date order. Headers are not copied.</caption>
          <thead><tr>{meetingRoomColumns.map(label => <th key={label} scope="col" className="border p-2">{label}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={workbook.dates[index]}>{row.map((value, column) =>
            <td key={column} className="border p-2 whitespace-pre-wrap">{value}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy || copying || unsaved || Boolean(entry) || !canPrepare} onClick={copy}>
          {copying ? 'Copying...' : rows.length === 1 ? 'Copy Excel row' : 'Copy Excel rows'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={workbook.details.workbookUrl} target="_blank" rel="noopener noreferrer">Open workbook</a>
        </Button>
      </div>
      {!entry && <>
        <p className="text-xs text-muted-foreground">Select F of the first genuinely empty row, paste all rows, and check F–N and saving before confirming. Do not overwrite another club's entries. Copying does not submit anything. If you cannot edit, hand these rows to an authorised IGACR editor and wait for their confirmation.</p>
        <details>
          <summary className="cursor-pointer text-sm">Prepared rows for manual copy / hand-off</summary>
          <Label htmlFor={`workbook-tsv-${request.id}`} className="mt-2">Tab-separated rows (no headers)</Label>
          <Textarea id={`workbook-tsv-${request.id}`} readOnly value={tsv} rows={Math.min(rows.length + 1, 8)} className="mt-1 font-mono text-xs" />
        </details>
        {canPrepare && <form className="space-y-3 border-t pt-3" onSubmit={event => {
          event.preventDefault()
          if (!confirmed || unsaved || busy) return
          void onAction({ action: 'enter-workbook', firstRow: Number(firstRow), confirmed: true })
        }}>
          <fieldset disabled={busy || copying || unsaved} className="space-y-3">
            <legend className="mb-2 font-medium">Confirm actual workbook entry</legend>
            <Label htmlFor={`first-row-${request.id}`}>First worksheet row containing this request *</Label>
            <Input id={`first-row-${request.id}`} name="firstRow" required type="number" min={3} max={1048576 - rows.length + 1} step={1}
              value={firstRow} onChange={event => { setFirstRow(event.target.value); setConfirmed(false) }} />
            <label className="flex min-h-12 items-center gap-2">
              <input name="confirmed" type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
              I or an authorised editor entered and checked all {rows.length} saved row(s), in this order, and confirmed they were saved.
            </label>
            <Button type="submit">Record entered - manually confirmed</Button>
          </fieldset>
        </form>}
      </>}
    </>}
  </section>
}
