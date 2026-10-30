import { useState } from 'react'
import { ClipboardText } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useData } from '@/contexts/DataContext'
import { api } from '@/lib/api'
import { facilityMessage, facilityStage } from '@/lib/facilityWorkflow'
import type { CommunicationChannel, FacilityRequest, FacilityRouting, FacilityWorkflowAction } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { OperationsCardHeader, OperationsCardSection } from './OperationsCards'

const actionLabels = {
  configure: 'Routing saved', acknowledge: 'Receipt acknowledged', evaluate: 'Evaluation started',
  send: 'External inquiry sent', response: 'External response recorded', internal: 'Internal review recorded',
  note: 'Note added', notify: 'Requester notified', Approved: 'Approved', Rejected: 'Rejected',
}
const selectClass = 'min-h-12 w-full rounded-md border bg-background px-3 text-base'

function routingFor(request: FacilityRequest): FacilityRouting {
  const workflow = request.workflow
  return {
    locationType: workflow?.locationType || request.locationType || 'field',
    route: workflow?.route || 'City of Zurich',
    department: workflow?.department || '',
    contactEmail: workflow?.contactEmail || '',
    reference: workflow?.reference || '',
    followUpDate: workflow?.followUpDate || '',
    permitNotes: workflow?.permitNotes || '',
  }
}

interface FacilityRequestCardProps {
  request: FacilityRequest
  onApprove: (request: FacilityRequest) => void
  onReject: (request: FacilityRequest) => void
}

export default function FacilityRequestCard({ request, onApprove, onReject }: FacilityRequestCardProps) {
  const { teams, fields, sites } = useData()
  const [open, setOpen] = useState(false)
  const stage = facilityStage(request)
  const pendingNotification = request.status !== 'Pending' && !request.workflow?.outcomeNotifiedAt
  const kind = request.workflow?.locationType || request.locationType
  return (
    <Card>
      <OperationsCardHeader title={`${request.eventType} Request`}
        icon={<ClipboardText size={18} weight="duotone" />}
        badges={<>
          <Badge variant={request.status === 'Rejected' ? 'destructive' : 'secondary'}>{stage}</Badge>
          <Badge variant="outline">{kind === 'field' ? 'Field' : kind === 'meeting_room' ? 'Meeting room' : 'Facility type needed'}</Badge>
          {pendingNotification && <Badge variant="outline">Notify requester</Badge>}
        </>}
        actions={<Button size="sm" onClick={() => setOpen(true)}>Open workflow</Button>} />
      <CardContent className="flex flex-1 flex-col gap-2 text-sm">
        <OperationsCardSection name="metadata" className="grid gap-2 sm:grid-cols-2">
          <div><span className="text-muted-foreground">Requester:</span> {request.requestorName}</div>
          <div>{request.date} at {request.startTime} ({request.duration} min)</div>
          <div className="break-all">{request.requestorPhone}{request.requestorEmail && ` / ${request.requestorEmail}`}</div>
          <div>{request.teamIds?.map(id => teams.find(team => team.id === id)?.name || `Team ${id}`).join(', ') || request.purpose}</div>
        </OperationsCardSection>
        <OperationsCardSection name="description" className="whitespace-pre-wrap break-words">
          {request.description}
        </OperationsCardSection>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          <span>Route: {request.workflow?.route || 'Not assigned'}{request.workflow?.department && ` / ${request.workflow.department}`}</span>
          {request.workflow?.followUpDate && request.status === 'Pending' && <span>Follow up: {request.workflow.followUpDate}</span>}
          {request.workflow?.outcomeNotifiedAt && <span>Requester notified {new Date(request.workflow.outcomeNotifiedAt).toLocaleString()}</span>}
        </div>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="operations-dialog max-h-[85dvh] overflow-y-auto text-foreground sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Facility request #{request.id}</DialogTitle>
            <DialogDescription className="pr-5 [overflow-wrap:anywhere]">{request.requestorName} · {request.eventType} · {request.date} at {request.startTime} ({request.duration} min)</DialogDescription>
          </DialogHeader>
          {open && <FacilityWorkflowPanel request={request} teams={teams} fields={fields} sites={sites}
            onReload={() => setOpen(false)}
            onApprove={() => { setOpen(false); onApprove(request) }}
            onReject={() => { setOpen(false); onReject(request) }} />}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function FacilityWorkflowPanel({ request, teams, fields, sites, onApprove, onReject, onReload }: {
  request: FacilityRequest
  teams: ReturnType<typeof useData>['teams']
  fields: ReturnType<typeof useData>['fields']
  sites: ReturnType<typeof useData>['sites']
  onApprove: () => void
  onReject: () => void
  onReload: () => void
}) {
  const { setFacilityRequests, refreshRequests } = useData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const stage = facilityStage(request)
  const workflow = request.workflow
  const [routing, setRouting] = useState(() => routingFor(request))
  const unsavedRouting = Boolean(workflow?.route && Object.entries(routing)
    .some(([key, value]) => value !== workflow[key as keyof FacilityRouting]))
  const [note, setNote] = useState('')
  const [response, setResponse] = useState('')
  const communication = stage === 'Received' ? 'acknowledge' :
    stage === 'In evaluation' && workflow?.route !== 'Internal' ? 'send' :
      request.status !== 'Pending' && !workflow?.outcomeNotifiedAt ? 'notify' : undefined
  const initialChannel: CommunicationChannel = communication === 'send' ? 'Email' : 'WhatsApp'
  const update = async (action: FacilityWorkflowAction) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const saved = await api.updateFacilityWorkflow(request.id, action, workflow?.version || 0)
      setFacilityRequests(current => current.map(item => item.id === saved.id ? saved : item))
      if (action.action === 'configure') setRouting(routingFor(saved))
      toast.success(actionLabels[action.action])
      if (action.action === 'note') setNote('')
      if (action.action === 'response' || action.action === 'internal') setResponse('')
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Workflow action was not saved'
      setError(message)
      toast.error(message)
    } finally { setBusy(false) }
  }
  const reload = async () => {
    setBusy(true)
    try { await refreshRequests(); setError(''); onReload(); toast.success('Requests reloaded; reopen the workflow to continue') }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Requests could not be reloaded') }
    finally { setBusy(false) }
  }
  const latestResponse = workflow?.history.slice().reverse().find(entry => entry.action === 'response' || entry.action === 'internal')
  const showRouting = request.status === 'Pending'
  return (
    <div className="min-w-0 space-y-4 text-sm [&_[data-slot=label]]:text-foreground">
      <ol aria-label="Facility request workflow" className="flex flex-wrap gap-2 text-xs">
        {['Received', 'Acknowledged', 'In evaluation', 'Awaiting response', 'Response received', 'Decision', 'Requester notified'].map(label => {
          const current = label === stage || (label === 'Decision' && request.status !== 'Pending' && !workflow?.outcomeNotifiedAt) ||
            (label === 'Requester notified' && Boolean(workflow?.outcomeNotifiedAt))
          return <li key={label} aria-current={current ? 'step' : undefined}
            className={`rounded border px-2 py-1 ${current ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{label}</li>
        })}
      </ol>
      <div className="rounded-md bg-muted p-3 whitespace-pre-wrap break-words">
        {request.purpose && <p><strong>Purpose:</strong> {request.purpose}</p>}
        {request.description && <p>{request.description}</p>}
        {request.opponent && <p><strong>Opponent:</strong> {request.opponent}</p>}
        <p><strong>Contact:</strong> {request.requestorPhone}{request.requestorEmail && ` / ${request.requestorEmail}`}</p>
      </div>
      {request.eventType === 'Game' && <div className="rounded-md border border-amber-500 p-3">
        <strong>Separate game approvals to review</strong>
        <p>Goods, drinks, food, music and other conditions may need separate review. This workflow does not grant those permits. Record considerations in the routing notes; the detailed permit workflow is not implemented yet.</p>
      </div>}
      {error && <div role="alert" className="space-y-2 rounded border border-destructive p-3 text-destructive">
        <p>{error}</p><Button variant="outline" disabled={busy} onClick={reload}>Reload requests</Button>
      </div>}
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="mb-2 text-base font-semibold">Current stage: {stage}</legend>
        {stage === 'Acknowledged' && <>
          <p>Receipt is acknowledged. Start evaluation to clarify scope, choose the responsible route and prepare the allocation inquiry.</p>
          <Button onClick={() => update({ action: 'evaluate' })}>Start evaluation</Button>
        </>}
        {showRouting && <details key={stage} open={stage === 'In evaluation'} className="rounded-md border p-3">
          <summary className="cursor-pointer font-medium">Routing and review notes{workflow?.route ? ` · ${workflow.route}` : ' · not assigned'}</summary>
          <form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); void update({ action: 'configure', ...routing }) }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`kind-${request.id}`}>Facility workflow</Label>
                <select id={`kind-${request.id}`} value={routing.locationType} className={selectClass}
                  onChange={event => setRouting({ ...routing, locationType: event.target.value as FacilityRouting['locationType'] })}>
                  <option value="field">Field allocation</option><option value="meeting_room">Meeting-room allocation</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`route-${request.id}`}>Review route</Label>
                <select id={`route-${request.id}`} value={routing.route} className={selectClass}
                  onChange={event => setRouting({ ...routing, route: event.target.value as FacilityRouting['route'] })}>
                  <option>City of Zurich</option><option>ZVIS</option><option>Other</option><option>Internal</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`department-${request.id}`}>Responsible department / contact</Label>
                <Input id={`department-${request.id}`} value={routing.department} maxLength={255}
                  onChange={event => setRouting({ ...routing, department: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`email-${request.id}`}>Department email (optional)</Label>
                <Input id={`email-${request.id}`} type="email" value={routing.contactEmail} maxLength={254}
                  onChange={event => setRouting({ ...routing, contactEmail: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`reference-${request.id}`}>External reference (optional)</Label>
                <Input id={`reference-${request.id}`} value={routing.reference} maxLength={255}
                  onChange={event => setRouting({ ...routing, reference: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`followup-${request.id}`}>Follow-up date (optional)</Label>
                <Input id={`followup-${request.id}`} type="date" value={routing.followUpDate}
                  onChange={event => setRouting({ ...routing, followUpDate: event.target.value })} />
              </div>
            </div>
            {request.eventType === 'Game' && <div className="space-y-1">
              <Label htmlFor={`permits-${request.id}`}>Game permit considerations (not an approval)</Label>
              <Textarea id={`permits-${request.id}`} value={routing.permitNotes} maxLength={1000}
                onChange={event => setRouting({ ...routing, permitNotes: event.target.value })} />
            </div>}
            <p className="text-xs text-muted-foreground">No department or email address is assumed. Use Internal only when no external allocation decision is needed, and record why. Changing the facility type or responsible contact after an inquiry returns the request to evaluation.</p>
            <Button type="submit" variant="outline">Save routing</Button>
          </form>
        </details>}
        {stage === 'In evaluation' && !workflow?.route && <p>Save the responsible route before recording an external inquiry or internal review.</p>}
        {unsavedRouting && <p role="status">Routing edits are not saved. Save routing before advancing the request.</p>}
        {communication && (communication !== 'send' || Boolean(workflow?.route)) && <fieldset disabled={unsavedRouting} className="min-w-0">
          <CommunicationForm
          key={`${communication}-${workflow?.locationType}-${workflow?.route}-${workflow?.department}-${workflow?.contactEmail}-${workflow?.reference}`}
          action={communication} request={request} initialChannel={initialChannel}
          initialMessage={facilityMessage(request, communication, teams, fields, sites)}
          onRecord={(channel, message) => update({ action: communication, channel, message })} />
        </fieldset>}
        {stage === 'Awaiting response' && <div className="space-y-2 rounded-md border p-3">
          <p><strong>Waiting for:</strong> {workflow?.route} / {workflow?.department}</p>
          {workflow?.reference && <p>Reference: {workflow.reference}</p>}
          {workflow?.followUpDate && <p>Follow up: {workflow.followUpDate}</p>}
          <p>Record the actual response and any conditions before making a decision.</p>
        </div>}
        {!unsavedRouting && (stage === 'Awaiting response' || (stage === 'In evaluation' && workflow?.route === 'Internal')) && <form
          className="space-y-2" onSubmit={event => {
            event.preventDefault()
            void update({ action: stage === 'Awaiting response' ? 'response' : 'internal', message: response })
          }}>
          <Label htmlFor={`response-${request.id}`}>{stage === 'Awaiting response' ? 'Response / conditions received *' : 'Internal review / why no external decision is needed *'}</Label>
          <Textarea id={`response-${request.id}`} required maxLength={4000} value={response}
            onChange={event => setResponse(event.target.value)} rows={4} />
          <Button type="submit">{stage === 'Awaiting response' ? 'Record response received' : 'Complete internal review'}</Button>
        </form>}
        {stage === 'Response received' && <div className="space-y-3 rounded-md border p-3">
          <strong>Ready for a decision</strong>
          <p className="whitespace-pre-wrap break-words">{latestResponse?.message}</p>
          {workflow?.permitNotes && <p className="whitespace-pre-wrap break-words">Game considerations: {workflow.permitNotes}</p>}
          <p>Check the approved scope, slot, location and conditions. Approval creates one booking on {request.date}; multi-day requests need separate bookings for the remaining dates.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={unsavedRouting} onClick={onApprove}>Review approval &amp; booking</Button>
            <Button variant="outline" onClick={() => update({ action: 'evaluate' })}>Continue evaluation</Button>
          </div>
        </div>}
        {request.status !== 'Pending' && <div className="space-y-1">
          <p><strong>Decision:</strong> {request.status}{request.reviewedBy && ` by ${request.reviewedBy}`}</p>
          {workflow?.decisionNote && <p className="whitespace-pre-wrap break-words">{workflow.decisionNote}</p>}
          {workflow?.outcomeNotifiedAt && <p>Requester notification recorded {new Date(workflow.outcomeNotifiedAt).toLocaleString()}.</p>}
          {!workflow && <p className="text-muted-foreground">Historical decision: no communication history is recorded. You can record an outcome notification now.</p>}
        </div>}
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer font-medium">Add an internal note / follow-up</summary>
          <form className="mt-3 space-y-2" onSubmit={event => { event.preventDefault(); void update({ action: 'note', message: note }) }}>
            <Label htmlFor={`note-${request.id}`}>Internal note *</Label>
            <Textarea id={`note-${request.id}`} required maxLength={4000} value={note} onChange={event => setNote(event.target.value)} />
            <Button type="submit" variant="outline">Save note</Button>
          </form>
        </details>
        {request.status === 'Pending' && <Button variant="destructive" onClick={onReject}>Reject request with reason</Button>}
      </fieldset>
      <details className="rounded-md border p-3">
        <summary className="cursor-pointer font-medium">Activity log ({workflow?.history.length || 0})</summary>
        <ol className="mt-3 space-y-3">
          <li className="text-xs text-muted-foreground">Submitted {new Date(request.createdAt).toLocaleString()}</li>
          {workflow?.history.map((entry, index) => <li key={index} className="border-t pt-2">
            <div className="font-medium">{actionLabels[entry.action]}{entry.channel && ` · ${entry.channel}`}</div>
            <div className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString()} · {entry.by}</div>
            {entry.message && <p className="mt-1 whitespace-pre-wrap break-words">{entry.message}</p>}
          </li>)}
        </ol>
      </details>
    </div>
  )
}

function CommunicationForm({ action, request, initialChannel, initialMessage, onRecord }: {
  action: 'acknowledge' | 'send' | 'notify'
  request: FacilityRequest
  initialChannel: CommunicationChannel
  initialMessage: string
  onRecord: (channel: CommunicationChannel, message: string) => Promise<void>
}) {
  const [message, setMessage] = useState(initialMessage)
  const [channel, setChannel] = useState(initialChannel)
  const recipient = action === 'send' ? request.workflow?.contactEmail : request.requestorEmail
  const phone = request.requestorPhone.replace(/\D/g, '')
  const mailto = `mailto:${recipient || ''}?subject=${encodeURIComponent(`Facility request #${request.id} - ${request.eventType}, ${request.date}`)}&body=${encodeURIComponent(message)}`
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); toast.success('Draft copied; sending is still manual') }
    catch { toast.error('Could not copy the draft. Select and copy the message manually.') }
  }
  return (
    <form className="space-y-3 rounded-md border p-3" onSubmit={event => {
      event.preventDefault()
      void onRecord(channel, message)
    }}>
      <h4 className="font-semibold">{action === 'acknowledge' ? 'Acknowledge receipt' : action === 'send' ? 'Engage the responsible department' : 'Notify requester of the outcome'}</h4>
      <p className="text-xs text-muted-foreground">Sending is manual. Opening or copying a draft does not mark it sent. Send it through your chosen channel, then record it below.</p>
      <div className="space-y-1">
        <Label htmlFor={`channel-${request.id}`}>Communication channel</Label>
        <select id={`channel-${request.id}`} className={selectClass} value={channel}
          onChange={event => setChannel(event.target.value as CommunicationChannel)}>
          <option>Email</option><option>WhatsApp</option><option>Phone</option><option>Other</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`message-${request.id}`}>{channel === 'Phone' ? 'Conversation summary *' : 'Message draft / message sent *'}</Label>
        <Textarea id={`message-${request.id}`} value={message} onChange={event => setMessage(event.target.value)} required maxLength={16000} rows={7} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={copy}>Copy draft</Button>
        {channel === 'Email' && <Button type="button" variant="outline" asChild><a href={mailto}>Open email draft</a></Button>}
        {channel === 'WhatsApp' && action !== 'send' && phone && <Button type="button" variant="outline" asChild>
          <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}>Open WhatsApp draft</a>
        </Button>}
      </div>
      {action === 'send' && <p className="text-xs text-muted-foreground">Recipient: {request.workflow?.department}{recipient ? ` / ${recipient}` : ' — email not recorded; choose the recipient manually.'}</p>}
      <Button type="submit">{action === 'acknowledge' ? 'Record acknowledgment sent' : action === 'send' ? 'Record external inquiry sent' : 'Record outcome notification sent'}</Button>
    </form>
  )
}
