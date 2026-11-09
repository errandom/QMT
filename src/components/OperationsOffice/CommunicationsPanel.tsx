import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { operationsApi, type Communication } from '@/lib/operations'
import type { FacilityRequest, User } from '@/lib/types'
import { facilityMessage, facilityMessageSubject, facilityStage } from '@/lib/facilityWorkflow'
import { useMessageDraft } from '@/hooks/useMessageDraft'
import { useData } from '@/contexts/DataContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import MessageLanguageSwitch from './MessageLanguageSwitch'

export default function CommunicationsPanel({ request, currentUser }: { request: FacilityRequest; currentUser: User }) {
  const { teams, fields, sites, refreshRequests } = useData()
  const [messages, setMessages] = useState<Communication[]>([])
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [owner, setOwner] = useState(request.workflow?.owner || '')
  const [due, setDue] = useState(request.workflow?.followUpDate || '')
  const stage = facilityStage(request)
  const action = stage === 'Received' ? 'acknowledge' : stage === 'In evaluation' ? 'send' :
    request.status !== 'Pending' && !request.workflow?.outcomeNotifiedAt ? 'notify' : 'followup'
  const workbookInquiry = action === 'send' && request.workflow?.route === 'IGACR'
  const [recipient, setRecipient] = useState(action === 'send' || stage === 'Awaiting response' ? request.workflow?.contactEmail || '' : request.requestorEmail || '')
  const { language, setLanguage, draft, setDraft } = useMessageDraft(language => ({
    subject: facilityMessageSubject(request, language),
    message: facilityMessage(request, action, teams, fields, sites, currentUser, language),
  }))
  const { subject, message } = draft
  const [approved, setApproved] = useState(false)
  const sendId = useRef(crypto.randomUUID())
  const sentContent = useRef('')
  const [sendLocked, setSendLocked] = useState(false)

  const load = async () => {
    const result = await operationsApi.messages(request.id)
    setMessages(result.messages)
    setConfigured(result.configured)
  }
  useEffect(() => {
    let active = true
    operationsApi.messages(request.id).then(result => {
      if (active) { setMessages(result.messages); setConfigured(result.configured) }
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Thread could not be loaded') })
    return () => { active = false }
  }, [request.id])
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await operation() }
    catch (error) { setError(error instanceof Error ? error.message : 'Communication was not saved') }
    finally { setBusy(false) }
  }
  const send = async () => {
    const content = JSON.stringify([recipient, subject, message, action, request.workflow?.version || 0])
    if (sentContent.current && sentContent.current !== content) throw new Error('Review the previous send in the thread before starting a new message')
    sentContent.current = content
    setSendLocked(true)
    const result = await operationsApi.send(request.id, { id: sendId.current, recipient, subject, message, action,
      expectedVersion: request.workflow?.version || 0, approved: true })
    if (result.status !== 'accepted') throw new Error(`Send status: ${result.status}. Check the thread and mailbox before creating another message.`)
    toast.success('Mailbox accepted the email. Delivery is not confirmed.')
    setApproved(false)
    await load()
    await refreshRequests()
    if (result.workflowApplied === false) setError('Email was accepted, but the request changed meanwhile. Review its workflow; do not resend.')
  }
  return <section className="space-y-4 rounded-lg border p-4">
    <h3 className="font-semibold">Ownership, reminders and linked email</h3>
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => {
      event.preventDefault()
      void run(async () => {
        await api.updateFacilityWorkflow(request.id, { action: 'assign', owner, followUpDate: due }, request.workflow?.version || 0)
        await refreshRequests()
        toast.success('Owner and follow-up saved')
      })
    }}>
      <label className="space-y-1">Owner<Input value={owner} maxLength={255} onChange={event => setOwner(event.target.value)} /></label>
      <label className="space-y-1">Follow-up / reminder date<Input type="date" value={due} onChange={event => setDue(event.target.value)} /></label>
      <Button type="submit" variant="outline" disabled={busy}>Save responsibility</Button>
    </form>
    <p className="text-sm text-muted-foreground">Due follow-ups appear in the Actions queue. Email requires a configured club mailbox. Existing manual email / WhatsApp recording remains available.</p>
    {error && <p role="alert" className="text-destructive whitespace-pre-wrap">{error}</p>}
    {workbookInquiry ? <p className="text-sm">Initial IGACR meeting-room submission uses the workbook panel above, not an email send. Ownership and follow-up tracking remain available here.</p> :
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run(send) }}>
      <fieldset disabled={busy || sendLocked} className="space-y-3">
        <legend className="text-sm font-medium">Email: {action === 'followup' ? 'follow-up or booking change' : action}</legend>
        <MessageLanguageSwitch language={language} onChange={language => { setLanguage(language); setApproved(false) }} />
        <label className="block space-y-1">Recipient<Input type="email" required maxLength={254} value={recipient} onChange={event => { setRecipient(event.target.value); setApproved(false) }} /></label>
        <label className="block space-y-1">Subject<Input lang={language} required maxLength={220} value={subject} onChange={event => { setDraft({ ...draft, subject: event.target.value }); setApproved(false) }} /></label>
        <label className="block space-y-1">Message<Textarea lang={language} required rows={7} maxLength={16000} value={message} onChange={event => { setDraft({ ...draft, message: event.target.value }); setApproved(false) }} /></label>
        <label className="flex min-h-12 items-center gap-2"><input type="checkbox" required checked={approved} onChange={event => setApproved(event.target.checked)} />I approve sending this exact email to this recipient.</label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || sendLocked || !configured || !approved}>Approve and send email</Button>
        <Button type="button" variant="outline" disabled={busy || !configured} onClick={() => void run(async () => {
          const result = await operationsApi.sync(request.id)
          await load()
          toast.success(`${result.imported} new replies linked; review before changing the workflow`)
        })}>Sync replies</Button>
        {sendLocked && <Button type="button" variant="outline" disabled={busy} onClick={() => void run(async () => {
          await load()
          sendId.current = crypto.randomUUID(); sentContent.current = ''; setSendLocked(false); setApproved(false)
        })}>I checked the thread / Sent Items; compose another</Button>}
      </div>
      {!configured && <p role="status" className="text-sm">Mailbox not configured. Nothing will be sent from QMT until it is connected.</p>}
    </form>}
    <div className="space-y-3">
      <h4 className="font-medium">Communication thread</h4>
      {!messages.length && <p className="text-sm text-muted-foreground">No integrated messages yet. Earlier manual records remain in workflow history.</p>}
      {messages.map(item => <article key={item.id} className="rounded border p-3 text-sm">
        <p className="font-medium">{item.direction === 'inbound' ? 'From' : 'To'} {item.recipient} — {item.status === 'sending' ? 'Send started; outcome may be unknown — check mailbox' : item.status}</p>
        <p>{item.subject} · {new Date(item.created_at).toLocaleString()}</p>
        <details><summary className="cursor-pointer">Read message</summary><p className="whitespace-pre-wrap break-words">{item.message}</p></details>
        {item.direction === 'inbound' && stage === 'Awaiting response' && <Button variant="outline" size="sm" disabled={busy}
          onClick={() => void run(async () => {
            if (item.message.length > 4000) throw new Error('Summarize this long reply in the manual response field before recording it')
            await api.updateFacilityWorkflow(request.id, { action: 'response', message: `${item.recipient}: ${item.message}`.slice(0, 4000) }, request.workflow?.version || 0)
            await refreshRequests()
            toast.success('Reply recorded for evaluation; no approval was made')
          })}>Record this reply as response</Button>}
      </article>)}
    </div>
  </section>
}
