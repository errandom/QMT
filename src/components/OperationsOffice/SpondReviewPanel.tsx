import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'

interface Group {
  id: string
  name: string
  parentGroupId: string | null
  parentGroup: string | null
}
interface Team {
  id: number
  name: string
  existingGroupId: string | null
  suggestedGroupId: string | null
  reason: string
}
interface Discovery {
  discoveryId: string
  expiresAt: string
  teams: Team[]
  groups: Group[]
}
interface PreviewEvent {
  id: number | string
  title: string
  start: string
  end: string
}
interface Reconciliation {
  warning: string
  scope: string
  timezone: string
  rows: {
    classification: 'linked' | 'coexisting' | 'review' | 'qmt-only' | 'spond-only' | 'held'
    reason: string
    qmt: PreviewEvent | null
    spond: PreviewEvent[]
  }[]
}
const labels = {
  linked: 'Already linked - unchanged',
  coexisting: 'Coexisting - do not sync',
  review: 'Human review required',
  'qmt-only': 'QMT-only candidate - not approved',
  'spond-only': 'Spond-only - preserve',
  held: 'Held - do not sync',
}
const eventText = (event: PreviewEvent) =>
  `${event.title}: ${event.start.slice(0, 16).replace('T', ' ')} to ${event.end.slice(0, 16).replace('T', ' ')}`

export default function SpondReviewPanel() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [discovery, setDiscovery] = useState<Discovery | null>(null)
  const [mappings, setMappings] = useState<Record<number, string>>({})
  const [reviewed, setReviewed] = useState<Record<number, boolean>>({})
  const [confirmation, setConfirmation] = useState(false)
  const [confirmedTeamIds, setConfirmedTeamIds] = useState<number[]>([])
  const [teamId, setTeamId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [preview, setPreview] = useState<Reconciliation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => { controller.current?.abort() }, [])

  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    if (controller.current && !controller.current.signal.aborted) return
    const request = new AbortController()
    controller.current = request
    setBusy(true)
    setError(null)
    setMessage('')
    try { await action(AbortSignal.any([request.signal, AbortSignal.timeout(45000)])) }
    catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : 'Spond review failed; retry discovery.')
    } finally {
      if (!request.signal.aborted) setBusy(false)
      if (controller.current === request) controller.current = null
    }
  }
  const post = <T,>(path: string, body: object, signal: AbortSignal) =>
    apiRequest<T>(`/spond/${path}`, { method: 'POST', body: JSON.stringify(body), signal })
  const invalidateReview = () => {
    setConfirmation(false)
    setConfirmedTeamIds([])
    setPreview(null)
    setMessage('')
  }
  const discover = (event: FormEvent) => {
    event.preventDefault()
    const credentials = { username, password }
    setPassword('')
    setDiscovery(null)
    setTeamId('')
    setReviewed({})
    invalidateReview()
    void run(async signal => {
      const result = await post<Discovery>('discovery', credentials, signal)
      if (signal.aborted) return
      setDiscovery(result)
      setMappings(Object.fromEntries(result.teams.map(team => [team.id, team.suggestedGroupId || ''])))
      setMessage('Discovery complete. Suggestions have not been saved; review and select each mapping explicitly.')
    })
  }
  const selected = discovery?.teams.filter(team => reviewed[team.id] && mappings[team.id]) || []
  const confirmMappings = () => void run(async signal => {
    if (!discovery) return
    setPreview(null)
    const result = await post<{ confirmedTeamIds: number[] }>('mappings/confirm', {
      discoveryId: discovery.discoveryId, confirmed: confirmation,
      mappings: selected.map(team => ({ teamId: team.id, groupId: mappings[team.id] })),
    }, signal)
    if (signal.aborted) return
    setConfirmedTeamIds(result.confirmedTeamIds)
    setTeamId(String(result.confirmedTeamIds[0]))
    setMessage('Reviewed mappings saved. No events, attendance, or sync settings were changed.')
  })
  const reconcile = (event: FormEvent) => {
    event.preventDefault()
    setPreview(null)
    void run(async signal => {
      if (!discovery) return
      const result = await post<Reconciliation>('reconciliation', {
        discoveryId: discovery.discoveryId, teamId: Number(teamId), from, to,
      }, signal)
      if (!signal.aborted) setPreview(result)
    })
  }
  return (
    <Card>
      <CardHeader><CardTitle>Spond discovery and human review</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          QMT remains authoritative for facility bookings. Existing and user-created Spond events are preserved.
          This flow only discovers groups, saves explicitly reviewed mappings, and previews coexistence.
          Publishing, booking imports, attendance imports, and participant notifications are disabled.
        </p>
        <p role="status" aria-live="polite">{busy ? 'Working on Spond review...' : message}</p>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <form onSubmit={discover}>
          <fieldset disabled={busy} className="space-y-3">
            <legend className="font-medium">1. Run discovery</legend>
            <p className="text-sm">Credentials are used for this connection only, never stored in SQL or browser storage.
              The administrator-scoped connection expires after 15 minutes or a server restart.</p>
            <Label htmlFor="spond-review-email">Spond email</Label>
            <Input id="spond-review-email" name="username" type="email" autoComplete="username"
              required value={username} onChange={event => setUsername(event.target.value)} />
            <Label htmlFor="spond-review-password">Spond password</Label>
            <Input id="spond-review-password" name="password" type="password" autoComplete="off"
              required value={password} onChange={event => setPassword(event.target.value)} />
            <Button type="submit">Discover groups and suggest mappings</Button>
          </fieldset>
        </form>
        {discovery && (
          <fieldset disabled={busy} className="space-y-3">
            <legend className="font-medium">2. Review team and group/subgroup mappings</legend>
            <p className="text-sm">Connection expires {new Date(discovery.expiresAt).toLocaleTimeString()}.
              Unselected teams retain their existing mappings. Shared groups are allowed only through your explicit selections.</p>
            {discovery.teams.length === 0 && <p>No active QMT teams were found.</p>}
            <div className="space-y-4">
              {discovery.teams.map(team => (
                <div key={team.id} className="space-y-2 rounded border p-3">
                  <Label htmlFor={`spond-team-${team.id}`}>{team.name}</Label>
                  <p id={`spond-team-reason-${team.id}`} className="text-sm">{team.reason}</p>
                  <select id={`spond-team-${team.id}`} aria-describedby={`spond-team-reason-${team.id}`}
                    className="w-full rounded border bg-background p-2" value={mappings[team.id] || ''}
                    onChange={event => {
                      setMappings(previous => ({ ...previous, [team.id]: event.target.value }))
                      setReviewed(previous => ({ ...previous, [team.id]: false }))
                      invalidateReview()
                    }}>
                    <option value="">Do not change this team</option>
                    {discovery.groups.map(group => <option key={group.id} value={group.id}>
                      {group.parentGroup ? `${group.parentGroup} / ${group.name}` : `${group.name} (entire group)`}
                    </option>)}
                  </select>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name={`review-team-${team.id}`} checked={!!reviewed[team.id]}
                      disabled={!mappings[team.id]} onChange={event => {
                        setReviewed(previous => ({ ...previous, [team.id]: event.target.checked }))
                        invalidateReview()
                      }} />
                    I reviewed this team's selected mapping
                  </label>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="confirm-mappings" checked={confirmation}
                onChange={event => setConfirmation(event.target.checked)} />
              Save only the {selected.length} mappings I reviewed; do not activate sync
            </label>
            <Button type="button" disabled={!confirmation || selected.length === 0} onClick={confirmMappings}>
              Confirm reviewed mappings
            </Button>
          </fieldset>
        )}
        {confirmedTeamIds.length > 0 && (
          <form onSubmit={reconcile}>
            <fieldset disabled={busy} className="space-y-3">
              <legend className="font-medium">3. Preview event coexistence (read-only)</legend>
              <Label htmlFor="spond-preview-team">Reviewed team</Label>
              <select id="spond-preview-team" className="w-full rounded border bg-background p-2" value={teamId}
                onChange={event => { setTeamId(event.target.value); setPreview(null) }} required>
                {discovery?.teams.filter(team => confirmedTeamIds.includes(team.id)).map(team =>
                  <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              <Label htmlFor="spond-preview-from">Start date (club timezone)</Label>
              <Input id="spond-preview-from" type="date" required value={from}
                onChange={event => { setFrom(event.target.value); setPreview(null) }} />
              <Label htmlFor="spond-preview-to">Exclusive end date (maximum 31 days)</Label>
              <Input id="spond-preview-to" type="date" required value={to}
                onChange={event => { setTo(event.target.value); setPreview(null) }} />
              <Button type="submit">Preview without syncing</Button>
            </fieldset>
          </form>
        )}
        {preview && <section aria-label="Event coexistence preview" className="space-y-3">
          <p role="status">{preview.warning}</p>
          <p className="text-sm">{preview.scope}. Times are club wall-clock times ({preview.timezone}), not UTC.</p>
          {preview.rows.length === 0 && <p>No events observed in this preview interval.</p>}
          {preview.rows.map((row, index) => <div key={`${row.qmt?.id || 'spond'}-${index}`} className="rounded border p-3">
            <p className="font-medium">{labels[row.classification]}</p>
            <p className="text-sm">{row.reason}</p>
            {row.qmt && <p className="text-sm">QMT: {eventText(row.qmt)}</p>}
            {row.spond.map(event => <p key={event.id} className="text-sm">Spond: {eventText(event)}</p>)}
          </div>)}
        </section>}
      </CardContent>
    </Card>
  )
}
