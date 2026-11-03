import type { FacilityRequest, MeetingRoomDetails } from './types'

export const meetingRoomWorksheet = 'Nebenräume Im Birch, monatlich'
export const meetingRoomColumns = [
  'F: Anlageteil', 'G: Wochentag', 'H: Datum', 'I: Belegungszeit', 'J: Anlass',
  'K: Verein', 'L: Anzahl Teilnehmer', 'M: Verantwortliche Person vor Ort', 'N: Kommentare Verein',
]

function excelText(value: string): string {
  const text = value.replace(/[\t\r\n\u0000-\u001f\u007f]/g, ' ').trim()
  // Keep user-supplied text in a single cell and prevent Excel formula interpretation.
  return /^[=+\-@]/.test(text) ? `'${text}` : text
}

export function meetingRoomRows(request: FacilityRequest, details: MeetingRoomDetails, dates: string[]): string[][] {
  const [hour, minute] = request.startTime.split(':').map(Number)
  const end = hour * 60 + minute + request.duration
  if (!dates.length || !Number.isFinite(end) || end >= 1440) {
    throw new Error('Workbook rows need requested dates and a time slot ending before midnight')
  }
  const endTime = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
  return dates.map(date => {
    const day = new Date(`${date}T00:00:00Z`)
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) {
      throw new Error('A requested workbook date is invalid')
    }
    const [year, month, dateOfMonth] = date.split('-')
    return [
      excelText(details.room),
      ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'][day.getUTCDay()],
      `${dateOfMonth}.${month}.${year}`,
      `${request.startTime} - ${endTime}`,
      excelText(details.occasion), excelText(details.club), String(details.participants),
      excelText(`${details.responsibleName}, ${details.responsiblePhone}, ${details.responsibleEmail}`),
      excelText(details.comments),
    ]
  })
}

export function meetingRoomTsv(rows: string[][]): string {
  return rows.map(row => row.map(value =>
    value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value
  ).join('\t')).join('\n')
}
