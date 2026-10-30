const { z } = require('zod');
const { HttpError } = require('./bookings.cjs');

const locationType = z.enum(['field', 'meeting_room']);
const channel = z.enum(['Email', 'WhatsApp', 'Phone', 'Other']);
const route = z.enum(['City of Zurich', 'ZVIS', 'Other', 'Internal']);
const message = z.string().trim().min(1);
const email = z.string().trim().email().max(254);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value =>
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const routing = {
  locationType, route,
  department: z.string().trim().max(255),
  contactEmail: z.union([email, z.literal('')]),
  reference: z.string().trim().max(255),
  followUpDate: z.union([date, z.literal('')]),
  permitNotes: z.string().trim().max(1000),
};
const workflowSchema = z.object({
  version: z.number().int().positive(),
  stage: z.enum(['Received', 'Acknowledged', 'In evaluation', 'Awaiting response', 'Response received', 'Approved', 'Rejected']),
  ...Object.fromEntries(Object.entries(routing).map(([key, schema]) => [key, schema.optional()])),
  outcomeNotifiedAt: z.string().datetime().optional(),
  decisionNote: z.string().max(4000).optional(),
  approvedFieldId: z.string().regex(/^[1-9]\d*$/).optional(),
  bookingEventId: z.string().regex(/^[1-9]\d*$/).optional(),
  history: z.array(z.object({
    at: z.string().datetime(), by: z.string().min(1).max(255),
    action: z.enum(['configure', 'acknowledge', 'evaluate', 'send', 'response', 'internal', 'note', 'notify', 'Approved', 'Rejected']),
    message: z.string().max(16000).optional(), channel: channel.optional(),
  })).max(500),
});
const version = { expectedVersion: z.number().int().min(0) };
const workflowActionSchema = z.discriminatedUnion('action', [
  z.object({ ...version, action: z.literal('configure'), ...routing }),
  ...['acknowledge', 'send', 'notify'].map(action => z.object({
    ...version, action: z.literal(action), channel, message: message.max(16000),
  })),
  ...['response', 'internal', 'note'].map(action => z.object({
    ...version, action: z.literal(action), message: message.max(4000),
  })),
  z.object({ ...version, action: z.literal('evaluate') }),
]);

function currentWorkflow(request) {
  return request.workflow || {
    version: 0, stage: request.status === 'Pending' ? 'Received' : request.status,
    locationType: request.locationType, history: [],
  };
}

function checkVersion(workflow, expectedVersion) {
  if (workflow.version !== expectedVersion) {
    throw new HttpError(409, 'This request changed. Reload requests before continuing.');
  }
  if (workflow.history.length >= 500) throw new HttpError(409, 'Request activity limit reached; contact support before continuing');
}

function applyWorkflowAction(request, action, actor, at = new Date().toISOString()) {
  if (request.type !== 'facility') throw new HttpError(400, 'This workflow is only available for facility requests');
  const previous = currentWorkflow(request);
  checkVersion(previous, action.expectedVersion);
  const workflow = { ...previous, version: previous.version + 1, history: [...previous.history] };
  const pending = request.status === 'Pending';
  const requireStage = stages => {
    if (!pending || !stages.includes(workflow.stage)) throw new HttpError(409, 'Action is not available at the current workflow stage');
  };
  let entryMessage = action.message;
  switch (action.action) {
    case 'configure': {
      requireStage(['Received', 'Acknowledged', 'In evaluation', 'Awaiting response', 'Response received']);
      const responsibilityChanged = ['locationType', 'route', 'department', 'contactEmail']
        .some(key => workflow[key] !== action[key]);
      if (responsibilityChanged && ['Awaiting response', 'Response received'].includes(workflow.stage)) workflow.stage = 'In evaluation';
      for (const key of Object.keys(routing)) workflow[key] = action[key];
      entryMessage = [
        `Facility: ${action.locationType}; Route: ${action.route}; Department: ${action.department || 'Unassigned'}`,
        `Contact: ${action.contactEmail || 'Not recorded'}; Reference: ${action.reference || 'None'}; Follow-up: ${action.followUpDate || 'None'}`,
        action.permitNotes && `Game review notes: ${action.permitNotes}`,
      ].filter(Boolean).join('\n');
      break;
    }
    case 'acknowledge':
      requireStage(['Received']);
      workflow.stage = 'Acknowledged';
      break;
    case 'evaluate':
      requireStage(['Acknowledged', 'Response received']);
      workflow.stage = 'In evaluation';
      break;
    case 'send':
      requireStage(['In evaluation']);
      if (!workflow.locationType || !workflow.route || workflow.route === 'Internal' || !workflow.department) {
        throw new HttpError(400, 'Save the facility type, external route and responsible department before recording the inquiry');
      }
      workflow.stage = 'Awaiting response';
      break;
    case 'response':
      requireStage(['Awaiting response']);
      workflow.stage = 'Response received';
      break;
    case 'internal':
      requireStage(['In evaluation']);
      if (!workflow.locationType || workflow.route !== 'Internal') {
        throw new HttpError(400, 'Save an internal review route and facility type first');
      }
      workflow.stage = 'Response received';
      break;
    case 'notify':
      if (pending) throw new HttpError(409, 'Decide the request before recording outcome notification');
      if (workflow.outcomeNotifiedAt) throw new HttpError(409, 'Outcome notification is already recorded');
      workflow.outcomeNotifiedAt = at;
      break;
    case 'note':
      break;
    default:
      throw new HttpError(400, 'Unknown workflow action');
  }
  workflow.history.push({ at, by: actor, action: action.action, message: entryMessage, channel: action.channel });
  return workflow;
}

function reviewFacility(request, status, expectedVersion, decisionNote, actor, at = new Date().toISOString()) {
  const previous = currentWorkflow(request);
  checkVersion(previous, expectedVersion);
  if (status === 'Approved' && (previous.stage !== 'Response received' || !previous.locationType)) {
    throw new HttpError(409, 'Complete evaluation and record the external response or internal review before approving');
  }
  if (status === 'Rejected' && !decisionNote?.trim()) throw new HttpError(400, 'Provide a reason for rejecting this request');
  return {
    ...previous, version: previous.version + 1, stage: status, decisionNote: decisionNote?.trim(),
    history: [...previous.history, { at, by: actor, action: status, message: decisionNote?.trim() }],
  };
}

module.exports = {
  locationType, email, workflowSchema, workflowActionSchema,
  currentWorkflow, applyWorkflowAction, reviewFacility,
};
