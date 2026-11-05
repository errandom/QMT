import type { CancellationRequest, EquipmentRequest, EventType, FacilityRequest, FacilityRouting, FacilityWorkflowStage, Field, Site, Team, User } from './types'

export type MessageLanguage = 'en' | 'de'

function messageEventType(type: EventType, language: MessageLanguage): string {
  const german: Record<EventType, string> = { Game: 'Spiel', Practice: 'Training', Meeting: 'Besprechung', Other: 'Sonstiges' }
  return language === 'de' ? german[type] : type
}

export function facilityMessageSubject(request: FacilityRequest, language: MessageLanguage = 'en'): string {
  return language === 'de'
    ? `Anfrage zur Anlagennutzung #${request.id} - ${messageEventType(request.eventType, language)}, ${request.date}`
    : `Facility request #${request.id} - ${request.eventType}, ${request.date}`
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

export function requestMessageSignature(user: Pick<User, 'username' | 'fullName'>): string {
  const username = user.username.trim()
  const name = username.toLowerCase() === 'qmtadmin' ? 'Kenny' : user.fullName?.trim() || username
  return `Quick - Mean - Tough\n${name}`
}

export function facilityMessage(
  request: FacilityRequest, action: 'acknowledge' | 'send' | 'notify' | 'followup',
  teams: Team[], fields: Field[], sites: Site[], currentUser: Pick<User, 'username' | 'fullName'>,
  language: MessageLanguage = 'en',
): string {
  const signature = requestMessageSignature(currentUser)
  const text = (english: string, german: string) => language === 'de' ? german : english
  const details = [
    `${text('Request', 'Anfrage')} #${request.id}: ${messageEventType(request.eventType, language)}`,
    text(`Date: ${request.date}; start: ${request.startTime}; duration: ${request.duration} minutes`,
      `Datum: ${request.date}; Beginn: ${request.startTime}; Dauer: ${request.duration} Minuten`),
    request.recurrence && text(
      `Weekly series through ${request.recurrence.until}; weekdays (Mon=1): ${request.recurrence.weekdays.join(', ')}; skip dates: ${request.recurrence.excludedDates.join(', ') || 'None'}`,
      `Wöchentliche Serie bis ${request.recurrence.until}; Wochentage (Mo=1): ${request.recurrence.weekdays.join(', ')}; ausgenommene Daten: ${request.recurrence.excludedDates.join(', ') || 'Keine'}`),
    `${text('Facility type', 'Anlagentyp')}: ${(request.workflow?.locationType || request.locationType) === 'meeting_room' ? text('Meeting room', 'Besprechungsraum') :
      (request.workflow?.locationType || request.locationType) === 'field' ? text('Field', 'Spielfeld') : text('To be clarified', 'Noch zu klären')}`,
    request.workflow?.facilityEnvironment && `${text('Environment', 'Umgebung')}: ${text(request.workflow.facilityEnvironment,
      request.workflow.facilityEnvironment === 'indoor' ? 'Innenbereich' : 'Aussenbereich')}`,
    request.teamIds?.length && `Teams: ${request.teamIds.map(id => teams.find(team => team.id === id)?.name || `Team ${id}`).join(', ')}`,
    request.purpose && `${text('Purpose', 'Zweck')}: ${request.purpose}`,
    request.opponent && `${text('Opponent', 'Gegner')}: ${request.opponent}`,
    request.description && `${text('Additional details', 'Weitere Angaben')}: ${request.description}`,
  ].filter(Boolean).join('\n')
  if (action === 'followup') {
    return `${text('Hello,\n\nI am following up on the facility request below. Please let us know the current status, any outstanding questions or changes needed.',
      'Guten Tag,\n\nIch möchte mich nach dem aktuellen Stand der folgenden Anfrage zur Anlagennutzung erkundigen. Bitte teilen Sie uns offene Fragen oder notwendige Änderungen mit.')}\n\n${details}${request.workflow?.reference ? `\n${text('Reference', 'Referenz')}: ${request.workflow.reference}` : ''}\n\n${signature}`
  }
  if (action === 'acknowledge') {
    if (language === 'de') return `Hallo ${request.requestorName},\n\nWir haben deine Anfrage zur Nutzung einer Anlage erhalten und werden sie prüfen. Diese Eingangsbestätigung ist keine Buchungsbestätigung. Wir informieren dich über das Ergebnis.\n\n${details}\n\n${signature}`
    return `Hi ${request.requestorName},\n\nWe have received your facility request and will evaluate it. This acknowledgment is not a booking confirmation. We will let you know the outcome.\n\n${details}\n\n${signature}`
  }
  if (action === 'send') {
    if (language === 'de') return `Guten Tag${request.workflow?.department ? ` ${request.workflow.department}` : ''},\n\nBitte prüfen Sie die folgende Anfrage für ${request.workflow?.locationType === 'meeting_room' ? 'einen Besprechungsraum' : 'ein Spielfeld'} und bestätigen Sie die Verfügbarkeit, Zuteilung und allfällige Bedingungen.\n\n${details}${request.workflow?.reference ? `\nReferenz: ${request.workflow.reference}` : ''}${request.eventType === 'Game' ? '\n\nBitte weisen Sie auch auf separat erforderliche Bewilligungen für Waren, Getränke, Speisen, Musik oder andere Aktivitäten hin. Eine Anlagenzuteilung bestätigt diese Bewilligungen nicht.' : ''}\n\nBitte teilen Sie uns Ihren Entscheid, die Bedingungen und allfällige Änderungen der gewünschten Zeit oder des Orts mit.\n\n${signature}`
    return `Hello${request.workflow?.department ? ` ${request.workflow.department}` : ''},\n\nPlease evaluate the following ${request.workflow?.locationType === 'meeting_room' ? 'meeting-room' : 'field'} request and confirm availability, allocation and any conditions.\n\n${details}${request.workflow?.reference ? `\nReference: ${request.workflow.reference}` : ''}${request.eventType === 'Game' ? '\n\nPlease also identify any separate approvals to consider for goods, drinks, food, music or other activities. Facility approval alone is not confirmation of these permits.' : ''}\n\nPlease reply with your decision, conditions and any changes to the requested slot or location.\n\n${signature}`
  }
  const field = fields.find(item => item.id === request.workflow?.approvedFieldId)
  if (language === 'de') {
    const allocation = field
      ? `${sites.find(site => site.id === field.siteId)?.name || 'Standort'} - ${field.name}`
      : 'Kein Ort erfasst; die Zuteilung muss noch bestätigt werden.'
    const decision = request.status === 'Approved'
      ? `Deine Anfrage zur Nutzung einer Anlage wurde genehmigt.${request.workflow?.approvedDates
        ? `\nGenehmigte Daten: ${request.workflow.approvedDates.join(', ')}.\nNicht genehmigte Daten: ${request.workflow.excludedDates?.join(', ') || 'Keine'}. Nur die aufgeführten genehmigten Daten sind gebucht.`
        : request.workflow?.bookingEventId ? '\nEine Buchung für das unten angegebene Datum und die Uhrzeit wurde erstellt. Weitere Daten oder zusätzliche Buchungen benötigen eine separate Bestätigung.' : ''}\nOrt: ${allocation}${!field ? '\nDie Buchung ist keine bestätigte Ortszuteilung.' : ''}`
      : 'Deine Anfrage zur Nutzung einer Anlage wurde geprüft und kann nicht genehmigt werden.'
    return `Hallo ${request.requestorName},\n\n${decision}\n\n${details}${request.workflow?.decisionNote ? `\n\nEntscheid / Bedingungen:\n${request.workflow.decisionNote}` : ''}${request.eventType === 'Game' ? '\n\nSeparat erforderliche Spielbewilligungen müssen weiterhin geprüft werden.' : ''}\n\n${signature}`
  }
  const allocation = field
    ? `${sites.find(site => site.id === field.siteId)?.name || 'Site'} - ${field.name}`
    : 'No location recorded; allocation must still be confirmed.'
  const decision = request.status === 'Approved'
    ? `Your facility request has been approved.${request.workflow?.approvedDates
      ? `\nApproved dates: ${request.workflow.approvedDates.join(', ')}.\nDates not approved: ${request.workflow.excludedDates?.join(', ') || 'None'}. Only the listed approved dates are booked.`
      : request.workflow?.bookingEventId ? '\nOne booking has been created for the date and time below. Other dates or additional bookings require separate confirmation.' : ''}\nLocation: ${allocation}${!field ? '\nThe booking is not a confirmed location allocation.' : ''}`
    : 'Your facility request has been reviewed and cannot be approved.'
  return `Hi ${request.requestorName},\n\n${decision}\n\n${details}${request.workflow?.decisionNote ? `\n\nDecision / conditions:\n${request.workflow.decisionNote}` : ''}${request.eventType === 'Game' ? '\n\nAny separate game permits still need to be verified.' : ''}\n\n${signature}`
}

export function requestRejectionMessage(
  request: FacilityRequest | EquipmentRequest | CancellationRequest,
  type: 'facility' | 'equipment' | 'cancellation',
  currentUser: Pick<User, 'username' | 'fullName'>,
  language: MessageLanguage = 'en',
): string {
  const text = (english: string, german: string) => language === 'de' ? german : english
  const germanTypes = { facility: 'Anfrage zur Anlagennutzung', equipment: 'Ausrüstungsanfrage', cancellation: 'Stornierungsanfrage' }
  let message = text(
    `Hi ${request.requestorName},\n\nYour ${type} request has been reviewed and unfortunately cannot be approved at this time.\n\n`,
    `Hallo ${request.requestorName},\n\nDeine ${germanTypes[type]} wurde geprüft und kann derzeit leider nicht genehmigt werden.\n\n`)
  message += `📋 ${text('Request Details', 'Angaben zur Anfrage')}:\n`
  if ('eventType' in request) {
    message += `• ${text('Type', 'Typ')}: ${messageEventType(request.eventType, language)}\n`
    message += `• ${text('Date', 'Datum')}: ${request.date}\n`
    message += `• ${text('Time', 'Zeit')}: ${request.startTime} (${request.duration} min)\n`
    if (request.purpose) message += `• ${text('Purpose', 'Zweck')}: ${request.purpose}\n`
  } else if ('equipmentDescription' in request) {
    message += `• ${text('Equipment', 'Ausrüstung')}: ${request.equipmentDescription}\n`
    message += `• ${text('Date Needed', 'Benötigt am')}: ${request.date}\n`
  } else {
    message += `• ${text('Event', 'Veranstaltung')}: ${request.eventTitle}\n`
    message += `• ${text('Date', 'Datum')}: ${request.eventDate}\n`
    message += `• ${text('Time', 'Zeit')}: ${request.eventTime}\n`
  }
  return `${message}\n${text('Please contact us if you have any questions.', 'Bei Fragen kannst du dich gerne bei uns melden.')}\n\n${requestMessageSignature(currentUser)}`
}
