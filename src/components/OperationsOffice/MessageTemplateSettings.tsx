import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { messageTemplatesApi } from '@/lib/messageTemplates'
import { requestMessageClosing, requestMessageSignature } from '@/lib/facilityWorkflow'
import type { User } from '@/lib/types'
import { renderTemplate, templateRecipients, validateTemplate, type SavedMessageTemplate } from '../../../server/message-template-domain.mjs'

export default function MessageTemplateSettings({ currentUser }: { currentUser: User }) {
  const id = useId()
  const errorRef = useRef<HTMLParagraphElement>(null)
  const [library, setLibrary] = useState<SavedMessageTemplate[]>([])
  const [selectedKey, setSelectedKey] = useState('facility.acknowledge')
  const [language, setLanguage] = useState<'en' | 'de'>('en')
  const [content, setContent] = useState({ subject: '', message: '', recipient: '' })
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [preview, setPreview] = useState<{ subject: string; message: string; recipient: string } | null>(null)
  const selected = library.find(item => item.key === selectedKey && item.language === language)
  const fail = (error: unknown) => {
    setError(error instanceof Error ? error.message : 'Template operation failed')
    requestAnimationFrame(() => errorRef.current?.focus())
  }
  const load = async () => {
    setLoading(true); setError('')
    try {
      const result = await messageTemplatesApi.list()
      setLibrary(result)
      const item = result.find(item => item.key === selectedKey && item.language === language)
      if (item) setContent({ subject: item.subject, message: item.message, recipient: item.recipient })
      setDirty(false); setPreview(null)
    } catch (error) { fail(error) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    messageTemplatesApi.list().then(result => {
      if (!active) return
      setLibrary(result)
      const item = result.find(item => item.key === 'facility.acknowledge' && item.language === 'en')
      if (item) setContent({ subject: item.subject, message: item.message, recipient: item.recipient })
    }).catch(error => { if (active) fail(error) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const choose = (key: string, nextLanguage: 'en' | 'de') => {
    const item = library.find(item => item.key === key && item.language === nextLanguage)
    if (!item) return
    setSelectedKey(key); setLanguage(nextLanguage)
    setContent({ subject: item.subject, message: item.message, recipient: item.recipient })
    setError(''); setStatus(''); setPreview(null)
  }
  const update = (next: typeof content) => { setContent(next); setDirty(true); setError(''); setStatus(''); setPreview(null) }
  const showPreview = () => {
    if (!selected) return
    try {
      validateTemplate(selected, content)
      const templates = library.map(item => item === selected ? { ...item, ...content } : item)
      const de = language === 'de'
      const values = {
        sender_name: currentUser.username.toLowerCase() === 'qmtadmin' ? 'Kenny' : currentUser.fullName?.trim() || currentUser.username,
        signature: requestMessageSignature(currentUser, language, templates),
        closing: requestMessageClosing(currentUser, language, templates),
        requester_name: de ? 'Beispiel-Anfragende' : 'Example requester',
        facility_subject: de ? 'Anfrage zur Anlagennutzung #42 - Training, Montag, 26. April 2027' : 'Facility request #42 - Practice, Monday, 26 April 2027',
        event_title: de ? 'Beispieltraining' : 'Example practice',
        event_count: '1',
        contact_name: de ? 'zusammen' : 'everyone', contact_pronoun: 'euch', contact_verb: 'teilt',
        facility_type: de ? 'ein Spielfeld' : 'field',
        details: de ? 'Beispieldaten (keine echte Buchung):\nDatum: Montag, 26. April 2027\nZeit: 18:00 - 19:30\nOrt: Beispielanlage - Spielfeld\nTeams: Beispielteam' : 'Sample data (not a real booking):\nDate: Monday, 26 April 2027\nTime: 18:00 - 19:30\nLocation: Example site - Field\nTeams: Example team',
        reference: '\nReference: EXAMPLE-42',
        decision: selected.key === 'facility.rejected' ? (de ? 'Leider können wir deine Anfrage zur Nutzung einer Anlage nicht genehmigen.' : "Sorry, we can't approve your facility request.") : (de ? 'Deine Anfrage wurde genehmigt. Nur das aufgeführte Datum ist gebucht.' : 'Your request has been approved. Only the listed date is booked.'),
        conditions: de ? '\n\nEntscheid / Bedingungen:\nBeispielbedingung' : '\n\nDecision / conditions:\nExample condition',
        permit_note: de ? '\n\nSeparat erforderliche Bewilligungen müssen weiterhin geprüft werden.' : '\n\nSeparate permits still need to be verified.',
        changes: de ? '\n\nÄNDERUNGEN:\nZeit: 17:00 → 18:00' : '\n\nCHANGES:\nTime: 17:00 → 18:00',
      }
      setPreview({ ...renderTemplate(selected.key, language, values, templates), recipient: selected.recipientLimit ? templateRecipients(selected.key, language, ['sample@example.invalid'], templates).join(', ') : '' }); setError('')
    } catch (error) { fail(error) }
  }
  const save = async (reset: boolean) => {
    if (!selected || busy) return
    setError(''); setStatus('')
    try {
      if (!reset) validateTemplate(selected, content)
      setBusy(true)
      const item = reset ? await messageTemplatesApi.reset(selected) : await messageTemplatesApi.save(selected, content.subject, content.message, content.recipient)
      setLibrary(current => current.map(value => value.key === item.key && value.language === item.language ? item : value))
      setContent({ subject: item.subject, message: item.message, recipient: item.recipient }); setDirty(false); setPreview(null)
      setStatus(reset ? 'Original template restored for future drafts.' : 'Template saved for future drafts. Existing drafts and sent messages are unchanged.')
    } catch (error) { fail(error) }
    finally { setBusy(false) }
  }
  return <Card>
    <CardHeader><CardTitle id={`${id}-title`}>Message templates</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">The library starts with QMT's existing English and German messages. Templates apply to email and matching manual communication drafts. Editing a template never sends a message.</p>
      {loading && <p role="status">Loading template library...</p>}
      <p ref={errorRef} tabIndex={-1} role="alert" id={`${id}-error`} className="text-sm text-destructive">{error}</p>
      <p role="status" className="text-sm">{status}</p>
      {!loading && <Button type="button" variant="outline" disabled={busy || dirty} onClick={() => void load()}>Reload library</Button>}
      {selected && <form aria-labelledby={`${id}-title`} onSubmit={event => { event.preventDefault(); void save(false) }} className="space-y-4">
        <fieldset disabled={busy || loading} className="min-w-0 space-y-4">
          <legend className="sr-only">Edit message template</legend>
          <div className="space-y-1">
            <label htmlFor={`${id}-template`}>Template</label>
            <select id={`${id}-template`} name="template" className="min-h-12 w-full rounded-md border bg-background px-3 text-base" disabled={dirty} value={selectedKey} onChange={event => choose(event.target.value, language)}>
              {library.filter(item => item.language === 'en').map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
            </select>
          </div>
          <fieldset disabled={dirty} className="flex gap-4">
            <legend>Language</legend>
            {(['en', 'de'] as const).map(value => <label key={value} className="flex min-h-12 items-center gap-2"><input type="radio" name={`${id}-language`} value={value} checked={language === value} onChange={() => choose(selectedKey, value)} />{value === 'en' ? 'English' : 'German'}</label>)}
          </fieldset>
          <p className="text-sm text-muted-foreground">{selected.customized ? 'Customized' : 'Original QMT template'} · Revision {selected.revision}{selected.updatedBy && ` · Updated by ${selected.updatedBy}`}{selected.updatedAt && ` on ${new Date(selected.updatedAt).toLocaleString()}`}</p>
          {dirty && <div className="flex flex-wrap items-center gap-2"><p role="status" className="text-sm">Unsaved changes. Save or discard before switching templates.</p><Button type="button" variant="outline" onClick={() => { setDirty(false); choose(selectedKey, language) }}>Discard edits</Button></div>}
          <p id={`${id}-help`} className="text-sm text-muted-foreground">Supported placeholders: {selected.placeholders.map(value => `{{${value}}}`).join(', ')}. Keep each required generated block exactly once: {selected.required.map(value => `{{${value}}}`).join(', ')}. QMT supplies booking facts, decisions and conditions; these blocks cannot be removed. Preview uses sample data only.</p>
          {selected.subject !== '' && <div className="space-y-1"><label htmlFor={`${id}-subject`}>Subject *</label><Input id={`${id}-subject`} name="subject" lang={language} required maxLength={220} className="min-h-12 text-base" aria-describedby={`${id}-help ${id}-error`} value={content.subject} onChange={event => update({ ...content, subject: event.target.value })} /></div>}
          {selected.recipientLimit > 0 && <div className="space-y-1">
            <label htmlFor={`${id}-recipient`}>Default email recipient{selected.recipientLimit > 1 ? 's' : ''} (optional)</label>
            <Input id={`${id}-recipient`} name="recipient" type="email" multiple={selected.recipientLimit > 1} maxLength={5200} className="min-h-12 text-base" value={content.recipient} aria-describedby={`${id}-recipient-help ${id}-error`} onChange={event => update({ ...content, recipient: event.target.value })} />
            <p id={`${id}-recipient-help`} className="text-sm text-muted-foreground">Leave blank to use the request's current requester/department or event contacts. {selected.recipientLimit > 1 ? 'Use comma-separated email addresses (up to 20).' : 'Use one email address.'} This sets the To default only; recipients can still be reviewed and changed for each email. Transport CC contacts remain unchanged.</p>
          </div>}
          <div className="space-y-1"><label htmlFor={`${id}-message`}>Message *</label><Textarea id={`${id}-message`} name="message" lang={language} required maxLength={16000} rows={10} className="text-base" aria-describedby={`${id}-help ${id}-error`} value={content.message} onChange={event => update({ ...content, message: event.target.value })} /></div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-12">Save template</Button>
            <Button type="button" variant="outline" className="min-h-12" onClick={showPreview}>Preview with sample data</Button>
            <Button type="button" variant="outline" className="min-h-12" disabled={dirty || !selected.customized} onClick={() => void save(true)}>Reset to original</Button>
          </div>
        </fieldset>
      </form>}
      {preview && <section aria-label="Sample message preview" lang={language} className="space-y-2 rounded-md border p-4">
        <h4 className="font-semibold">Sample preview — nothing will be sent</h4>
        {preview.subject && <p className="break-words font-medium">{preview.subject}</p>}
        {preview.recipient && <p className="break-words">To: {preview.recipient}</p>}
        <p className="whitespace-pre-wrap break-words">{preview.message}</p>
      </section>}
    </CardContent>
  </Card>
}
