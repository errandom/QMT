import type { CancellationRequest, EquipmentRequest, EventType, FacilityRequest, FacilityRouting, FacilityWorkflowStage, Field, Site, Team, User } from './types'
import { renderTemplate, renderTemplateSubject, type MessageTemplateContent } from '../../server/message-template-domain.mjs'

export type MessageLanguage = 'en' | 'de'

export function formatMessageDate(value: string, language: MessageLanguage = 'en'): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(language === 'de' ? 'de-CH' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

export function formatMessageDuration(minutes: number, language: MessageLanguage = 'en'): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const unit = (value: number, english: string, german: string, plural: string) =>
    `${value} ${language === 'de' ? (value === 1 ? german : plural) : `${english}${value === 1 ? '' : 's'}`}`
  return [
    hours && unit(hours, 'hour', 'Stunde', 'Stunden'),
    (rest || !hours) && unit(rest, 'minute', 'Minute', 'Minuten'),
  ].filter(Boolean).join(' ')
}

function requestTimeRange(request: FacilityRequest, language: MessageLanguage): string {
  const [hours, minutes] = request.startTime.split(':').map(Number)
  const end = hours * 60 + minutes + request.duration
  const endTime = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
  const days = Math.floor(end / 1440)
  const nextDay = days ? ` (+${days} ${language === 'de' ? (days === 1 ? 'Tag' : 'Tage') : (days === 1 ? 'day' : 'days')})` : ''
  return `${request.startTime} - ${endTime}${nextDay}`
}

function messageEventType(type: EventType, language: MessageLanguage): string {
  const german: Record<EventType, string> = { Game: 'Spiel', Practice: 'Training', Meeting: 'Besprechung', Other: 'Sonstiges' }
  return language === 'de' ? german[type] : type
}

export function facilityTemplateKey(request: FacilityRequest, action: 'acknowledge' | 'send' | 'notify' | 'followup'): string {
  return `facility.${action === 'send' ? 'inquiry' : action === 'notify' ? request.status === 'Approved' ? 'approved' : 'rejected' : action}`
}

export function facilityMessageSubject(request: FacilityRequest, language: MessageLanguage = 'en', templates: readonly MessageTemplateContent[] = [], action: 'acknowledge' | 'send' | 'notify' | 'followup' = 'acknowledge'): string {
  const subject = language === 'de'
    ? `Anfrage zur Anlagennutzung #${request.id} - ${messageEventType(request.eventType, language)}, ${formatMessageDate(request.date, language)}`
    : `Facility request #${request.id} - ${request.eventType}, ${formatMessageDate(request.date, language)}`
  return renderTemplateSubject(facilityTemplateKey(request, action), language, { facility_subject: subject, requester_name: request.requestorName }, templates)
}

export function facilityRoutingDefaults(locationType: FacilityRouting['locationType'], environment?: FacilityRouting['facilityEnvironment']): Pick<FacilityRouting, 'route' | 'department' | 'contactEmail'> {
  if (locationType === 'meeting_room') return { route: 'IGACR', department: 'IGACR workbook - Im Birch', contactEmail: '' }
  if (environment) return {
    route: 'ZVIS', department: environment === 'outdoor' ? 'Misenga Gossweiler' : 'André da Silva',
    contactEmail: 'bewilligungen@zvis.ch',
  }
  return { route: 'City of Zurich', department: '', contactEmail: '' }
}

export function facilityStage(request: FacilityRequest): FacilityWorkflowStage {
  return request.status === 'Pending' ? request.workflow?.stage || 'Received' : request.status
}

export function needsFacilityAttention(request: FacilityRequest): boolean {
  return request.status === 'Pending' || Boolean(request.workflow && !request.workflow.outcomeNotifiedAt)
}

export function facilityLocations(request: FacilityRequest, fields: Field[], sites: Site[]) {
  const type = request.workflow?.locationType || request.locationType
  return fields.filter(field =>
    field.isActive && sites.some(site => site.id === field.siteId && site.isActive) &&
    (field.locationType || 'field') === type
  ).map(field => ({
    id: field.id,
    name: `${sites.find(site => site.id === field.siteId)?.name} - ${field.name}`,
  }))
}

export function requestMessageSignature(user: Pick<User, 'username' | 'fullName'>, language: MessageLanguage = 'en', templates: readonly MessageTemplateContent[] = []): string {
  const username = user.username.trim()
  const name = username.toLowerCase() === 'qmtadmin' ? 'Kenny' : user.fullName?.trim() || username
  return renderTemplate('shared.signature', language, { sender_name: name }, templates).message
}

export function requestMessageClosing(user: Pick<User, 'username' | 'fullName'>, language: MessageLanguage = 'en', templates: readonly MessageTemplateContent[] = []): string {
  return renderTemplate('shared.closing', language, { signature: requestMessageSignature(user, language, templates) }, templates).message
}

export function facilityMessage(
  request: FacilityRequest, action: 'acknowledge' | 'send' | 'notify' | 'followup',
  teams: Team[], fields: Field[], sites: Site[], currentUser: Pick<User, 'username' | 'fullName'>,
  language: MessageLanguage = 'en',
  templates: readonly MessageTemplateContent[] = [],
): string {
  const closing = requestMessageClosing(currentUser, language, templates)
  const text = (english: string, german: string) => language === 'de' ? german : english
  const dates = (values: string[]) => values.length
    ? `\n${values.map(value => `- ${formatMessageDate(value, language)}`).join('\n')}`
    : ` ${text('None', 'Keine')}`
  const locationType = request.workflow?.locationType || request.locationType
  const weekdayNames = language === 'de'
    ? ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const details = [
    `${text('Request', 'Anfrage')} #${request.id}: ${messageEventType(request.eventType, language)}`,
    `${text('Date', 'Datum')}: ${formatMessageDate(request.date, language)}`,
    `${text('Time', 'Zeit')}: ${requestTimeRange(request, language)}`,
    `${text('Duration', 'Dauer')}: ${formatMessageDuration(request.duration, language)}`,
    request.recurrence && [
      `${text('Weekly series through', 'Wöchentliche Serie bis')}: ${formatMessageDate(request.recurrence.until, language)}`,
      `${text('Weekdays', 'Wochentage')}: ${request.recurrence.weekdays.map(day => weekdayNames[day - 1]).join(', ')}`,
      `${text('Skip dates', 'Ausgenommene Daten')}:${dates(request.recurrence.excludedDates)}`,
    ].join('\n'),
    `${text('Facility type', 'Anlagentyp')}: ${(request.workflow?.locationType || request.locationType) === 'meeting_room' ? text('Meeting room', 'Besprechungsraum') :
      (request.workflow?.locationType || request.locationType) === 'field' ? text('Field', 'Spielfeld') : text('To be clarified', 'Noch zu klären')}`,
    request.workflow?.facilityEnvironment && `${text('Environment', 'Umgebung')}: ${text(request.workflow.facilityEnvironment,
      request.workflow.facilityEnvironment === 'indoor' ? 'Innenbereich' : 'Aussenbereich')}`,
    request.teamIds?.length && `\nTeams:\n${request.teamIds.map(id => `- ${teams.find(team => team.id === id)?.name || `Team ${id}`}`).join('\n')}`,
    request.purpose && `${text('Purpose', 'Zweck')}: ${request.purpose}`,
    request.opponent && `${text('Opponent', 'Gegner')}: ${request.opponent}`,
    request.description && `\n${text('Additional details', 'Weitere Angaben')}:\n${request.description}`,
  ].filter(Boolean).join('\n')
  const values = {
    closing, details, requester_name: request.requestorName,
    facility_subject: facilityMessageSubject(request, language),
    reference: request.workflow?.reference ? `\n${text('Reference', 'Referenz')}: ${request.workflow.reference}` : '',
  }
  const render = (extra: Record<string, string> = {}) => renderTemplate(facilityTemplateKey(request, action), language, { ...values, ...extra }, templates).message
  if (action === 'followup') {
    return render()
  }
  if (action === 'acknowledge') {
    return render()
  }
  if (action === 'send') {
    const contact = (['indoor', 'outdoor'] as const).map(environment =>
      facilityRoutingDefaults('field', environment).department)
      .find(name => name === request.workflow?.department)?.split(' ')[0]
    return render({
      contact_name: contact || text('everyone', 'zusammen'), contact_pronoun: contact ? 'dich' : 'euch', contact_verb: contact ? 'teil' : 'teilt',
      facility_type: locationType === 'meeting_room' ? text('meeting-room', 'einen Besprechungsraum') : locationType === 'field' ? text('field', 'ein Spielfeld') : text('facility', 'eine Anlage'),
      permit_note: request.eventType === 'Game' ? text('\n\nPlease also flag any separate approvals needed for goods, drinks, food, music or other activities. Facility approval alone is not confirmation of these permits.', '\n\nBitte auch separat erforderliche Bewilligungen für Waren, Getränke, Speisen, Musik oder andere Aktivitäten angeben. Eine Anlagenzuteilung bestätigt diese Bewilligungen nicht.') : '',
    })
  }
  const field = fields.find(item => item.id === request.workflow?.approvedFieldId)
  if (language === 'de') {
    const allocation = field
      ? `${sites.find(site => site.id === field.siteId)?.name || 'Standort'} - ${field.name}`
      : 'Kein Ort erfasst; die Zuteilung muss noch bestätigt werden.'
    const decision = request.status === 'Approved'
      ? `Deine Anfrage zur Nutzung einer Anlage wurde genehmigt.${request.workflow?.approvedDates
        ? `\nGenehmigte Daten:${dates(request.workflow.approvedDates)}\nNicht genehmigte Daten:${dates(request.workflow.excludedDates || [])}\nNur die aufgeführten genehmigten Daten sind gebucht.`
        : request.workflow?.bookingEventId ? '\nEine Buchung für das unten angegebene Datum und die Uhrzeit wurde erstellt. Weitere Daten oder zusätzliche Buchungen benötigen eine separate Bestätigung.' : ''}\nOrt: ${allocation}${!field ? '\nDie Buchung ist keine bestätigte Ortszuteilung.' : ''}`
      : 'Leider können wir deine Anfrage zur Nutzung einer Anlage nicht genehmigen.'
    return render({ decision, conditions: request.workflow?.decisionNote ? `\n\nEntscheid / Bedingungen:\n${request.workflow.decisionNote}` : '', permit_note: request.eventType === 'Game' ? '\n\nSeparat erforderliche Spielbewilligungen müssen weiterhin geprüft werden.' : '' })
  }
  const allocation = field
    ? `${sites.find(site => site.id === field.siteId)?.name || 'Site'} - ${field.name}`
    : 'No location recorded; allocation must still be confirmed.'
  const decision = request.status === 'Approved'
    ? `Your facility request has been approved.${request.workflow?.approvedDates
      ? `\nApproved dates:${dates(request.workflow.approvedDates)}\nDates not approved:${dates(request.workflow.excludedDates || [])}\nOnly the listed approved dates are booked.`
      : request.workflow?.bookingEventId ? '\nOne booking has been created for the date and time below. Other dates or additional bookings require separate confirmation.' : ''}\nLocation: ${allocation}${!field ? '\nThe booking is not a confirmed location allocation.' : ''}`
    : "Sorry, we can't approve your facility request."
  return render({ decision, conditions: request.workflow?.decisionNote ? `\n\nDecision / conditions:\n${request.workflow.decisionNote}` : '', permit_note: request.eventType === 'Game' ? '\n\nAny separate game permits still need to be verified.' : '' })
}

export function requestRejectionMessage(
  request: FacilityRequest | EquipmentRequest | CancellationRequest,
  type: 'facility' | 'equipment' | 'cancellation',
  currentUser: Pick<User, 'username' | 'fullName'>,
  language: MessageLanguage = 'en',
  templates: readonly MessageTemplateContent[] = [],
): string {
  const text = (english: string, german: string) => language === 'de' ? german : english
  let message = `📋 ${text('Request Details', 'Angaben zur Anfrage')}:\n`
  if ('eventType' in request) {
    message += `• ${text('Type', 'Typ')}: ${messageEventType(request.eventType, language)}\n`
    message += `• ${text('Date', 'Datum')}: ${formatMessageDate(request.date, language)}\n`
    message += `• ${text('Time', 'Zeit')}: ${requestTimeRange(request, language)} (${formatMessageDuration(request.duration, language)})\n`
    if (request.purpose) message += `• ${text('Purpose', 'Zweck')}: ${request.purpose}\n`
  } else if ('equipmentDescription' in request) {
    message += `• ${text('Equipment', 'Ausrüstung')}: ${request.equipmentDescription}\n`
    message += `• ${text('Date Needed', 'Benötigt am')}: ${formatMessageDate(request.date, language)}\n`
  } else {
    message += `• ${text('Event', 'Veranstaltung')}: ${request.eventTitle}\n`
    message += `• ${text('Date', 'Datum')}: ${formatMessageDate(request.eventDate, language)}\n`
    message += `• ${text('Time', 'Zeit')}: ${request.eventTime}\n`
  }
  return renderTemplate(`request.reject.${type}`, language, { details: message, requester_name: request.requestorName, closing: requestMessageClosing(currentUser, language, templates) }, templates).message
}
