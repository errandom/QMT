import { useEffect, useState, type CSSProperties } from 'react'
import { api } from '@/lib/api'
import type { PublicWeek } from '@/lib/types'
import { withFieldSharing, formatSharedFieldBookings } from '@/lib/fieldSharing'
import { getTeamColor } from '@/lib/teamColors'
import { widgetBookings, widgetDays, widgetUrl } from '@/lib/weeklyWidget'

export default function WeeklyWidget() {
  const params = new URLSearchParams(window.location.search)
  const [week, setWeek] = useState(() => params.get('week') || '')
  const [team, setTeam] = useState(() => params.get('team') || 'all')
  const [data, setData] = useState<PublicWeek>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [updated, setUpdated] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError('')
    setCopyStatus('')
    setData(undefined)
    api.getPublicWeek(week || undefined, controller.signal).then(result => {
      if (!active) return
      setData(result)
      setUpdated(new Date().toLocaleTimeString('en-GB', { timeZone: result.timezone }))
      document.title = `${result.clubName} - weekly schedule`
    }).catch(failure => {
      if (active) setError(failure instanceof Error ? failure.message : 'Weekly schedule could not be loaded')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [week, revision])

  const events = data ? withFieldSharing(data.events) : []
  const invalidTeam = Boolean(data && team !== 'all' && !data.teams.some(item => item.id === team))
  const url = widgetUrl(window.location.origin, week, team)
  const code = `<iframe src="${url.replace(/&/g, '&amp;')}" title="Weekly QMT schedule" loading="lazy" style="width:100%;height:720px;border:0" allow="clipboard-write"></iframe>`
  const move = (offset: number) => {
    if (!data) return
    const day = new Date(`${data.weekStart}T00:00:00Z`)
    day.setUTCDate(day.getUTCDate() + offset)
    setWeek(day.toISOString().slice(0, 10))
  }
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(code)
      setCopyStatus('Embed code copied.')
    } catch (failure) {
      setCopyStatus(`${failure instanceof Error ? failure.message : 'Copy failed'}. Select and copy the code below.`)
    }
  }
  return <main className="weekly-widget">
    <header className="widget-header">
      <div><h1>{data?.clubName || 'QMT'} weekly schedule</h1>
        {data && <p>{data.weekStart} to {data.weekEnd} · {data.timezone}</p>}
      </div>
      <a href={`${window.location.origin}/`} target="_blank" rel="noopener noreferrer">Open QMT</a>
    </header>
    <nav className="widget-controls" aria-label="Weekly schedule controls">
      <button type="button" disabled={loading || !data} onClick={() => move(-7)}>Previous week</button>
      <button type="button" onClick={() => { setWeek(''); setRevision(value => value + 1) }}>This week</button>
      <button type="button" disabled={loading || !data} onClick={() => move(7)}>Next week</button>
      <label>Week containing <input type="date" value={week || data?.weekStart || ''}
        onChange={event => setWeek(event.target.value)} /></label>
      <label>Team <select value={team} onChange={event => { setTeam(event.target.value); setCopyStatus('') }}>
        <option value="all">All teams</option>
        {invalidTeam && <option value={team}>Unknown team ({team})</option>}
        {data?.teams.slice().sort((a, b) => a.name.localeCompare(b.name)).map(item =>
          <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh</button>
    </nav>
    {loading && <p role="status">Loading this week's bookings...</p>}
    {error && <p role="alert">{error}. <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
    {invalidTeam && <p role="alert">This team is not available. Select another team or All teams.</p>}
    {data && !loading && !invalidTeam && <>
      <p className="widget-note">Actual bookings, including cancellations and unassigned locations. This is not the recurring-program template.</p>
      <div className="widget-days">{widgetDays(data.weekStart).map(date => {
        const bookings = widgetBookings(events, date, team)
        return <section key={date} className="widget-day" aria-label={date}>
          <h2>{new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })}</h2>
          {!bookings.length && <p className="widget-note">No bookings.</p>}
          {bookings.map(({ event, start, end }) => {
            const color = event.teamIds.length === 1 ? getTeamColor(event.teamIds[0]) : undefined
            const venues = event.fieldIds.map(id => {
              const field = data.fields.find(item => item.id === id)
              const site = data.sites.find(item => item.id === field?.siteId)
              return field ? `${site?.name || 'Site'} / ${field.name}` : `Location ${id}`
            })
            const sharing = event.sharedFieldBookings || []
            return <details key={event.id} className="schedule-booking" data-status={event.status}
              style={{ '--booking-accent': color?.foreground || '#475569' } as CSSProperties}>
              <summary>
                <span className="schedule-time">{start} - {end}</span>
                <span className="schedule-teams">{event.teamIds.map(id => {
                  const teamColor = getTeamColor(id)
                  return <span key={id} className="schedule-team" style={{ color: teamColor.foreground, backgroundColor: teamColor.background }}>
                    {data.teams.find(item => item.id === id)?.name || `Team ${id}`}
                  </span>
                })}</span>
                <span className="schedule-title">{event.title || event.eventType}</span>
                <span className="schedule-kind">{event.eventType} · {event.status}</span>
                <span className="schedule-site">{event.gameLocation === 'away'
                  ? `Away: ${[event.awayStreet, event.awayZip, event.awayCity].filter(Boolean).join(', ') || 'Location not specified'}`
                  : venues.join('; ') || 'Location not assigned'}</span>
                {sharing.length > 0 && <span className="schedule-sharing">Shared field - not exclusively available</span>}
              </summary>
              <div className="schedule-booking-details">
                <p>{event.date} {event.startTime} to {event.endDate || event.date} {event.endTime}</p>
                {sharing.length > 0 && <p>{formatSharedFieldBookings(sharing, data.fields, data.sites, data.teams)}</p>}
              </div>
            </details>
          })}
        </section>
      })}</div>
      <p className="widget-note">Loaded at {updated} ({data.timezone}). Use Refresh for the latest changes.</p>
    </>}
    <details className="widget-embed">
      <summary>Embed this schedule on your website</summary>
      <p>Paste this HTML into your website's embed/custom HTML block. Omit the week parameter to follow the current week. The frame scrolls when needed.</p>
      <button type="button" onClick={() => void copy()}>Copy embed code</button>
      <label>Embed HTML<textarea readOnly value={code} rows={4} /></label>
      {copyStatus && <p role="status">{copyStatus}</p>}
    </details>
  </main>
}
