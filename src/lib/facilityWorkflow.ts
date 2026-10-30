import type { FacilityRequest, FacilityWorkflowStage, Field, Site, Team } from './types'

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

export function facilityMessage(
  request: FacilityRequest, action: 'acknowledge' | 'send' | 'notify',
  teams: Team[], fields: Field[], sites: Site[],
): string {
  const details = [
    `Request #${request.id}: ${request.eventType}`,
    `Date: ${request.date}; start: ${request.startTime}; duration: ${request.duration} minutes`,
    `Facility type: ${(request.workflow?.locationType || request.locationType) === 'meeting_room' ? 'Meeting room' :
      (request.workflow?.locationType || request.locationType) === 'field' ? 'Field' : 'To be clarified'}`,
    request.teamIds?.length && `Teams: ${request.teamIds.map(id => teams.find(team => team.id === id)?.name || `Team ${id}`).join(', ')}`,
    request.purpose && `Purpose: ${request.purpose}`,
    request.opponent && `Opponent: ${request.opponent}`,
    request.description && `Additional details: ${request.description}`,
  ].filter(Boolean).join('\n')
  if (action === 'acknowledge') {
    return `Hi ${request.requestorName},\n\nWe have received your facility request and will evaluate it. This acknowledgment is not a booking confirmation. We will let you know the outcome.\n\n${details}\n\nClub operations`
  }
  if (action === 'send') {
    return `Hello,\n\nPlease evaluate the following ${request.workflow?.locationType === 'meeting_room' ? 'meeting-room' : 'field'} request and confirm availability, allocation and any conditions.\n\n${details}${request.workflow?.reference ? `\nReference: ${request.workflow.reference}` : ''}${request.eventType === 'Game' ? '\n\nPlease also identify any separate approvals to consider for goods, drinks, food, music or other activities. Facility approval alone is not confirmation of these permits.' : ''}\n\nPlease reply with your decision, conditions and any changes to the requested slot or location.\n\nClub operations`
  }
  const field = fields.find(item => item.id === request.workflow?.approvedFieldId)
  const allocation = field
    ? `${sites.find(site => site.id === field.siteId)?.name || 'Site'} - ${field.name}`
    : 'No location recorded; allocation must still be confirmed.'
  const decision = request.status === 'Approved'
    ? `Your facility request has been approved.${request.workflow?.bookingEventId ? '\nOne booking has been created for the date and time below. Other dates or additional bookings require separate confirmation.' : ''}\nLocation: ${allocation}${!field ? '\nThe booking is not a confirmed location allocation.' : ''}`
    : 'Your facility request has been reviewed and cannot be approved.'
  return `Hi ${request.requestorName},\n\n${decision}\n\n${details}${request.workflow?.decisionNote ? `\n\nDecision / conditions:\n${request.workflow.decisionNote}` : ''}${request.eventType === 'Game' ? '\n\nAny separate game permits still need to be verified.' : ''}\n\nClub operations`
}
