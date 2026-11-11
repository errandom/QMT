const { createHash, createCipheriv, createDecipheriv, hkdfSync, randomBytes } = require('node:crypto');
const { z } = require('zod');
const { HttpError, ids } = require('./bookings.cjs');
const { spondId, providerTime } = require('./spond-review-domain.cjs');

const settingKey = '__qmt_spond_attendance_v1';
const reservedSetting = key => String(key).normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase().startsWith('__qmt_');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const countsSchema = z.object({
  confirmed: z.number().int().nonnegative().max(100000),
  unanswered: z.number().int().nonnegative().max(100000),
  declined: z.number().int().nonnegative().max(100000),
});
const sourceSchema = z.object({
  id: z.string().regex(/^[A-F0-9]{32}$/), groupId: z.string().regex(/^[A-F0-9]{32}$/),
  parentGroupId: z.string().regex(/^[A-F0-9]{32}$/).nullable(),
  teamIds: z.array(z.string().regex(/^[1-9]\d*$/)).min(1).max(20),
  mappingSignature: z.string().length(64), exclusiveTeam: z.boolean(),
  reviewedAt: z.string().datetime(), reviewedBy: z.number().int().positive(),
});
const attendanceSchema = z.object({
  version: z.literal(1), bookingSignature: z.string().length(64),
  sources: z.array(sourceSchema).min(1).max(20),
  snapshot: z.object({
    counts: countsSchema, perTeam: z.record(countsSchema), syncedAt: z.string().datetime(),
  }).optional(),
  lastAttemptAt: z.string().datetime().optional(), error: z.string().max(255).optional(),
});
const eventTeamIds = event => ids(event.team_ids || event.team_id).map(String).sort();
const isAttendanceEvent = event => ['Planned', 'Confirmed'].includes(event?.status);
const bookingSignature = event => hash([new Date(event.start_time).toISOString(),
  new Date(event.end_time).toISOString(), eventTeamIds(event)]);

function sourceMapping(event, teams, groupId, parentGroupId) {
  const mapped = teams.filter(team => team.active && team.spond_mapping_reviewed_at &&
    team.spond_group_id && spondId(team.spond_group_id) === groupId &&
    (team.spond_parent_group_id ? spondId(team.spond_parent_group_id) : null) === parentGroupId);
  const teamIds = eventTeamIds(event).filter(id => mapped.some(team => String(team.id) === id));
  if (!teamIds.length) throw new HttpError(409, 'Review the event team mapping before linking attendance');
  return { teamIds, exclusiveTeam: mapped.length === 1,
    mappingSignature: hash(mapped.map(team => [team.id, team.spond_group_id, team.spond_parent_group_id,
      Boolean(team.spond_mapping_reviewed_at)]).sort((a, b) => a[0] - b[0])) };
}

function validateProviderEvent(raw, event, source, timezone) {
  if (!raw || spondId(raw.id) !== source.id ||
      (raw.cancelled !== undefined && raw.cancelled !== false) ||
      providerTime(raw.startTimestamp, timezone) !== +new Date(event.start_time) ||
      providerTime(raw.endTimestamp, timezone) !== +new Date(event.end_time)) {
    throw new HttpError(409, 'Spond event changed or was cancelled; review the attendance link again');
  }
  const group = raw.recipients?.group;
  if (!group || spondId(group.id) !== (source.parentGroupId || source.groupId) ||
      (group.subGroups !== undefined && !Array.isArray(group.subGroups))) {
    throw new HttpError(409, 'Spond event audience no longer matches the reviewed group');
  }
  const subgroups = (group.subGroups || []).map(group => spondId(group?.id));
  if (new Set(subgroups).size !== subgroups.length ||
      (source.parentGroupId && subgroups.length && !subgroups.includes(source.groupId))) {
    throw new HttpError(409, 'Spond event does not include the reviewed subgroup');
  }
  return source.parentGroupId ? subgroups.length === 1 && subgroups[0] === source.groupId : subgroups.length === 0;
}

function responseSets(raw) {
  const result = {}, seen = new Set();
  for (const [key, field] of [['confirmed', 'acceptedIds'], ['unanswered', 'unansweredIds'], ['declined', 'declinedIds']]) {
    const values = raw?.responses?.[field];
    if (!Array.isArray(values) || values.length > 10000) {
      throw new HttpError(502, 'Spond attendance is missing or incomplete; previous counts retained');
    }
    result[key] = new Set(values.map(spondId));
    if (result[key].size !== values.length || [...result[key]].some(id => seen.has(id))) {
      throw new HttpError(502, 'Spond attendance responses conflict; previous counts retained');
    }
    for (const id of result[key]) seen.add(id);
  }
  return result;
}

function consolidate(results) {
  const all = new Map(), byTeam = new Map(), identities = new Map();
  for (const { source, responses, exactAudience } of results) {
    for (const [category, members] of Object.entries(responses)) for (const id of members) {
      if (all.has(id) && all.get(id) !== category) throw new HttpError(409, 'Conflicting responses across linked events; review attendance links');
      all.set(id, category);
      if (!identities.has(id)) identities.set(id, new Set());
      for (const teamId of source.teamIds) identities.get(id).add(teamId);
    }
    if (source.exclusiveTeam && exactAudience && source.teamIds.length === 1) {
      const team = source.teamIds[0];
      if (!byTeam.has(team)) byTeam.set(team, new Map());
      for (const [category, members] of Object.entries(responses)) for (const id of members) byTeam.get(team).set(id, category);
    }
  }
  const count = members => [...members.values()].reduce((counts, category) => {
    counts[category]++; return counts;
  }, { confirmed: 0, unanswered: 0, declined: 0 });
  const perTeam = Object.fromEntries([...byTeam].filter(([team, members]) =>
    !results.some(result => result.source.teamIds.includes(team) &&
      (!result.source.exclusiveTeam || !result.exactAudience || result.source.teamIds.length !== 1)) &&
    [...members.keys()].every(id => identities.get(id).size === 1)).map(([team, members]) => [team, count(members)]));
  return { counts: count(all), perTeam };
}

function tokenVault(secret) {
  const key = Buffer.from(hkdfSync('sha256', secret, 'qmt-spond-attendance-v1', 'provider-token-encryption', 32));
  return {
    seal(token) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(settingKey));
      const value = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
      return { iv: iv.toString('base64'), value: value.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
    },
    open(encrypted) {
      const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'));
      cipher.setAAD(Buffer.from(settingKey));
      cipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
      return Buffer.concat([cipher.update(Buffer.from(encrypted.value, 'base64')), cipher.final()]).toString('utf8');
    },
  };
}

function attendanceRow(row) {
  const { attendance_payload: payload, ...event } = row;
  if (!payload) return event;
  const raw = JSON.parse(payload).spondAttendance;
  if (!raw) return event;
  const attendance = attendanceSchema.parse(raw);
  const current = attendance.bookingSignature === bookingSignature(event) && event.status !== 'Cancelled';
  return { ...event, spond_id: undefined, attendance_accepted: undefined, attendance_unanswered: undefined,
    attendance_declined: undefined, attendance_waiting: undefined, attendance_last_sync: undefined,
    attendance_source_ids: [...new Set(attendance.sources.map(source => source.id))],
    attendance_error: current ? attendance.error : 'Booking changed; review attendance links again',
    ...(current && attendance.snapshot ? {
      attendance_accepted: attendance.snapshot.counts.confirmed, attendance_unanswered: attendance.snapshot.counts.unanswered,
      attendance_declined: attendance.snapshot.counts.declined, attendance_last_sync: attendance.snapshot.syncedAt,
      attendance_by_team: attendance.snapshot.perTeam,
    } : {}),
  };
}

module.exports = { settingKey, reservedSetting, attendanceSchema, sourceMapping, bookingSignature,
  eventTeamIds, isAttendanceEvent, validateProviderEvent, responseSets, consolidate, tokenVault, attendanceRow };
