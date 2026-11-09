const sql = require('mssql');
const { randomUUID } = require('node:crypto');
const { transaction } = require('./bookings.cjs');
const { ReviewError, spondId, teamFingerprint, reconcileEvents, qmtTime, providerTime } = require('./spond-review-domain.cjs');

function wallClockInstant(value, timezone) {
  const wall = qmtTime(value);
  if (wall % 1000) throw new ReviewError('Publication requires whole-second booking times', 409);
  const offsets = new Set([-86400000, 0, 86400000].map(delta => {
    const instant = wall + delta;
    return providerTime(new Date(instant).toISOString(), timezone) - instant;
  }));
  const matches = [...offsets].map(offset => wall - offset)
    .filter(instant => providerTime(new Date(instant).toISOString(), timezone) === wall);
  if (matches.length !== 1) throw new ReviewError('Booking time is ambiguous or nonexistent at the daylight-saving transition; resolve it before publishing', 409);
  return new Date(matches[0]).toISOString();
}

function numericIds(csv, primary) {
  const values = csv ? String(csv).split(',').map(value => value.trim()) : primary ? [String(primary)] : [];
  if (!values.length || values.some(value => !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))) {
    throw new ReviewError('Booking has invalid or missing team/field identifiers', 409);
  }
  const ids = [...new Set(values.map(Number))].sort((a, b) => a - b);
  if (primary && !ids.includes(primary)) throw new ReviewError('Booking has inconsistent primary and shared identifiers', 409);
  return ids;
}

function publicationAudience(raw, profile, group) {
  const parent = group.parentGroupId || group.id, owner = spondId(profile?.id);
  if (spondId(raw?.id) !== parent || !Array.isArray(raw.members) || !raw.members.length ||
      raw.members.length > 1000 || !Array.isArray(raw.roles)) {
    throw new ReviewError('Spond group membership is unavailable or exceeds the supported scope', 409);
  }
  const actor = raw.members.find(member => (member.profileId || member.profile?.id) &&
    spondId(member.profileId || member.profile.id) === owner);
  if (!actor || actor.pendingAdmin || !Array.isArray(actor.roles) ||
      !raw.roles.some(role => actor.roles.includes(role.id) && Array.isArray(role.permissions) && role.permissions.includes('events'))) {
    throw new ReviewError('Connect with an active Spond group administrator who can manage events', 403);
  }
  if (group.parentGroupId && (!Array.isArray(raw.subGroups) ||
      !raw.subGroups.some(subgroup => spondId(subgroup.id) === group.id))) {
    throw new ReviewError('The reviewed Spond subgroup no longer exists', 409);
  }
  const seen = new Set(), members = [];
  for (const member of raw.members) {
    const id = spondId(member.id);
    if (seen.has(id) || typeof member.respondent !== 'boolean' ||
        (group.parentGroupId && !Array.isArray(member.subGroups))) {
      throw new ReviewError('Unexpected or duplicate Spond membership; no publication is permitted', 502);
    }
    seen.add(id);
    if (member.respondent && (!group.parentGroupId || member.subGroups.some(id => spondId(id) === group.id))) members.push(id);
  }
  if (!members.length) throw new ReviewError('There are no respondent members in the reviewed destination', 409);
  return { owner, members: members.sort(), group: group.parentGroupId ? { id: parent, subGroups: [group.id] } : { id: parent } };
}

function eventPayload(event, teams, fields, group, session, audience, timezone, now) {
  const participants = numericIds(event.team_ids, event.team_id).map(id => teams.find(team => team.id === id));
  if (participants.some(team => !team?.active || !session.confirmedTeamIds.has(team.id) ||
      team.spond_group_id !== group.id || (team.spond_parent_group_id || null) !== group.parentGroupId)) {
    throw new ReviewError('Every participating QMT team must be reviewed for the same Spond destination', 409);
  }
  if (event.status !== 'Confirmed' || event.spond_id) throw new ReviewError('Only unlinked confirmed bookings can be published', 409);
  const startTimestamp = wallClockInstant(event.start_time, timezone), endTimestamp = wallClockInstant(event.end_time, timezone);
  if (Date.parse(startTimestamp) <= now || Date.parse(endTimestamp) <= Date.parse(startTimestamp)) {
    throw new ReviewError('Only future bookings with a valid interval can be published', 409);
  }
  let location;
  if (event.game_location === 'away') {
    if (!event.away_street || !event.away_city) throw new ReviewError('Complete the away venue before publishing', 409);
    location = { feature: [event.away_street, event.away_zip, event.away_city].filter(Boolean).join(', ') };
  } else {
    const venues = numericIds(event.field_ids, event.field_id).map(id => fields.find(field => field.id === id));
    if (venues.some(field => !field) || new Set(venues.map(field => field.site_id)).size !== 1) {
      throw new ReviewError('Resolve missing fields or multiple venues before publishing', 409);
    }
    location = { feature: `${venues[0].site_name}: ${venues.map(field => field.name).join(', ')}` };
    if (venues[0].address) location.address = [venues[0].address, venues[0].city].filter(Boolean).join(', ');
  }
  const teamNames = participants.map(team => team.name).join(', ');
  return {
    heading: (event.description?.trim() || `${teamNames} - ${event.event_type}`).slice(0, 255),
    description: [`QMT booking #${event.id}`, `Teams: ${teamNames}`, event.description?.trim(),
      'Generated by QMT. QMT remains authoritative for the facility booking.'].filter(Boolean).join('\n\n'),
    spondType: 'EVENT', type: 'EVENT', startTimestamp, endTimestamp, openEnded: false,
    location, owners: [{ id: audience.owner }], visibility: 'INVITEES',
    autoAccept: false, autoReminderType: 'DISABLED', commentsDisabled: false, participantsHidden: false,
    recipients: { group: audience.group, groupMembers: audience.members },
    attachments: [], tasks: { openTasks: [], assignedTasks: [] },
  };
}

function buildPublicationPreview(snapshot, remote, { group, session, audience, timezone, now, range, teamId }) {
  const parentTeams = snapshot.teams.filter(team => team.active &&
    (team.spond_parent_group_id || team.spond_group_id) === (group.parentGroupId || group.id));
  const relevant = snapshot.events.filter(event => {
    try { return numericIds(event.team_ids, event.team_id).some(id => parentTeams.some(team => team.id === id)); }
    catch { return true; }
  });
  const result = reconcileEvents(relevant, remote, {
    from: new Date(+range.from - 2 * 86400000), to: new Date(+range.to + 2 * 86400000), timezone,
  });
  const payloads = new Map();
  for (const row of result.rows) {
    if (!row.qmt) continue;
    const event = relevant.find(event => event.id === row.qmt.id);
    const previous = snapshot.publications.find(record => record.event_id === event.id);
    if (previous && !event.spond_id) {
      row.classification = 'held';
      row.reason = `Publication ${previous.state} (${previous.publication_id}); check Spond and the publication record before any further action. Never retry automatically.`;
      continue;
    }
    if (row.classification !== 'qmt-only') continue;
    try {
      const payload = eventPayload(event, snapshot.teams, snapshot.fields, group, session, audience, timezone, now);
      if (relevant.some(other => other.id !== event.id && other.status !== 'Cancelled' &&
          (qmtTime(other.start_time) < qmtTime(event.end_time) && qmtTime(other.end_time) > qmtTime(event.start_time) ||
           Math.abs(qmtTime(other.start_time) - qmtTime(event.start_time)) <= 2 * 3600000))) {
        throw new ReviewError('Another QMT booking targets the same Spond parent group nearby; resolve the ambiguity before publishing', 409);
      }
      payloads.set(event.id, payload);
      row.publishable = true;
      row.reason = `No coexistence observed. Separate approval will invite ${audience.members.length} respondent members; Spond may notify participants.`;
    } catch (error) {
      if (!(error instanceof ReviewError)) throw error;
      row.classification = 'held';
      row.reason = error.message;
    }
  }
  result.rows = result.rows.filter(row => !row.qmt
    ? row.spond.some(event => qmtTime(event.start) < +range.to && qmtTime(event.end) > +range.from)
    : (() => {
    const event = relevant.find(event => event.id === row.qmt.id);
    try { return qmtTime(event.start_time) < +range.to && qmtTime(event.end_time) > +range.from &&
      numericIds(event.team_ids, event.team_id).includes(teamId); }
    catch { return true; }
  })());
  const visible = new Set(result.rows.filter(row => row.publishable).map(row => row.qmt.id));
  for (const id of payloads.keys()) if (!visible.has(id)) payloads.delete(id);
  return { result, payloads };
}

function createSqlPublicationStore(getPool, readTeams) {
  const snapshot = async (range, db) => {
    const pool = db || await getPool();
    const teams = await readTeams(pool, !!db);
    const events = (await pool.request().input('from', sql.DateTime2, new Date(+range.from - 2 * 86400000))
      .input('to', sql.DateTime2, new Date(+range.to + 2 * 86400000))
      .query(`SELECT TOP (501) id, team_id, team_ids, field_id, field_ids, description, event_type,
        start_time, end_time, status, spond_id, updated_at, game_location, away_street, away_zip, away_city
        FROM dbo.events ${db ? 'WITH (UPDLOCK, HOLDLOCK)' : ''}
        WHERE start_time < @to AND end_time > @from ORDER BY start_time, id`)).recordset;
    if (events.length > 500) throw new ReviewError('More than 500 club bookings; narrow the preview interval', 409);
    const fields = (await pool.request().query(`SELECT TOP (1001) f.id, f.name, f.site_id, s.name AS site_name, s.address, s.city
      FROM dbo.fields f ${db ? 'WITH (HOLDLOCK)' : ''} JOIN dbo.sites s ${db ? 'WITH (HOLDLOCK)' : ''}
      ON s.id = f.site_id WHERE f.active = 1 AND s.active = 1 ORDER BY f.id`)).recordset;
    if (fields.length > 1000) throw new ReviewError('Too many active fields for publication', 409);
    const publications = (await pool.request().input('from', sql.DateTime2, range.from).input('to', sql.DateTime2, range.to)
      .query(`SELECT p.event_id, p.publication_id, p.state, p.provider_id FROM dbo.spond_publications p
        JOIN dbo.events e ON e.id = p.event_id WHERE e.start_time < @to AND e.end_time > @from ORDER BY p.event_id`)).recordset;
    return { teams, events, fields, publications };
  };
  return {
    snapshot,
    async reserve(plan, eventId, publicationId, reviewerId, validate) {
      return transaction(await getPool(), async tx => {
        const current = await snapshot(plan.range, tx);
        validate(current);
        await tx.request().input('event', sql.Int, eventId).input('publication', sql.UniqueIdentifier, publicationId)
          .input('group', sql.Char(32), plan.group.id).input('parent', sql.Char(32), plan.group.parentGroupId)
          .input('hash', sql.Char(64), plan.hashes.get(eventId)).input('reviewer', sql.Int, reviewerId)
          .query(`INSERT INTO dbo.spond_publications
            (event_id, publication_id, group_id, parent_group_id, source_hash, approved_by, state)
            VALUES (@event, @publication, @group, @parent, @hash, @reviewer, 'reserved')`);
      });
    },
    async execute(plan, eventId, publicationId, action) {
      return transaction(await getPool(), async tx => {
        const current = await snapshot(plan.range, tx);
        const reservation = current.publications.find(record => record.event_id === eventId);
        if (reservation?.publication_id?.toLowerCase() !== publicationId.toLowerCase() || reservation.state !== 'reserved') {
          throw new ReviewError('Publication reservation changed; do not retry', 409);
        }
        current.publications = current.publications.filter(record => record.event_id !== eventId);
        const providerId = await action(current);
        const updated = await tx.request().input('event', sql.Int, eventId).input('provider', sql.NVarChar(100), providerId)
          .query('UPDATE dbo.events SET spond_id = @provider, updated_at = SYSUTCDATETIME() WHERE id = @event AND spond_id IS NULL');
        if (updated.rowsAffected[0] !== 1) throw new ReviewError('Booking link changed during publication; inspect Spond before retrying', 409);
        await tx.request().input('event', sql.Int, eventId).input('provider', sql.Char(32), providerId)
          .query(`UPDATE dbo.spond_publications SET state = 'published', provider_id = @provider,
            updated_at = SYSUTCDATETIME() WHERE event_id = @event`);
        return providerId;
      });
    },
    async markUncertain(eventId, publicationId) {
      await (await getPool()).request().input('event', sql.Int, eventId).input('publication', sql.UniqueIdentifier, publicationId)
        .query(`UPDATE dbo.spond_publications SET state = 'uncertain', updated_at = SYSUTCDATETIME()
          WHERE event_id = @event AND publication_id = @publication AND state = 'reserved'`);
    },
  };
}

function createPublicationService({ getPool, readTeams, client, timezone, logger, now = Date.now, store = createSqlPublicationStore(getPool, readTeams) }) {
  const context = async (session, group) => {
    const profile = await client.get(session.token, 'profile', {});
    const raw = await client.get(session.token, `group/${group.parentGroupId || group.id}`, {});
    return publicationAudience(raw, profile, group);
  };
  const remoteEvents = async (session, group, range) => {
    const query = {
      groupId: group.parentGroupId || group.id, includeComments: 'false', addProfileInfo: 'false',
      includeHidden: 'true', order: 'asc', max: '99',
      minEndTimestamp: new Date(+range.from - 2 * 86400000).toISOString(),
      maxStartTimestamp: new Date(+range.to + 2 * 86400000).toISOString(),
    };
    const events = new Map();
    for (const scheduled of [undefined, 'true']) {
      const remote = await client.get(session.token, 'sponds', { ...query, ...(scheduled ? { scheduled } : {}) });
      if (!Array.isArray(remote) || remote.length >= 99) throw new ReviewError('Spond listing may be truncated; narrow the date range before publishing', 409);
      const seen = new Set();
      for (const event of remote) {
        const id = spondId(event?.id);
        if (seen.has(id) || events.has(id) && teamFingerprint(events.get(id)) !== teamFingerprint(event)) {
          throw new ReviewError('Spond listings changed or contain duplicate events; preview again', 409);
        }
        seen.add(id);
        events.set(id, event);
      }
    }
    return [...events.values()];
  };
  const build = (snapshot, remote, plan, session, audience) => {
    if (teamFingerprint(snapshot.teams) !== session.fingerprint) throw new ReviewError('Team links changed; repeat discovery and mapping review', 409);
    return buildPublicationPreview(snapshot, remote, { ...plan, session, audience, timezone, now: now() });
  };
  return {
    async preview({ session, group, range, teamId }) {
      session.publicationPlan = undefined;
      const snapshot = await store.snapshot(range);
      const audience = await context(session, group);
      const remote = await remoteEvents(session, group, range);
      const plan = { id: randomUUID(), group, range, teamId, expiresAt: Math.min(session.expiresAt, now() + 5 * 60000) };
      const { result, payloads } = build(snapshot, remote, plan, session, audience);
      const fresh = await store.snapshot(range);
      if (teamFingerprint(snapshot) !== teamFingerprint(fresh)) throw new ReviewError('Bookings changed during preview; preview again', 409);
      plan.hashes = new Map([...payloads].map(([id, payload]) => [
        id, teamFingerprint([payload, snapshot.events.find(event => event.id === id)]),
      ]));
      session.publicationPlan = plan;
      return { ...result, writesEnabled: true, coverageVerified: false, planId: plan.id,
        expiresAt: new Date(plan.expiresAt).toISOString(), audienceCount: audience.members.length,
        destination: group.parentGroup ? `${group.parentGroup} / ${group.name}` : group.name,
        warning: 'Preview only. Publish one selected future QMT-only booking after separate approval. Existing Spond events stay unchanged. Account visibility cannot prove absolute provider completeness.',
        scope: 'Entire Spond parent group inspected, including hidden and scheduled events; participant scope is the reviewed destination' };
    },
    async publish({ session, planId, eventId, reviewerId }) {
      const plan = session.publicationPlan;
      if (!plan || plan.id !== planId || plan.expiresAt <= now() || !plan.hashes.has(eventId)) {
        throw new ReviewError('Publication preview expired, changed, or is not eligible; preview again', 409);
      }
      session.publicationPlan = undefined;
      const audience = await context(session, plan.group);
      const validate = (snapshot, remote = []) => {
        const { payloads } = build(snapshot, remote, plan, session, audience);
        const payload = payloads.get(eventId);
        if (!payload || teamFingerprint([payload, snapshot.events.find(event => event.id === eventId)]) !== plan.hashes.get(eventId)) {
          throw new ReviewError('Booking, participants, venue, or coexistence changed; preview again', 409);
        }
        return payload;
      };
      const publicationId = randomUUID();
      await store.reserve(plan, eventId, publicationId, reviewerId, validate);
      try {
        const providerId = await store.execute(plan, eventId, publicationId, async snapshot => {
          const remote = await remoteEvents(session, plan.group, plan.range);
          const payload = validate(snapshot, remote);
          payload.description += `\n\nQMT publication: ${publicationId}`;
          const response = await client.post(session.token, 'sponds', payload);
          const id = spondId(response?.id);
          const saved = await client.get(session.token, `sponds/${id}`, { includeComments: 'false' });
          if (spondId(saved?.id) !== id || saved.heading !== payload.heading || saved.autoAccept !== false ||
              (saved.cancelled !== undefined && saved.cancelled !== false) ||
              saved.startTimestamp !== payload.startTimestamp && Date.parse(saved.startTimestamp) !== Date.parse(payload.startTimestamp) ||
              saved.endTimestamp !== payload.endTimestamp && Date.parse(saved.endTimestamp) !== Date.parse(payload.endTimestamp) ||
              saved.description !== payload.description || spondId(saved.recipients?.group?.id) !== payload.recipients.group.id) {
            throw new ReviewError('Spond created an event with unexpected details; inspect it before any further action', 409);
          }
          const subgroups = (saved.recipients.group.subGroups || []).map(group => spondId(typeof group === 'string' ? group : group.id)).sort();
          const members = saved.recipients.groupMembers?.map(member => spondId(typeof member === 'string' ? member : member.id)).sort();
          if (JSON.stringify(subgroups) !== JSON.stringify(payload.recipients.group.subGroups || []) ||
              JSON.stringify(members) !== JSON.stringify(payload.recipients.groupMembers)) {
            throw new ReviewError('Spond recipient read-back differs from the approved audience; inspect it before any further action', 409);
          }
          return id;
        });
        logger.log('Spond booking explicitly published', { reviewerId, eventId, publicationId });
        return { success: true, eventId, providerId, publicationId,
          message: 'Selected booking published and linked. Existing Spond events and QMT facility details were not changed.' };
      } catch (error) {
        try { await store.markUncertain(eventId, publicationId); }
        catch { logger.error('Spond publication journal requires investigation', { eventId, publicationId }); }
        logger.error('Spond publication stopped; automatic retry forbidden', { eventId, publicationId, code: error.code || 'PUBLICATION_UNCERTAIN' });
        throw new ReviewError(`Publication could not be completed safely. Check Spond and reference ${publicationId}; do not publish this booking again.`, 409);
      }
    },
  };
}

module.exports = { wallClockInstant, numericIds, publicationAudience, eventPayload, buildPublicationPreview, createSqlPublicationStore, createPublicationService };
