import * as XLSX from 'xlsx'
import { Event, Team, Field, Site } from './types'

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

    // Get field and site info
    const field = event.fieldId ? data.fields.find(f => f.id === event.fieldId) : null
    const site = field ? data.sites.find(s => s.id === field.siteId) : null

    return {
      'Event Title': event.title || '',
      'Event Type': event.eventType || '',
      'Status': event.status || '',
      'Date': formatDate(event.date),
      'Start Time': formatTime(event.startTime),
      'End Time': formatTime(event.endTime),
      'Team(s)': teamNames,
      'Other Participants': event.otherParticipants || '',
      'Estimated Attendance': event.estimatedAttendance || '',
      'Field': field?.name || '',
      'Site': site?.name || '',
      'Site Address': site ? `${site.address}, ${site.city} ${site.zipCode}` : '',
      'Recurring': event.isRecurring ? 'Yes' : 'No',
      'Notes': event.notes || ''
    }
  })
}

/**
 * Generate and download Excel file from events
 */
export function exportToExcel(
  events: Event[],
  data: ExportData,
  filters: ExportFilters,
  filename?: string
): void {
  // Filter events
  const filteredEvents = filterEventsForExport(events, filters)

  if (filteredEvents.length === 0) {
    throw new Error('No events match the selected filters')
  }

  // Transform to export rows
  const rows = transformEventsForExport(filteredEvents, data)

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Set column widths for better readability
  const columnWidths = [
    { wch: 30 }, // Event Title
    { wch: 12 }, // Event Type
    { wch: 12 }, // Status
    { wch: 14 }, // Date
    { wch: 10 }, // Start Time
    { wch: 10 }, // End Time
    { wch: 25 }, // Team(s)
    { wch: 20 }, // Other Participants
    { wch: 18 }, // Estimated Attendance
    { wch: 20 }, // Field
    { wch: 20 }, // Site
    { wch: 35 }, // Site Address
    { wch: 10 }, // Recurring
    { wch: 40 }, // Notes
  ]
  ws['!cols'] = columnWidths

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Schedule')

  // Generate filename with date range
  const defaultFilename = generateFilename(filters)
  const finalFilename = filename || defaultFilename

  // Download the file
  XLSX.writeFile(wb, `${finalFilename}.xlsx`)
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
