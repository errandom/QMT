import type { Event, Field, Site, Team, User } from './types'
import { requestMessageSignature, type MessageLanguage } from './facilityWorkflow'
import { formatEventTimeRange } from './utils'
import { formatSharedFieldBookings } from './fieldSharing'

export type EventMessageAction = 'create' | 'update' | 'cancel' | 'share' | 'transport'
export type MessageAuthor = Pick<User, 'username' | 'fullName'>
export interface EventMessageDraft { subject: string; message: string }

export function eventMessageDraft(
  event: Event, originalEvent: Event | null, action: EventMessageAction,
  teams: Team[], fields: Field[], sites: Site[], currentUser: MessageAuthor,
  language: MessageLanguage = 'en',
): EventMessageDraft {
  const text = (english: string, german: string) => language === 'de' ? german : english
  const types = { Game: 'Spiel', Practice: 'Training', Meeting: 'Besprechung', Other: 'Sonstiges' }
  const statuses = { Planned: 'Geplant', Confirmed: 'Bestätigt', Cancelled: 'Abgesagt', Completed: 'Abgeschlossen' }
  const date = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString(
    language === 'de' ? 'de-CH' : 'en-US',
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' },
  )
  const details = (value: Event) => {
    const eventFields = (value.fieldIds || []).flatMap(id => fields.filter(field => field.id === id))
    const site = sites.find(site => site.id === eventFields[0]?.siteId)
    const awayAddress = [value.awayStreet, value.awayZip, value.awayCity].filter(Boolean).join(', ')
    const location = value.gameLocation === 'away' ? awayAddress : eventFields
      .map(field => [sites.find(site => site.id === field.siteId)?.name, field.name].filter(Boolean).join(' - ')).join(', ')
    const teamNames = (value.teamIds || []).map(id => teams.find(team => team.id === id)?.name
      || text(`Team ${id}`, `Team ${id}`)).join(', ') || text('No teams assigned', 'Keine Teams zugewiesen')
    return [
      [text('Event', 'Veranstaltung'), value.title || (language === 'de' ? types[value.eventType] : value.eventType)],
      [text('Type', 'Typ'), language === 'de' ? types[value.eventType] : value.eventType],
      [text('Date', 'Datum'), date(value.date)],
      [text('Time', 'Zeit'), formatEventTimeRange(value)],
      [text('Location', 'Ort'), location || text('TBD', 'Noch offen')],
      [text('Address', 'Adresse'), value.gameLocation === 'away' ? awayAddress
        : site && [site.address, site.zipCode, site.city].filter(Boolean).join(', ')],
      [text('Team(s)', 'Team(s)'), teamNames],
      [text('Status', 'Status'), language === 'de' ? statuses[value.status] : value.status],
      [text('Notes', 'Notizen'), value.notes || ''],
    ] as const
  }
  const current = details(event)
  const prefix = {
    create: text('NEW', 'NEU'), update: text('UPDATE', 'AKTUALISIERUNG'),
    cancel: text('CANCELLED', 'ABGESAGT'), share: text('Event', 'Veranstaltung'),
    transport: text('Transport Request', 'Transportanfrage'),
  }[action]
  const subject = `${prefix}: ${current[0][1]}`
  let message = action === 'cancel'
    ? text('The following event has been CANCELLED:', 'Die folgende Veranstaltung wurde ABGESAGT:')
    : action === 'create'
      ? text('A new event has been created:', 'Eine neue Veranstaltung wurde erstellt:')
      : action === 'update'
        ? text('The following event has been UPDATED:', 'Die folgende Veranstaltung wurde AKTUALISIERT:')
        : action === 'transport'
          ? text('Dear Transport Team,\n\nWe would like to request transport for the following away game:',
            'Liebes Transportteam,\n\nWir möchten einen Transport für das folgende Auswärtsspiel anfragen:')
          : text('Event details for your reference:', 'Angaben zur Veranstaltung:')
  if (action === 'update' && originalEvent) {
    const previous = details(originalEvent)
    const changes = current.flatMap(([label, after], index) => {
      const before = previous[index][1]
      return before === after ? [] : [`${label}:\n  ${text('Before', 'Vorher')}: ${before || text('None', 'Keine')}\n  ${text('After', 'Nachher')}: ${after || text('None', 'Keine')}`]
    })
    if (changes.length) message += `\n\n${text('CHANGES', 'ÄNDERUNGEN')}:\n${changes.join('\n\n')}`
  }
  message += `\n\n${current.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n')}`
  const duration = (Date.parse(`${event.endDate || event.date}T${event.endTime}:00Z`)
    - Date.parse(`${event.date}T${event.startTime}:00Z`)) / 60000
  message += `\n${text('Scheduled duration', 'Geplante Dauer')}: ${duration} min`
  if (event.sharedFieldBookings?.length) {
    message += `\n\n${text('Shared field - full field not exclusively available.',
      'Gemeinsam genutztes Spielfeld - das gesamte Spielfeld steht nicht exklusiv zur Verfügung.')}\n${formatSharedFieldBookings(event.sharedFieldBookings, fields, sites, teams, language)}`
  }
  if (action === 'cancel') message += `\n\n${text('We apologize for any inconvenience.', 'Wir entschuldigen uns für die Unannehmlichkeiten.')}`
  message += `\n\n${action === 'transport'
    ? text('Please confirm availability and provide details for the transport arrangement.',
      'Bitte bestätigt die Verfügbarkeit und teilt uns die Details zur Organisation des Transports mit.')
    : text('Please let us know if you have any questions.', 'Bei Fragen könnt ihr euch gerne bei uns melden.')}`
  return { subject, message: `${message}\n\n${requestMessageSignature(currentUser)}` }
}
