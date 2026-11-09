import type { AttendanceCounts } from '@/lib/attendance'

export default function AttendanceSummary({ counts }: { counts?: AttendanceCounts }) {
  return <span className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs tabular-nums">
    <span className="text-green-800"><strong>{counts?.confirmed ?? '--'}</strong> confirmed</span>
    <span aria-hidden="true">|</span>
    <span className="text-amber-800"><strong>{counts?.unanswered ?? '--'}</strong> unanswered</span>
    <span aria-hidden="true">|</span>
    <span className="text-red-700"><strong>{counts?.declined ?? '--'}</strong> declined</span>
    {!counts && <span className="text-muted-foreground">(unavailable)</span>}
  </span>
}
