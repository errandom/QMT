const TEAM_COLORS = [
  { foreground: '#1d4ed8', background: '#eff6ff' },
  { foreground: '#0f766e', background: '#f0fdfa' },
  { foreground: '#6d28d9', background: '#f5f3ff' },
  { foreground: '#be123c', background: '#fff1f2' },
  { foreground: '#92400e', background: '#fffbeb' },
  { foreground: '#155e75', background: '#ecfeff' },
  { foreground: '#4338ca', background: '#eef2ff' },
  { foreground: '#166534', background: '#f0fdf4' },
  { foreground: '#86198f', background: '#fdf4ff' },
  { foreground: '#334155', background: '#f1f5f9' },
  { foreground: '#9a3412', background: '#fff7ed' },
  { foreground: '#7e22ce', background: '#faf5ff' },
]

export function getTeamColor(teamId: string) {
  const numericId = /^\d+$/.test(teamId) ? Number(teamId) : NaN
  let hash = 0
  for (const character of teamId) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
  const identity = Number.isSafeInteger(numericId) ? numericId : hash
  return TEAM_COLORS[identity % TEAM_COLORS.length]
}
