import { useData } from '@/contexts/DataContext'
import { teamAttendanceTotal } from '@/lib/attendance'
import AttendanceSummary from '../AttendanceSummary'

export default function StatisticsManager() {
  const { events, teams, eventWindow, isLoading, error } = useData()
  const participatingTeams = teams.filter(team =>
    events.some(event => event.status !== 'Cancelled' && event.teamIds.includes(team.id)))

  return (
    <section className="rounded-xl border bg-white/70 p-4">
      <h2 className="font-semibold">Team attendance totals</h2>
      <p className="text-sm text-muted-foreground">
        Loaded schedule window: {eventWindow.from.slice(0, 10)} to {eventWindow.to.slice(0, 10)}
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Responses across non-cancelled events in this window, not unique players or all-time totals.
        Missing responses are not counted as zero.
      </p>
      {error ? <p role="alert">Attendance statistics are unavailable until the schedule is refreshed successfully.</p>
        : isLoading ? <p role="status">Loading attendance statistics...</p>
        : participatingTeams.length === 0 ? <p>No team attendance statistics available in the loaded schedule window.</p>
        : <div className="grid gap-3 sm:grid-cols-2">
          {participatingTeams.map(team => {
            const total = teamAttendanceTotal(events, team.id)
            return <div key={team.id} className="min-w-0 rounded-lg border p-2">
              <h3 className="text-sm font-medium">{team.name}</h3>
              <AttendanceSummary counts={total.counts} />
              <p className="text-xs text-muted-foreground">{total.covered}/{total.total} events with team counts
                {total.covered < total.total && ' · Incomplete total'}</p>
            </div>
          })}
        </div>}
    </section>
  )
}
