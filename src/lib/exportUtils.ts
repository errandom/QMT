import { Event, Team, Field, Site } from './types'

// Pure JavaScript CSV export - no external dependencies needed

export interface ExportFilters {
  teamIds: string[]
  eventTypes: string[]
  startDate: string
  endDate: string
}

export interface ExportData {
  events: Event[]
  teams: Team[]
  fields: Field[]
  sites: Site[]
}

export interface ExportRow {
  'Event Title': string
  'Event Type': string
  'Status': string
  'Weekday': string
  'Date': string
  'Start Time': string
  'End Time': string
  'Team(s)': string
  'Other Participants': string
  'Estimated Attendance': number | string
  'Field': string
  'Site': string
  'Site Address': string
  'Recurring': string
  'Notes': string
}

/**
 * Filter events based on export filters
 */
export function filterEventsForExport(
  events: Event[],
  filters: ExportFilters
): Event[] {
  let filtered = [...events]

  // Filter by teams
  if (filters.teamIds.length > 0) {
    filtered = filtered.filter(event =>
      event.teamIds && event.teamIds.some(tid => filters.teamIds.includes(tid))
    )
  }

  // Filter by event types
  if (filters.eventTypes.length > 0) {
    filtered = filtered.filter(event =>
      filters.eventTypes.includes(event.eventType)
    )
  }

  // Filter by date range
  if (filters.startDate) {
    filtered = filtered.filter(event => event.date >= filters.startDate)
  }
  if (filters.endDate) {
    filtered = filtered.filter(event => event.date <= filters.endDate)
  }

  // Sort by date and time
  filtered.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date)
    if (dateCompare !== 0) return dateCompare
    return a.startTime.localeCompare(b.startTime)
  })

  return filtered
}

/**
 * Format time string for display (e.g., "17:30" -> "5:30 PM")
 */
function formatTime(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

/**
 * Format date string for display (e.g., "2026-02-15" -> "Feb 15, 2026")
 */
function formatDate(date: string): string {
  if (!date) return ''
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Get weekday name from date string (e.g., "2026-02-15" -> "Sunday")
 */
function getWeekday(date: string): string {
  if (!date) return ''
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

/**
 * Transform filtered events into export-ready rows
 */
export function transformEventsForExport(
  events: Event[],
  data: ExportData
): ExportRow[] {
  return events.map(event => {
    // Get team names
    const teamNames = event.teamIds
      ? event.teamIds
          .map(tid => data.teams.find(t => t.id === tid)?.name)
          .filter(Boolean)
          .join(', ')
      : ''

    // Get field and site info - use fieldIds (array) instead of fieldId
    // Get the first field if multiple are assigned
    const fieldId = event.fieldIds && event.fieldIds.length > 0 ? event.fieldIds[0] : null
    const field = fieldId ? data.fields.find(f => f.id === fieldId) : null
    const site = field ? data.sites.find(s => s.id === field.siteId) : null
    
    // If multiple fields, show all field names
    const fieldNames = event.fieldIds && event.fieldIds.length > 0
      ? event.fieldIds
          .map(fid => data.fields.find(f => f.id === fid)?.name)
          .filter(Boolean)
          .join(', ')
      : ''
    
    // Get all unique sites from all assigned fields
    const siteNames: string[] = []
    const siteAddresses: string[] = []
    if (event.fieldIds && event.fieldIds.length > 0) {
      const seenSiteIds = new Set<string>()
      for (const fid of event.fieldIds) {
        const f = data.fields.find(field => field.id === fid)
        if (f && !seenSiteIds.has(f.siteId)) {
          seenSiteIds.add(f.siteId)
          const s = data.sites.find(site => site.id === f.siteId)
          if (s) {
            siteNames.push(s.name)
            siteAddresses.push(`${s.address || ''}, ${s.city || ''} ${s.zipCode || ''}`.trim())
          }
        }
      }
    }

    return {
      'Event Title': event.title || '',
      'Event Type': event.eventType || '',
      'Status': event.status || '',
      'Weekday': getWeekday(event.date),
      'Date': formatDate(event.date),
      'Start Time': formatTime(event.startTime),
      'End Time': formatTime(event.endTime),
      'Team(s)': teamNames,
      'Other Participants': event.otherParticipants || '',
      'Estimated Attendance': event.estimatedAttendance || '',
      'Field': fieldNames,
      'Site': siteNames.join(', '),
      'Site Address': siteAddresses.join(' | '),
      'Recurring': event.isRecurring ? 'Yes' : 'No',
      'Notes': event.notes || ''
    }
  })
}

/**
 * Escape a value for CSV (handle commas, quotes, newlines)
 */
function escapeCSV(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Generate and download CSV file from events
 */
export async function exportToExcel(
  events: Event[],
  data: ExportData,
  filters: ExportFilters,
  filename?: string
): Promise<void> {
  // Filter events
  const filteredEvents = filterEventsForExport(events, filters)

  if (filteredEvents.length === 0) {
    throw new Error('No events match the selected filters')
  }

  // Transform to export rows
  const rows = transformEventsForExport(filteredEvents, data)

  // CSV headers
  const headers = [
    'Event Title',
    'Event Type',
    'Status',
    'Weekday',
    'Date',
    'Start Time',
    'End Time',
    'Team(s)',
    'Other Participants',
    'Estimated Attendance',
    'Field',
    'Site',
    'Site Address',
    'Recurring',
    'Notes'
  ]

  // Build CSV content
  const csvLines: string[] = []
  
  // Add header row
  csvLines.push(headers.map(h => escapeCSV(h)).join(','))
  
  // Add data rows
  for (const row of rows) {
    const values = headers.map(header => escapeCSV(row[header as keyof typeof row]))
    csvLines.push(values.join(','))
  }

  const csvContent = csvLines.join('\n')

  // Generate filename with date range
  const defaultFilename = generateFilename(filters)
  const finalFilename = filename || defaultFilename

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${finalFilename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate a descriptive filename based on filters
 */
function generateFilename(filters: ExportFilters): string {
  const parts = ['Schedule_Export']

  if (filters.startDate && filters.endDate) {
    parts.push(`${filters.startDate}_to_${filters.endDate}`)
  } else if (filters.startDate) {
    parts.push(`from_${filters.startDate}`)
  } else if (filters.endDate) {
    parts.push(`until_${filters.endDate}`)
  }

  const timestamp = new Date().toISOString().split('T')[0]
  parts.push(timestamp)

  return parts.join('_')
}
