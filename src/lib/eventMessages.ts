import type { Event, Field, Site, Team, User } from './types'
import { formatMessageDate, formatMessageDuration, requestMessageClosing, type MessageLanguage } from './facilityWorkflow'
import { formatEventTimeRange } from './utils'
import { formatSharedFieldBookings } from './fieldSharing'
import { renderTemplate, type MessageTemplateContent } from '../../server/message-template-domain.mjs'

export type EventMessageAction = 'create' | 'update' | 'cancel' | 'share' | 'transport'
export type MessageAuthor = Pick<User, 'username' | 'fullName'>
export interface EventMessageDraft { subject: string; message: string }

export function eventMessageDraft(
  event: Event, originalEvent: Event | null, action: EventMessageAction,
  teams: Team[], fields: Field[], sites: Site[], currentUser: MessageAuthor,
  language: MessageLanguage = 'en',
  templates: readonly MessageTemplateContent[] = [],
): EventMessageDraft {
  const text = (english: string, german: string) => language === 'de' ? german : english
  const types = { Game: 'Spiel', Practice: 'Training', Meeting: 'Besprechung', Other: 'Sonstiges' }
  const statuses = { Planned: 'Geplant', Confirmed: 'Bestätigt', Cancelled: 'Abgesagt', Completed: 'Abgeschlossen' }
  const details = (value: Event) => {
    const eventFields = (value.fieldIds || []).flatMap(id => fields.filter(field => field.id === id))
    const site = sites.find(site => site.id === eventFields[0]?.siteId)
    const awayAddress = [value.awayStreet, value.awayZip, value.awayCity].filter(Boolean).join(', ')
    const location = value.gameLocation === 'away' ? awayAddress : eventFields
      .map(field => [sites.find(site => site.id === field.siteId)?.name, field.name].filter(Boolean).join(' - ')).join(', ')
    const teamNames = (value.teamIds || []).map(id => teams.find(team => team.id === id)?.name
      || `Team ${id}`).join('\n- ') || text('No teams assigned', 'Keine Teams zugewiesen')
    return [
      [text('Event', 'Veranstaltung'), value.title || (language === 'de' ? types[value.eventType] : value.eventType)],
      [text('Type', 'Typ'), language === 'de' ? types[value.eventType] : value.eventType],
      [text('Date', 'Datum'), formatMessageDate(value.date, language)],
      [text('Time', 'Zeit'), value.endDate && value.endDate !== value.date
        ? `${value.startTime} - ${formatMessageDate(value.endDate, language)} ${value.endTime}` : formatEventTimeRange(value)],
      [text('Location', 'Ort'), location || text('TBD', 'Noch offen')],
      [text('Address', 'Adresse'), value.gameLocation === 'away' ? awayAddress
        : site && [site.address, site.zipCode, site.city].filter(Boolean).join(', ')],
      [text('Team(s)', 'Team(s)'), value.teamIds?.length ? `\n- ${teamNames}` : teamNames],
      [text('Status', 'Status'), language === 'de' ? statuses[value.status] : value.status],
      [text('Notes', 'Notizen'), value.notes || ''],
    ] as const
  }
  const current = details(event)
  let changeDetails = ''
  if (action === 'update' && originalEvent) {
    const previous = details(originalEvent)
    const changes = current.flatMap(([label, after], index) => {
      const before = previous[index][1]
      return before === after ? [] : [`${label}:\n  ${text('Before', 'Vorher')}: ${before || text('None', 'Keine')}\n  ${text('After', 'Nachher')}: ${after || text('None', 'Keine')}`]
    })
    if (changes.length) changeDetails = `\n\n${text('CHANGES', 'ÄNDERUNGEN')}:\n${changes.join('\n\n')}`
  }
  let message = current.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n')
  const duration = (Date.parse(`${event.endDate || event.date}T${event.endTime}:00Z`)
    - Date.parse(`${event.date}T${event.startTime}:00Z`)) / 60000
  message += `\n${text('Scheduled duration', 'Geplante Dauer')}: ${formatMessageDuration(duration, language)}`
  if (event.sharedFieldBookings?.length) {
    message += `\n\n${text('Shared field - full field not exclusively available.',
      'Gemeinsam genutztes Spielfeld - das gesamte Spielfeld steht nicht exklusiv zur Verfügung.')}\n${formatSharedFieldBookings(event.sharedFieldBookings, fields, sites, teams, language)}`
  }
  return renderTemplate(`event.${action}`, language, {
    event_title: current[0][1], details: message, changes: changeDetails,
    closing: requestMessageClosing(currentUser, language, templates),
  }, templates)
}
