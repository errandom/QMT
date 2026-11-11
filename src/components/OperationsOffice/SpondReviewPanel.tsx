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
  confirmedTeamIds: number[]
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
    attendanceEligible: boolean
    reason: string
    qmt: PreviewEvent | null
    spond: PreviewEvent[]
  }[]
}
interface AttendanceStatus {
  connected: boolean
  authorized: boolean
  intervalMinutes: number
  window: string
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  nextRunAt: string | null
  running: boolean
  blocked: boolean
  error: string | null
  processed: number
  failed: number
  queued: number
}
interface AttendanceLink {
  eventId: number
  title: string
  start: string
  sourceCount: number
  lastSync: string | null
  error: string | null
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
const previewDate = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' })
  .format(new Date(Date.now() + offset * 86400000))
const matchingEvents = (row: Reconciliation['rows'][number]) => !row.attendanceEligible || row.classification === 'held' ? []
  : row.spond.filter(event => event.start === row.qmt?.start && event.end === row.qmt?.end)

export default function SpondReviewPanel({ attendanceEnabled = false }: { attendanceEnabled?: boolean } = {}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [discovery, setDiscovery] = useState<Discovery | null>(null)
  const [mappings, setMappings] = useState<Record<number, string>>({})
  const [sharedGroupId, setSharedGroupId] = useState('')
  const [reviewed, setReviewed] = useState<Record<number, boolean>>({})
  const [confirmation, setConfirmation] = useState(false)
  const [confirmedTeamIds, setConfirmedTeamIds] = useState<number[]>([])
  const [teamId, setTeamId] = useState('')
  const [from, setFrom] = useState(() => previewDate(-1))
  const [to, setTo] = useState(() => previewDate(30))
  const [preview, setPreview] = useState<Reconciliation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null)
  const [attendanceLinks, setAttendanceLinks] = useState<AttendanceLink[]>([])
  const [retainToken, setRetainToken] = useState(false)
  const [linkSelections, setLinkSelections] = useState<Record<number, string>>({})
  const [linkConfirmations, setLinkConfirmations] = useState<Record<number, boolean>>({})
  const [linkErrors, setLinkErrors] = useState<Record<number, string>>({})
  const [savedLinks, setSavedLinks] = useState<Record<number, boolean>>({})
  const controller = useRef<AbortController | null>(null)
  const resumed = useRef(false)
  useEffect(() => () => { controller.current?.abort() }, [])
  useEffect(() => {
    if (!attendanceEnabled) return
    const request = new AbortController()
    const update = () => {
      void Promise.all([
        apiRequest<AttendanceStatus>('/spond/attendance/status', { signal: request.signal }),
        apiRequest<AttendanceLink[]>('/spond/attendance/links', { signal: request.signal }),
      ]).then(([status, links]) => {
        if (!request.signal.aborted) { setAttendanceStatus(status); setAttendanceLinks(links) }
      }).catch(failure => {
        if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : 'Attendance status unavailable')
      })
    }
    update()
    const timer = setInterval(update, 30000)
    return () => { request.abort(); clearInterval(timer) }
  }, [attendanceEnabled])
  useEffect(() => {
    if (!attendanceEnabled || !attendanceStatus?.connected || !attendanceStatus.authorized ||
        attendanceStatus.blocked || resumed.current) return
    resumed.current = true
    const request = new AbortController()
    controller.current = request
    setBusy(true)
    void apiRequest<Discovery>('/spond/attendance/resume', {
      method: 'POST', body: '{}', signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
    }).then(result => {
      if (request.signal.aborted) return
      setDiscovery(result)
      setMappings(Object.fromEntries(result.teams.map(team => [team.id, team.suggestedGroupId || ''])))
      setConfirmedTeamIds(result.confirmedTeamIds)
      setTeamId(String(result.confirmedTeamIds[0] || ''))
    }).catch(failure => {
      if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load saved Spond access')
    }).finally(() => {
      if (!request.signal.aborted) setBusy(false)
      if (controller.current === request) controller.current = null
    })
    return () => { request.abort() }
  }, [attendanceEnabled, attendanceStatus?.connected, attendanceStatus?.authorized, attendanceStatus?.blocked])

  const run = async (action: (signal: AbortSignal) => Promise<void>, timeout = 45000) => {
    if (controller.current && !controller.current.signal.aborted) return
    const request = new AbortController()
    controller.current = request
    setBusy(true)
    setError(null)
    setMessage('')
    try { await action(AbortSignal.any([request.signal, AbortSignal.timeout(timeout)])) }
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
    setLinkSelections({})
    setLinkConfirmations({})
    setLinkErrors({})
    setSavedLinks({})
    setMessage('')
  }
  const discover = (event: FormEvent) => {
    event.preventDefault()
    const credentials = { username, password }
    const keepConnected = retainToken
    resumed.current = true
    setPassword('')
    setDiscovery(null)
    setSharedGroupId('')
    setTeamId('')
    setReviewed({})
    setRetainToken(false)
    invalidateReview()
    void run(async signal => {
      const result = await post<Discovery>('discovery', credentials, signal)
      if (signal.aborted) return
      setDiscovery(result)
      setMappings(Object.fromEntries(result.teams.map(team => [team.id, team.suggestedGroupId || ''])))
      setConfirmedTeamIds(result.confirmedTeamIds)
      setTeamId(String(result.confirmedTeamIds[0] || ''))
      if (attendanceEnabled && keepConnected) {
        await post('attendance/connect', { discoveryId: result.discoveryId, confirmed: true }, signal)
        await refreshAttendance(signal)
      }
      if (!signal.aborted) setMessage(keepConnected ? 'Connected. Saved team links are ready to use.' : 'Groups loaded. Review new team links below.')
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
      : `${link}. Already saved.`
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
      teams: previous.teams.map(team => selected.some(item => item.id === team.id)
        ? { ...team, existingGroupId: mappings[team.id], reason: 'Link saved in this session' }
        : team),
    }))
    setReviewed({})
    setConfirmation(false)
    setConfirmedTeamIds(result.confirmedTeamIds)
    setTeamId(String(result.confirmedTeamIds[0]))
    setMessage('Team links saved. Ready to review events.')
  })
  const reconcile = (event: FormEvent) => {
    event.preventDefault()
    setPreview(null)
    setLinkSelections({})
    setLinkConfirmations({})
    setLinkErrors({})
    setSavedLinks({})
    void run(async signal => {
      if (!discovery) return
      let current = discovery
      if (attendanceStatus?.connected && Date.parse(current.expiresAt) <= Date.now()) {
        current = await post<Discovery>('attendance/resume', {}, signal)
        if (signal.aborted) return
        setDiscovery(current)
        setMappings(Object.fromEntries(current.teams.map(team => [team.id, team.suggestedGroupId || ''])))
        setConfirmedTeamIds(current.confirmedTeamIds)
        if (!current.confirmedTeamIds.includes(Number(teamId))) {
          setTeamId(String(current.confirmedTeamIds[0] || ''))
          throw new Error('This team link changed. Review the saved teams before finding events again.')
        }
      }
      const result = await post<Reconciliation>('reconciliation', {
        discoveryId: current.discoveryId, teamId: Number(teamId), from, to,
      }, signal)
      if (!signal.aborted) {
        setPreview(result)
        setLinkSelections(Object.fromEntries(result.rows.filter(row => row.qmt && matchingEvents(row).length === 1)
          .map(row => [Number(row.qmt!.id), String(matchingEvents(row)[0].id)])))
      }
    })
  }
  const refreshAttendance = async (signal: AbortSignal) => {
    const [status, links] = await Promise.all([
      apiRequest<AttendanceStatus>('/spond/attendance/status', { signal }),
      apiRequest<AttendanceLink[]>('/spond/attendance/links', { signal }),
    ])
    if (!signal.aborted) { setAttendanceStatus(status); setAttendanceLinks(links) }
  }
  const attendanceAction = (action: 'disconnect' | 'refresh') => void run(async signal => {
    await post(`attendance/${action}`, { confirmed: true }, signal)
    await refreshAttendance(signal)
    if (!signal.aborted) {
      setRetainToken(false)
      setMessage(action === 'disconnect' ? 'Scheduled reads stopped; existing attendance and bookings are preserved.'
          : 'Attendance refresh queued. Status updates automatically.')
    }
  })
  const confirmAttendanceLinks = () => void run(async signal => {
    if (!discovery) return
    const links = selectedEventIds.slice(0, 50).map(eventId => ({ eventId, providerId: linkSelections[eventId] }))
    const result = await post<{ results: { eventId: number; linked: boolean; error?: string }[] }>('attendance/links/confirm-bulk', {
      discoveryId: discovery.discoveryId, confirmed: true, teamId: Number(teamId), links,
    }, signal)
    if (!signal.aborted) {
      const saved = result.results.filter(item => item.linked)
      const failed = result.results.filter(item => !item.linked)
      setSavedLinks(previous => ({ ...previous, ...Object.fromEntries(saved.map(item => [item.eventId, true])) }))
      setLinkConfirmations(previous => ({ ...previous, ...Object.fromEntries(saved.map(item => [item.eventId, false])) }))
      setLinkErrors(Object.fromEntries(failed.map(item => [item.eventId, item.error || 'Link could not be saved'])))
      setMessage(`${saved.length} event link(s) saved.${failed.length ? ` ${failed.length} failed; review the errors and retry.` : ''}`)
      await refreshAttendance(signal)
    }
  }, 600000)
  const eligibleRows = preview?.rows.filter(row => row.qmt && matchingEvents(row).length > 0) || []
  const selectableIds = eligibleRows.filter(row => linkSelections[Number(row.qmt!.id)] && !savedLinks[Number(row.qmt!.id)])
    .map(row => Number(row.qmt!.id))
  const selectedEventIds = selectableIds.filter(id => linkConfirmations[id])
  const clearPreview = () => { setPreview(null); setLinkSelections({}); setLinkConfirmations({}); setLinkErrors({}); setSavedLinks({}) }
  return (
    <Card>
      <CardHeader><CardTitle>Spond attendance</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Connect once, link your teams, then confirm events together. Bookings and Spond events stay unchanged.
        </p>
        <p role="status" aria-live="polite">{busy ? 'Working on Spond review...' : message}</p>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {attendanceEnabled && <section aria-label="Scheduled Spond attendance" className="space-y-3 rounded border p-3">
          {!attendanceStatus ? <p role="status">Loading connection...</p> : <>
            <p role="status" className="font-medium">{!attendanceStatus.connected ? 'Not connected'
              : !attendanceStatus.authorized || attendanceStatus.blocked ? 'Reconnect to resume attendance updates'
                : attendanceStatus.running ? 'Connected - updating attendance'
                  : `Connected - updates every ${attendanceStatus.intervalMinutes} minutes`}</p>
            <p className="text-sm">{attendanceLinks.length} linked event(s).
              {' '}Last update: {attendanceStatus.lastSuccessAt ? new Date(attendanceStatus.lastSuccessAt).toLocaleString() : 'Not yet'}.</p>
            {attendanceStatus.error && <p role="alert">{attendanceStatus.error}</p>}
            {attendanceStatus.connected && <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy || attendanceStatus.running || attendanceStatus.blocked || !attendanceStatus.authorized}
                onClick={() => attendanceAction('refresh')}>Refresh attendance</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void run(async signal => {
                const result = await post<Discovery>('attendance/resume', {}, signal)
                if (signal.aborted) return
                setDiscovery(result)
                setMappings(Object.fromEntries(result.teams.map(team => [team.id, team.suggestedGroupId || ''])))
                setConfirmedTeamIds(result.confirmedTeamIds)
                setTeamId(String(result.confirmedTeamIds[0] || ''))
                setReviewed({})
                setConfirmation(false)
                clearPreview()
                setMessage('Saved connection and team links loaded.')
              })}>Reload teams</Button>
            </div>}
            <details className="text-sm">
              <summary className="cursor-pointer">Connection details</summary>
              <div className="mt-2 space-y-2">
                <p>QMT stores an encrypted access token, not your password. Access survives restarts; reconnect only if it expires or is revoked.</p>
                <p>{attendanceStatus.window}</p>
                <p>Last attempt: {attendanceStatus.lastAttemptAt ? new Date(attendanceStatus.lastAttemptAt).toLocaleString() : 'Not yet'}.
                  {' '}Next run: {attendanceStatus.nextRunAt ? new Date(attendanceStatus.nextRunAt).toLocaleString() : 'Not scheduled'}.</p>
                <p>{attendanceStatus.processed} updated, {attendanceStatus.failed} failed, {attendanceStatus.queued} remaining.</p>
                {attendanceStatus.connected && <Button type="button" variant="outline" disabled={busy}
                  onClick={() => attendanceAction('disconnect')}>Disconnect Spond</Button>}
              </div>
            </details>
          </>}
        </section>}
        <details open={!attendanceStatus?.connected && !discovery} className="space-y-3">
          <summary className="cursor-pointer font-medium">{attendanceStatus?.connected ? 'Reconnect or change account' : 'Connect Spond'}</summary>
          <form onSubmit={discover}>
          <fieldset disabled={busy} className="space-y-3">
            <legend className="sr-only">Spond sign-in</legend>
            <Label className="text-inherit" htmlFor="spond-review-email">Spond email</Label>
            <Input id="spond-review-email" name="username" type="email" autoComplete="username"
              required value={username} onChange={event => setUsername(event.target.value)} />
            <Label className="text-inherit" htmlFor="spond-review-password">Spond password</Label>
            <Input id="spond-review-password" name="password" type="password" autoComplete="current-password"
              required value={password} onChange={event => setPassword(event.target.value)} />
            {attendanceEnabled && <label className="flex min-h-12 items-center gap-2 text-sm">
              <input type="checkbox" name="retain-attendance-token" checked={retainToken} required
                onChange={event => setRetainToken(event.target.checked)} />
              Keep connected for automatic attendance updates (encrypted token only, never your password).
            </label>}
            <Button type="submit" disabled={attendanceEnabled && !retainToken}>{attendanceEnabled ? 'Connect Spond' : 'Discover groups'}</Button>
          </fieldset>
          </form>
        </details>
        {discovery && (
          <details open={confirmedTeamIds.length === 0} className="space-y-3">
            <summary className="cursor-pointer font-medium">Team links ({confirmedTeamIds.length} saved)</summary>
          <fieldset disabled={busy} className="space-y-3">
            <legend className="sr-only">Link QMT teams to Spond groups</legend>
            <p className="text-sm">
              Saved links are ready to use. Only review teams you want to add or change.
            </p>
            <p id="spond-group-scope" className="text-sm">
              Choose a subgroup for a squad, or an entire group for a shared audience.
            </p>
            {discovery.teams.length === 0 && <p>No active QMT teams were found.</p>}
            <details aria-label="One Spond group to multiple QMT teams" className="space-y-3 rounded border p-3">
              <summary className="cursor-pointer font-medium">Link several teams to one group</summary>
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
                Select teams, then save the reviewed links below. Unselected teams stay unchanged.
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
            </details>
            <details open={confirmedTeamIds.length === 0} className="space-y-3">
              <summary className="cursor-pointer font-medium">Review or edit individual QMT team links</summary>
              <div className="space-y-4">
                {discovery.teams.map(team => (
                  <div key={team.id} className="space-y-2 rounded border p-3">
                    <h3 className="text-base font-semibold">{team.name}</h3>
                    <p id={`spond-team-saved-${team.id}`} className="text-sm">
                      <strong>Saved Spond link: </strong>
                      {team.existingGroupId ? discoveredGroupText(team.existingGroupId) : 'No link saved yet'}
                    </p>
                    <Label className="text-inherit" htmlFor={`spond-team-${team.id}`}>
                      Spond group or subgroup for {team.name}
                    </Label>
                    <p id={`spond-team-reason-${team.id}`} className="sr-only">{team.reason}</p>
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
                    <p id={`spond-team-selection-${team.id}`} className="sr-only">
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
              Save these {selected.length} team links
            </label>
            <Button type="button" disabled={!confirmation || selected.length === 0} onClick={confirmMappings}>
              Save reviewed team links
            </Button>
          </fieldset>
          </details>
        )}
        {confirmedTeamIds.length > 0 && (
          <form onSubmit={reconcile}>
            <fieldset disabled={busy} className="space-y-3">
              <legend className="font-medium">Review events</legend>
              <Label className="text-inherit" htmlFor="spond-preview-team">Reviewed team</Label>
              <select id="spond-preview-team" className="w-full rounded border bg-background p-2" value={teamId}
                onChange={event => { setTeamId(event.target.value); clearPreview() }} required>
                {discovery?.teams.filter(team => confirmedTeamIds.includes(team.id)).map(team =>
                  <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              <p className="text-sm">Spond audience: {discoveredGroupText(discovery?.teams.find(team => team.id === Number(teamId))?.existingGroupId || '')}</p>
              <Label className="text-inherit" htmlFor="spond-preview-from">Start date (club timezone)</Label>
              <Input id="spond-preview-from" type="date" required value={from}
                onChange={event => { setFrom(event.target.value); clearPreview() }} />
              <Label className="text-inherit" htmlFor="spond-preview-to">Exclusive end date (maximum 31 days)</Label>
              <Input id="spond-preview-to" type="date" required value={to}
                onChange={event => { setTo(event.target.value); clearPreview() }} />
              <Button type="submit">Find matching events</Button>
            </fieldset>
          </form>
        )}
        {preview && <section aria-label="Event coexistence preview" className="space-y-3">
          <p className="text-sm">Review the event pairs and audiences below. Attendance only; no events are changed. Times: {preview.timezone}.</p>
          {attendanceEnabled && eligibleRows.length > 0 && <fieldset disabled={busy} className="space-y-3">
            <legend className="sr-only">Bulk attendance event confirmation</legend>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-muted/30 p-3">
              <label className="flex min-h-12 items-center gap-2">
                <input type="checkbox" name="select-all-attendance"
                  checked={selectableIds.length > 0 && selectedEventIds.length === selectableIds.length}
                  disabled={selectableIds.length === 0}
                  onChange={event => {
                    setLinkConfirmations(Object.fromEntries(selectableIds.map(id => [id, event.target.checked])))
                  }} />
                Select all matching events ({selectableIds.length})
              </label>
              <Button type="button" disabled={selectedEventIds.length === 0} onClick={confirmAttendanceLinks}>
                {`Confirm selected (${Math.min(selectedEventIds.length, 50)})`}
              </Button>
            </div>
            {selectedEventIds.length > 50 && <p className="text-sm">50 events are saved at a time. Remaining selections stay ready for the next batch.</p>}
            <p className="text-sm">Confirming approves attendance reads for the selected events and audiences. For combined bookings, review each participating team's sources.</p>
            <div className="divide-y rounded border">
              {eligibleRows.map(row => {
                const eventId = Number(row.qmt!.id)
                const candidates = matchingEvents(row)
                return <div key={eventId} className="space-y-2 p-3 sm:grid sm:grid-cols-[auto_1fr_1fr] sm:items-center sm:gap-4 sm:space-y-0">
                  <label className="flex min-h-12 items-center gap-2">
                    <input type="checkbox" name={`confirm-attendance-${eventId}`}
                      aria-label={`Select ${eventText(row.qmt!)}`}
                      disabled={!linkSelections[eventId] || savedLinks[eventId]}
                      checked={linkConfirmations[eventId] || false}
                      onChange={event => setLinkConfirmations(previous => ({ ...previous, [eventId]: event.target.checked }))} />
                    <span className="sm:sr-only">Select event</span>
                  </label>
                  <div className="min-w-0 break-words text-sm">
                    <p className="font-medium">{row.qmt!.title}</p>
                    <p>{row.qmt!.start.slice(0, 16).replace('T', ' ')} - {row.qmt!.end.slice(11, 16)}</p>
                    {savedLinks[eventId] && <p role="status">Link saved</p>}
                    {linkErrors[eventId] && <p role="alert" className="text-red-700">{linkErrors[eventId]}</p>}
                  </div>
                  <div className="min-w-0">
                    <label className="sr-only" htmlFor={`attendance-source-${eventId}`}>Spond event for {row.qmt!.title}</label>
                    <select id={`attendance-source-${eventId}`} name={`attendance-source-${eventId}`}
                      className="min-h-12 w-full rounded border bg-background p-2 text-sm"
                      disabled={savedLinks[eventId]} value={linkSelections[eventId] || ''}
                      onChange={event => {
                        setLinkSelections(previous => ({ ...previous, [eventId]: event.target.value }))
                        setLinkConfirmations(previous => ({ ...previous, [eventId]: false }))
                      }}>
                      <option value="">Choose matching Spond event</option>
                      {candidates.map(event => <option key={event.id} value={String(event.id)}>{eventText(event)}</option>)}
                    </select>
                    {candidates.length > 1 && <p className="text-sm">Multiple matches - choose one before selecting.</p>}
                  </div>
                </div>
              })}
            </div>
          </fieldset>}
          {preview.rows.length === 0 && <p>No events observed in this preview interval.</p>}
          {attendanceEnabled && preview.rows.length > 0 && eligibleRows.length === 0 && <p>No exact-time matches. Review other events below.</p>}
          <details>
            <summary className="cursor-pointer text-sm">Other events and matching details</summary>
            <p className="text-sm">{preview.warning} {preview.scope}.</p>
          {preview.rows.filter(row => !attendanceEnabled || !row.qmt || matchingEvents(row).length === 0).map((row, index) => <div key={`${row.qmt?.id || 'spond'}-${index}`} className="rounded border p-3">
            <p className="font-medium">{labels[row.classification]}</p>
            <p className="text-sm">{row.reason}</p>
            {row.qmt && <p className="text-sm">QMT: {eventText(row.qmt)}</p>}
            {row.spond.map(event => <p key={event.id} className="text-sm">Spond: {eventText(event)}</p>)}
          </div>)}
          </details>
        </section>}
        {attendanceEnabled && attendanceLinks.length > 0 && <details className="space-y-3">
          <summary className="cursor-pointer font-medium">Linked events ({attendanceLinks.length})</summary>
          {attendanceLinks.map(link => <div key={link.eventId} className="rounded border p-2 text-sm">
            <p>{link.title} - {link.start.slice(0, 16).replace('T', ' ')}: {link.sourceCount} reviewed source(s).
              {' '}Last updated: {link.lastSync ? new Date(link.lastSync).toLocaleString() : 'Not yet'}.</p>
            {link.error && <p role="status">{link.error}</p>}
            <details><summary>Remove this event's attendance links</summary>
              <p>Removes the attendance links and imported counts, not the booking or Spond event.</p>
              <Button type="button" disabled={busy} onClick={() => void run(async signal => {
                await post('attendance/links/remove', { eventId: link.eventId, confirmed: true }, signal)
                await refreshAttendance(signal)
                if (!signal.aborted) setMessage('Attendance links removed. Both events are unchanged.')
              })}>Confirm removal of attendance links only</Button>
            </details>
          </div>)}
        </details>}
      </CardContent>
    </Card>
  )
}
