const { createHash } = require('node:crypto');

class ReviewError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function spondId(value) {
  if (typeof value !== 'string' || !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value)) {
    throw new ReviewError('Spond returned an invalid identifier; discovery requires compatibility verification', 502);
  }
  return value.replaceAll('-', '').toUpperCase();
}

function flattenGroups(raw) {
  if (!Array.isArray(raw) || raw.length > 100) throw new ReviewError('Unexpected or oversized Spond group response', 502);
  const groups = [], ids = new Set();
  const add = (group, parent) => {
    const id = spondId(group?.id);
    if (ids.has(id) || typeof group.name !== 'string' || !group.name.trim() || group.name.length > 255) {
      throw new ReviewError('Unexpected Spond group structure', 502);
    }
    ids.add(id);
    groups.push({ id, name: group.name, parentGroupId: parent?.id || null, parentGroup: parent?.name || null });
  };
  for (const group of raw) {
    add(group);
    if (group.subGroups !== undefined && !Array.isArray(group.subGroups)) throw new ReviewError('Unexpected Spond subgroup structure', 502);
    const parent = groups.at(-1);
    for (const subgroup of group.subGroups || []) {
      if (groups.length >= 200) throw new ReviewError('Too many Spond groups; narrow account access', 502);
      add(subgroup, parent);
    }
  }
  if (groups.length > 200) throw new ReviewError('Too many Spond groups; narrow account access', 502);
  return groups;
}

const nameKey = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function suggestMappings(teams, groups) {
  return teams.map(team => {
    const existingGroupId = team.spond_group_id ? spondId(team.spond_group_id) : null;
    const key = nameKey(team.name);
    const candidates = groups.filter(group => key &&
      [nameKey(group.name), nameKey(`${group.parentGroup || ''} ${group.name}`)].includes(key));
    const existing = groups.find(group => group.id === existingGroupId);
    return {
      id: team.id, name: team.name, existingGroupId,
      suggestedGroupId: existing?.id || (!existingGroupId && candidates.length === 1 ? candidates[0].id : null),
      reason: existing ? 'Existing mapping - review required'
        : existingGroupId ? 'Existing mapping is not accessible - manual review required'
          : candidates.length === 1 ? 'Unique name match - not confirmed'
            : candidates.length > 1 ? 'Ambiguous name match - choose manually' : 'Choose a group manually',
    };
  });
}

function teamFingerprint(teams) {
  return createHash('sha256').update(JSON.stringify(teams)).digest('hex');
}

function reviewRange(from, to) {
  for (const value of [from, to]) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
      throw new ReviewError('Choose valid start and exclusive end dates');
    }
  }
  const start = new Date(from), end = new Date(to);
  if (end <= start || end - start > 31 * 86400000) throw new ReviewError('Preview must cover 1-31 days');
  return { from: start, to: end };
}

function providerEventQuery(group, range) {
  return {
    groupId: group.parentGroupId || group.id,
    minEndTimestamp: new Date(+range.from - 2 * 86400000).toISOString(),
    maxEndTimestamp: new Date(+range.to + 2 * 86400000).toISOString(),
    includeComments: 'false', includeHidden: 'true', max: '501',
  };
}

function qmtTime(value) {
  const text = value instanceof Date ? value.toISOString() : value;
  if (typeof text !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z?$/.test(text)) {
    throw new ReviewError('A QMT event has an invalid time; resolve it before reconciliation', 409);
  }
  const time = Date.parse(text.endsWith('Z') ? text : `${text}Z`);
  if (!Number.isFinite(time)) throw new ReviewError('A QMT event has an invalid time', 409);
  return time;
}

function providerTime(value, timezone) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) ||
      !Number.isFinite(Date.parse(value))) throw new ReviewError('Unexpected Spond event time; compatibility verification required', 502);
  // QMT stores club wall-clock times, not instants. Convert the provider instant exactly once.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = type => parts.find(part => part.type === type).value;
  return Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
}

function reconcileEvents(local, remote, { from, to, timezone }) {
  if (!Array.isArray(remote) || remote.length > 500 || local.length > 500) {
    throw new ReviewError('Preview exceeds 500 events or has an unexpected provider response; narrow the interval', 502);
  }
  const seen = new Set();
  const spond = remote.map(event => {
    const id = spondId(event?.id);
    if (seen.has(id)) throw new ReviewError('Duplicate Spond identifiers in response; preview is incomplete', 502);
    seen.add(id);
    const start = providerTime(event.startTimestamp, timezone), end = providerTime(event.endTimestamp, timezone);
    if (end <= start) {
      throw new ReviewError('Unexpected Spond event structure: endTimestamp must follow startTimestamp; compatibility verification required', 502);
    }
    if (typeof event.heading !== 'string') {
      throw new ReviewError('Unexpected Spond event structure: heading must be text; compatibility verification required', 502);
    }
    // Active Spond events may omit the cancellation flag.
    const cancelled = event.cancelled === undefined ? false : event.cancelled;
    if (typeof cancelled !== 'boolean') {
      throw new ReviewError('Unexpected Spond event structure: cancelled must be boolean when present; compatibility verification required', 502);
    }
    return { id, title: event.heading.slice(0, 255), start, end, cancelled };
  }).filter(event => event.start < +to && event.end > +from);
  const qmt = local.map(event => {
    const start = qmtTime(event.start_time), end = qmtTime(event.end_time);
    if (end <= start) throw new ReviewError('A QMT event has an invalid interval', 409);
    return { id: event.id, title: event.name || event.description?.slice(0, 255) || event.event_type,
      start, end, status: event.status, spondId: event.spond_id ? spondId(event.spond_id) : null };
  });
  const related = (a, b) => a.spondId === b.id || a.start < b.end && a.end > b.start ||
    Math.abs(a.start - b.start) <= 2 * 3600000 ||
    (new Date(a.start).toISOString().slice(0, 10) === new Date(b.start).toISOString().slice(0, 10) &&
      nameKey(a.title) && nameKey(a.title) === nameKey(b.title));
  const rows = [], matched = new Set();
  const dto = event => ({ id: event.id, title: event.title,
    start: new Date(event.start).toISOString(), end: new Date(event.end).toISOString() });
  for (const event of qmt) {
    const candidates = spond.filter(other => related(event, other));
    for (const candidate of candidates) matched.add(candidate.id);
    const single = candidates.length === 1 && qmt.filter(other => related(other, candidates[0])).length === 1;
    const exact = single && candidates[0].start === event.start && candidates[0].end === event.end &&
      candidates[0].cancelled === (event.status === 'Cancelled');
    const linked = exact && event.spondId === candidates[0].id;
    const coexist = !event.spondId && exact && nameKey(event.title) && nameKey(event.title) === nameKey(candidates[0].title);
    const classification = linked ? 'linked' : coexist ? 'coexisting'
      : event.spondId || candidates.length ? 'review'
        : event.status === 'Confirmed' ? 'qmt-only' : 'held';
    let reason = linked ? 'Already linked; leave both events unchanged'
      : coexist ? 'Present in both systems; do not create or overwrite'
        : event.spondId && !candidates.length ? 'Linked Spond event missing from preview; never recreate automatically'
          : candidates.length ? 'Possible overlap, changed event, or ambiguous match; human review required'
            : classification === 'qmt-only' ? 'No match observed; candidate only, provider coverage is unverified'
              : 'Only confirmed QMT bookings can be publication candidates';
    if (candidates.length > 10) reason += `; showing 10 of ${candidates.length} possible matches - narrow the interval`;
    rows.push({ classification, reason, qmt: dto(event), spond: candidates.slice(0, 10).map(dto) });
  }
  for (const event of spond) {
    if (!matched.has(event.id)) rows.push({
      classification: event.cancelled ? 'held' : 'spond-only',
      reason: 'User-created or unmatched Spond event; preserve it and do not create a QMT facility booking',
      qmt: null, spond: [dto(event)],
    });
  }
  return { rows, writesEnabled: false, coverageVerified: false,
    warning: 'Read-only preview. Provider completeness and compatibility are not verified; no row is approved for sync.' };
}

module.exports = { ReviewError, spondId, flattenGroups, suggestMappings, teamFingerprint, reviewRange, providerEventQuery, reconcileEvents, qmtTime, providerTime };
