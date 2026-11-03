import { apiRequest } from './api'
import type { FieldAllocation, FacilityRequest } from './types'

export interface ReadinessItem {
  id: string
  category: 'Facility' | 'Food / drinks' | 'Music' | 'Equipment' | 'Other'
  title: string
  status: 'Not started' | 'In progress' | 'Approved' | 'Not required' | 'Blocked'
  owner: string
  dueDate: string
  evidence: string
}
export interface EventOperations {
  eventId: string
  revision: number
  owner: string
  checklist: ReadinessItem[]
}
export interface OperationsEvent {
  id: number
  description: string
  event_type: string
  status: string
  field_id?: number
  field_ids?: string
  start_time: string
  end_time: string
  series_id?: string
  updated_at: string
  allocation_json?: string
  game_location?: string
}
export interface ExternalAllocation {
  id: string
  field_id: number
  participant: string
  start_time: string
  end_time: string
  zones: string
  active: boolean
  revision: number
}
export interface OperationsState {
  from: string
  to: string
  events: OperationsEvent[]
  external: ExternalAllocation[]
  metadata: EventOperations[]
}
export interface RequestPreview {
  date: string
  conflicts: { id: string; title: string; external: boolean }[]
  alternatives: { id: string; name: string }[]
  alternativeTimes: { start: string; end: string }[]
}
export interface Communication {
  id: string
  direction: 'inbound' | 'outbound'
  status: string
  recipient: string
  subject: string
  message: string
  created_at: string
}
export const operationsApi = {
  state: () => apiRequest<OperationsState>('/operations'),
  seriesEvents: (id: string) => apiRequest<OperationsEvent[]>(`/operations/series/${id}`),
  preview: (id: string, fieldId: string) => apiRequest<RequestPreview[]>(`/operations/requests/${id}/preview`, {
    method: 'POST', body: JSON.stringify({ fieldId }),
  }),
  saveEvent: (id: number, data: Omit<EventOperations, 'eventId' | 'revision'> & {
    expectedRevision: number; allocations?: FieldAllocation[]
  }) => apiRequest<EventOperations>(`/operations/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  saveExternal: (id: string, data: {
    fieldId: string; participant: string; start: string; end: string; zones: FieldAllocation['zones']
    active: boolean; expectedRevision: number; allowConflicts: boolean
  }) => apiRequest<{ id: string }>(`/operations/external/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  series: (id: string, data: {
    anchorId: number; scope: 'this' | 'future' | 'all'; startTime: string; endTime: string; status: string
    expected: { id: number; updatedAt: string }[]
  }) => apiRequest<OperationsEvent[]>(`/operations/series/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  messages: (id: string) => apiRequest<{ configured: boolean; messages: Communication[] }>(`/operations/requests/${id}/messages`),
  send: (id: string, data: {
    id: string; recipient: string; subject: string; message: string; action: 'acknowledge' | 'send' | 'notify' | 'followup'
    expectedVersion: number; approved: true
  }) => apiRequest<{ status: string; workflowApplied?: boolean; duplicate?: boolean }>(`/operations/requests/${id}/messages`, {
    method: 'POST', body: JSON.stringify(data),
  }),
  sync: (id: string) => apiRequest<{ imported: number }>(`/operations/requests/${id}/sync-replies`, { method: 'POST' }),
}

export function requestedDates(request: FacilityRequest): string[] {
  if (!request.recurrence) return [request.date]
  if (!request.date || !request.recurrence.until || request.recurrence.until < request.date ||
      Date.parse(request.recurrence.until) - Date.parse(request.date) > 366 * 86400000) return []
  const result: string[] = []
  for (const date = new Date(`${request.date}T00:00:00Z`); date.toISOString().slice(0, 10) <= request.recurrence.until; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10)
    if (request.recurrence.weekdays.includes(date.getUTCDay() || 7) && !request.recurrence.excludedDates.includes(key)) result.push(key)
  }
  return result
}
export function gameReadiness(event: OperationsEvent, metadata?: EventOperations) {
  if (['Cancelled', 'Completed'].includes(event.status)) return 'Closed'
  if (!event.field_id && !event.field_ids && event.game_location !== 'away') return 'Location needed'
  if (!metadata?.checklist.length) return 'Not reviewed'
  if (metadata.checklist.some(item => item.status === 'Blocked')) return 'Blocked'
  return metadata.checklist.every(item => ['Approved', 'Not required'].includes(item.status)) ? 'Ready' : 'In progress'
}
export function requestNextAction(request: FacilityRequest) {
  if (request.status !== 'Pending') return request.workflow?.outcomeNotifiedAt ? 'Complete' : 'Notify requester'
  if (request.workflow?.stage === 'In evaluation' && request.workflow.route === 'IGACR') {
    return request.workflow.workbook ? 'Enter prepared workbook rows' : 'Prepare meeting-room workbook rows'
  }
  return ({
    Received: 'Acknowledge receipt', Acknowledged: 'Start evaluation', 'In evaluation': 'Confirm scope and send inquiry',
    'Awaiting response': 'Follow up with department', 'Response received': 'Review allocation and decide',
    Approved: 'Notify requester', Rejected: 'Notify requester',
  })[request.workflow?.stage || 'Received']
}
