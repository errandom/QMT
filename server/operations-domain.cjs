const { z } = require('zod');
const { HttpError } = require('./bookings.cjs');

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value =>
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const zones = z.array(z.enum(['north', 'south'])).max(2).refine(value => new Set(value).size === value.length);
const recurrence = z.object({
  until: day, weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  excludedDates: z.array(day).max(100).default([]),
});
const allocation = z.object({
  fieldId: z.string().regex(/^[1-9]\d*$/),
  zones, start: z.string().datetime(), end: z.string().datetime(),
}).refine(value => value.end > value.start, 'Allocation end must follow start');
const readinessItem = z.object({
  id: z.string().uuid(), category: z.enum(['Facility', 'Food / drinks', 'Music', 'Equipment', 'Other']),
  title: z.string().trim().min(1).max(255),
  status: z.enum(['Not started', 'In progress', 'Approved', 'Not required', 'Blocked']),
  owner: z.string().trim().max(255), dueDate: z.union([day, z.literal('')]),
  evidence: z.string().trim().max(2000),
}).superRefine((item, ctx) => {
  if (['Approved', 'Not required'].includes(item.status) && !item.evidence) {
    ctx.addIssue({ code: 'custom', message: 'Record approval evidence or why this is not required', path: ['evidence'] });
  }
});
const eventOperations = z.object({
  owner: z.string().trim().max(255),
  checklist: z.array(readinessItem).max(50),
});

function requestDates(request) {
  if (!request.recurrence) return [request.date];
  const { until, weekdays, excludedDates = [] } = recurrence.parse(request.recurrence);
  if (until < request.date || Date.parse(until) - Date.parse(request.date) > 366 * 86400000) {
    throw new HttpError(400, 'A practice series must end within 366 days of its first date');
  }
  const result = [];
  for (const date = new Date(`${request.date}T00:00:00Z`); date.toISOString().slice(0, 10) <= until; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10);
    if (weekdays.includes(date.getUTCDay() || 7) && !excludedDates.includes(key)) result.push(key);
  }
  if (!result.length) throw new HttpError(400, 'The series contains no requested dates');
  return result;
}

function interval(date, startTime, duration) {
  const start = new Date(`${date}T${startTime}:00Z`);
  return { start: start.toISOString(), end: new Date(start.getTime() + duration * 60000).toISOString() };
}

function overlaps(a, b) {
  return Date.parse(a.start) < Date.parse(b.end) && Date.parse(a.end) > Date.parse(b.start) &&
    String(a.fieldId) === String(b.fieldId) &&
    (!a.zones?.length || !b.zones?.length || a.zones.some(zone => b.zones.includes(zone)));
}

function validateAllocations(allocations, fields, start, end) {
  for (const item of allocations) {
    const field = fields.find(field => String(field.id) === item.fieldId);
    if (!field || item.start < start || item.end > end || item.end <= item.start ||
        new Set(item.zones).size !== item.zones.length) throw new HttpError(400, 'Allocation must fit within the booking and its selected locations, with distinct zones and a positive duration');
    if ((field.location_type || 'field') === 'meeting_room' && item.zones.length) throw new HttpError(400, 'Meeting rooms cannot use field zones');
  }
  // Every location is exclusive for the entire booking unless explicitly split into a complete timeline.
  for (const field of fields) {
    const parts = allocations.filter(item => item.fieldId === String(field.id)).sort((a, b) => a.start.localeCompare(b.start));
    if (!parts.length) continue;
    if (parts[0].start !== start || parts.at(-1).end !== end ||
        parts.some((item, index) => index > 0 && item.start !== parts[index - 1].end)) {
      throw new HttpError(400, 'Each location allocation must cover the whole booking without gaps or overlapping segments');
    }
  }
}

function eventAllocations(event) {
  const explicit = typeof event.allocation_json === 'string' ? JSON.parse(event.allocation_json) : event.allocations || [];
  const fields = String(event.field_ids || event.field_id || '').split(',').filter(Boolean);
  const start = new Date(event.start_time).toISOString();
  const end = new Date(event.end_time).toISOString();
  return fields.flatMap(fieldId => explicit.some(item => item.fieldId === fieldId)
    ? explicit.filter(item => item.fieldId === fieldId) : [{ fieldId, zones: [], start, end }]);
}

function conflictsFor(candidate, events, external = [], excludeIds = []) {
  const allocations = eventAllocations(candidate);
  return [
    ...events.filter(event => !excludeIds.includes(Number(event.id)) && !['Cancelled', 'Completed'].includes(event.status))
      .filter(event => allocations.some(a => eventAllocations(event).some(b => overlaps(a, b))))
      .map(event => ({ id: String(event.id), title: event.description || event.event_type, external: false })),
    ...external.filter(item => item.active !== false && item.active !== 0)
      .filter(item => allocations.some(a => overlaps(a, {
        fieldId: String(item.field_id), zones: JSON.parse(item.zones),
        start: new Date(item.start_time).toISOString(), end: new Date(item.end_time).toISOString(),
      }))).map(item => ({ id: String(item.id), title: item.participant, external: true })),
  ];
}

function readiness(event, operations) {
  if (event.status === 'Cancelled' || event.status === 'Completed') return 'Closed';
  if (!event.field_ids && !event.field_id && event.game_location !== 'away') return 'Location needed';
  if (!operations?.checklist?.length) return 'Not reviewed';
  if (operations.checklist.some(item => item.status === 'Blocked')) return 'Blocked';
  return operations.checklist.every(item => ['Approved', 'Not required'].includes(item.status)) ? 'Ready' : 'In progress';
}

function nextAction(request) {
  if (request.status !== 'Pending') return request.workflow?.outcomeNotifiedAt ? 'Complete' : 'Notify requester';
  return ({
    Received: 'Acknowledge receipt', Acknowledged: 'Start evaluation', 'In evaluation': 'Confirm scope and send inquiry',
    'Awaiting response': 'Follow up with department', 'Response received': 'Review allocation and decide',
  })[request.workflow?.stage || 'Received'];
}

module.exports = { day, clock, zones, recurrence, allocation, eventOperations, requestDates, interval,
  overlaps, validateAllocations, eventAllocations, conflictsFor, readiness, nextAction };
