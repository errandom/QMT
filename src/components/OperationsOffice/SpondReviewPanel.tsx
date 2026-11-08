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
const groupText = (group: Group) => group.parentGroup
  ? `${group.parentGroup} / ${group.name} (subgroup)`
  : `${group.name} (entire group)`

export default function SpondReviewPanel() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [discovery, setDiscovery] = useState<Discovery | null>(null)
  const [mappings, setMappings] = useState<Record<number, string>>({})
  const [sharedGroupId, setSharedGroupId] = useState('')
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
    setSharedGroupId('')
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
  const selectedGroups = discovery?.groups.map(group => ({
    group, teams: selected.filter(team => mappings[team.id] === group.id),
  })).filter(entry => entry.teams.length > 0) || []
  const discoveredGroupText = (id: string) => {
    const group = discovery?.groups.find(candidate => candidate.id === id)
    return group ? groupText(group) : 'Group unavailable in this discovery'
  }
  const selectionText = (team: Team) => {
    const groupId = mappings[team.id]
    if (!groupId) return 'No change. This team will not be saved or unlinked.'
    const link = `QMT ${team.name} -> Spond ${discoveredGroupText(groupId)}`
    if (groupId !== team.existingGroupId) return `${link}. Not saved until you review and confirm below.`
    return confirmedTeamIds.includes(team.id)
      ? `${link}. Already saved; ready for read-only event preview below.`
      : `${link}. Already saved; review and confirm to preview this team's events.`
  }
  const confirmMappings = () => void run(async signal => {
    if (!discovery) return
    setPreview(null)
    const result = await post<{ confirmedTeamIds: number[] }>('mappings/confirm', {
      discoveryId: discovery.discoveryId, confirmed: confirmation,
      mappings: selected.map(team => ({ teamId: team.id, groupId: mappings[team.id] })),
    }, signal)
    if (signal.aborted) return
    setDiscovery(previous => previous && ({
      ...previous,
      teams: previous.teams.map(team => result.confirmedTeamIds.includes(team.id)
        ? { ...team, existingGroupId: mappings[team.id], reason: 'Link saved in this session' }
        : team),
    }))
    setReviewed({})
    setConfirmation(false)
    setConfirmedTeamIds(result.confirmedTeamIds)
    setTeamId(String(result.confirmedTeamIds[0]))
    setMessage('Reviewed team links saved. No events, attendance, or sync settings were changed.')
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
            <Label className="text-inherit" htmlFor="spond-review-email">Spond email</Label>
            <Input id="spond-review-email" name="username" type="email" autoComplete="username"
              required value={username} onChange={event => setUsername(event.target.value)} />
            <Label className="text-inherit" htmlFor="spond-review-password">Spond password</Label>
            <Input id="spond-review-password" name="password" type="password" autoComplete="off"
              required value={password} onChange={event => setPassword(event.target.value)} />
            <Button type="submit">Discover groups and suggest mappings</Button>
          </fieldset>
        </form>
        {discovery && (
          <fieldset disabled={busy} className="space-y-3">
            <legend className="font-medium">2. Link QMT teams to Spond groups</legend>
            <p className="text-sm">
              Choose one Spond group or subgroup, then select all QMT teams that belong to it.
              You are linking teams, not matching individual events. Saving these links does not copy events or activate sync.
            </p>
            <p className="text-sm">Connection expires {new Date(discovery.expiresAt).toLocaleTimeString()}.
              Teams you leave unchanged or do not review keep their saved links.
              Shared groups are allowed only through your explicit selections.</p>
            <p id="spond-group-scope" className="text-sm">
              Choose a subgroup for a specific squad, or an entire group for the broader group.
              Event previews currently inspect the whole parent group for duplicate safety, even when you select a subgroup.
            </p>
            {discovery.teams.length === 0 && <p>No active QMT teams were found.</p>}
            <section aria-label="One Spond group to multiple QMT teams" className="space-y-3 rounded border p-3">
              <h3 className="font-medium">One Spond group, multiple QMT teams (1:n)</h3>
              <p className="text-sm">
                A Spond group can be shared by several QMT teams. Each QMT team keeps one Spond link.
                Repeat this selection for other Spond groups, or edit individual team links below.
              </p>
              <Label className="text-inherit" htmlFor="spond-shared-group">Spond group or subgroup to share</Label>
              <select id="spond-shared-group" name="shared-group"
                aria-describedby="spond-group-scope spond-shared-help"
                className="w-full rounded border bg-background p-2" value={sharedGroupId}
                onChange={event => { setSharedGroupId(event.target.value); invalidateReview() }}>
                <option value="">Choose one Spond group or subgroup</option>
                {discovery.groups.map(group => <option key={group.id} value={group.id}>
                  {groupText(group)}
                </option>)}
              </select>
              <p id="spond-shared-help" className="text-sm">
                Checking a team explicitly reviews its link to the selected Spond group.
                Nothing is saved until you confirm the complete list below.
                Unchecking a team removes it from that list; its saved link stays unchanged.
              </p>
              <fieldset id="spond-shared-teams" disabled={!sharedGroupId} className="space-y-2">
                <legend className="font-medium">
                  {sharedGroupId ? `Select and review QMT teams for ${discoveredGroupText(sharedGroupId)}` : 'Choose QMT teams'}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {discovery.teams.map(team => (
                    <label key={team.id} id={`spond-shared-team-${team.id}`}
                      className="flex min-h-11 cursor-pointer items-start gap-2 rounded border p-3">
                      <input type="checkbox" name={`share-team-${team.id}`} value={team.id}
                        aria-describedby="spond-shared-help" className="mt-1 shrink-0 accent-primary"
                        checked={!!sharedGroupId && !!reviewed[team.id] && mappings[team.id] === sharedGroupId}
                        onChange={event => {
                          const checked = event.target.checked
                          setMappings(previous => ({ ...previous, [team.id]: checked ? sharedGroupId : '' }))
                          setReviewed(previous => ({ ...previous, [team.id]: checked }))
                          invalidateReview()
                        }} />
                      <span className="min-w-0 break-words">
                        <span className="font-medium">{team.name}</span>
                        <span className="block text-sm">
                          Saved: {team.existingGroupId ? discoveredGroupText(team.existingGroupId) : 'No link saved yet'}
                        </span>
                        {!team.existingGroupId && team.suggestedGroupId && !reviewed[team.id] && <span className="block text-sm">
                          Suggested: {discoveredGroupText(team.suggestedGroupId)} (not reviewed)
                        </span>}
                        {reviewed[team.id] && mappings[team.id] && <span className="block text-sm">
                          Reviewed for: {discoveredGroupText(mappings[team.id])} (awaiting final confirmation)
                        </span>}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
            <details className="space-y-3">
              <summary className="cursor-pointer font-medium">Review or edit individual QMT team links</summary>
              <div className="space-y-4">
                {discovery.teams.map(team => (
                  <div key={team.id} className="space-y-2 rounded border p-3">
                    <p className="text-sm">QMT team</p>
                    <h3 className="text-base font-semibold">{team.name}</h3>
                    <p id={`spond-team-saved-${team.id}`} className="text-sm">
                      <strong>Saved Spond link: </strong>
                      {team.existingGroupId ? discoveredGroupText(team.existingGroupId) : 'No link saved yet'}
                    </p>
                    <Label className="text-inherit" htmlFor={`spond-team-${team.id}`}>
                      Spond group or subgroup for {team.name}
                    </Label>
                    <p id={`spond-team-reason-${team.id}`} className="text-sm">{team.reason}</p>
                    <select id={`spond-team-${team.id}`}
                      aria-describedby={`spond-team-saved-${team.id} spond-team-reason-${team.id} spond-group-scope spond-team-selection-${team.id}`}
                      className="w-full rounded border bg-background p-2" value={mappings[team.id] || ''}
                      onChange={event => {
                        setMappings(previous => ({ ...previous, [team.id]: event.target.value }))
                        setReviewed(previous => ({ ...previous, [team.id]: false }))
                        invalidateReview()
                      }}>
                      <option value="">Leave saved link unchanged (do not save this team)</option>
                      {discovery.groups.map(group => <option key={group.id} value={group.id}>
                        {groupText(group)}
                      </option>)}
                    </select>
                    <p id={`spond-team-selection-${team.id}`} className="text-sm">
                      <strong>After saving: </strong>
                      {selectionText(team)}
                    </p>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name={`review-team-${team.id}`} checked={!!reviewed[team.id]}
                        disabled={!mappings[team.id]} onChange={event => {
                          setReviewed(previous => ({ ...previous, [team.id]: event.target.checked }))
                          invalidateReview()
                        }} />
                      I reviewed the Spond link for QMT team {team.name}
                    </label>
                  </div>
                ))}
              </div>
            </details>
            <section aria-label="Reviewed team links to save" className="space-y-2 rounded border p-3">
              <h3 className="font-medium">Team links to save ({selected.length})</h3>
              {selected.length === 0
                ? <p className="text-sm">No links reviewed yet. Choose a Spond group and check each team's review box.</p>
                : <ul className="list-inside list-disc text-sm">
                  {selectedGroups.map(({ group, teams }) => <li key={group.id}>
                    Spond {groupText(group)} {'->'} QMT {teams.map(team => team.name).join(', ')}
                  </li>)}
                </ul>}
            </section>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="confirm-mappings" checked={confirmation}
                onChange={event => setConfirmation(event.target.checked)} />
              Save only the {selected.length} team links listed above; do not activate sync
            </label>
            <Button type="button" disabled={!confirmation || selected.length === 0} onClick={confirmMappings}>
              Save reviewed team links
            </Button>
          </fieldset>
        )}
        {confirmedTeamIds.length > 0 && (
          <form onSubmit={reconcile}>
            <fieldset disabled={busy} className="space-y-3">
              <legend className="font-medium">3. Preview event coexistence (read-only)</legend>
              <Label className="text-inherit" htmlFor="spond-preview-team">Reviewed team</Label>
              <select id="spond-preview-team" className="w-full rounded border bg-background p-2" value={teamId}
                onChange={event => { setTeamId(event.target.value); setPreview(null) }} required>
                {discovery?.teams.filter(team => confirmedTeamIds.includes(team.id)).map(team =>
                  <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              <Label className="text-inherit" htmlFor="spond-preview-from">Start date (club timezone)</Label>
              <Input id="spond-preview-from" type="date" required value={from}
                onChange={event => { setFrom(event.target.value); setPreview(null) }} />
              <Label className="text-inherit" htmlFor="spond-preview-to">Exclusive end date (maximum 31 days)</Label>
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
