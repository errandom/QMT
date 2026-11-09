const sql = require('mssql');
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { createLimiter } = require('./limits.cjs');
const { createSpondClient, SpondError } = require('./spond-client.cjs');
const { consumeReviewQuota } = require('./spond-review-quota.cjs');
const { createPublicationService } = require('./spond-publication.cjs');
const { ReviewError, flattenGroups, suggestMappings, teamFingerprint, reviewRange, providerEventQuery, reconcileEvents } = require('./spond-review-domain.cjs');

const credentialsSchema = z.object({
  username: z.string().trim().email().max(254), password: z.string().min(1).max(4096),
}).strict();
const confirmationSchema = z.object({
  discoveryId: z.string().uuid(), confirmed: z.literal(true),
  mappings: z.array(z.object({ teamId: z.number().int().positive(), groupId: z.string().regex(/^[A-F0-9]{32}$/) }).strict()).min(1).max(200),
}).strict();
const previewSchema = z.object({
  discoveryId: z.string().uuid(), teamId: z.number().int().positive(),
  from: z.string(), to: z.string(),
}).strict();
const publishSchema = z.object({
  discoveryId: z.string().uuid(), planId: z.string().uuid(), eventId: z.number().int().positive(),
  confirmed: z.literal(true),
}).strict();
const teamColumns = 'id, name, active, spond_group_id, spond_parent_group_id, spond_mapping_reviewed_by, spond_mapping_reviewed_at, updated_at';
async function readTeams(pool, locked = false) {
  const result = await pool.request().query(`SELECT TOP (201) ${teamColumns} FROM dbo.teams ${locked ? 'WITH (UPDLOCK, HOLDLOCK)' : ''} ORDER BY id`);
  if (result.recordset.length > 200) throw new ReviewError('Discovery supports up to 200 teams; narrow the club scope', 409);
  return result.recordset;
}

function registerSpondReviewRoutes(app, { getPool, logger, timezone, client = createSpondClient(), now = Date.now, publishingEnabled = false }) {
  const sessions = new Map(), pending = new Set();
  const publications = createPublicationService({ getPool, readTeams, client, timezone, logger, now });
  const limit = createLimiter({ limit: 10, windowMs: 15 * 60000, key: req => req.user.id, now });
  const discoveryLimit = createLimiter({ limit: 3, windowMs: 15 * 60000, key: req => req.user.id, now });
  const prune = () => {
    for (const [id, session] of sessions) if (session.expiresAt <= now()) sessions.delete(id);
  };
  const sessionFor = (req, id) => {
    prune();
    const session = sessions.get(req.user.id);
    if (!session || session.id !== id) throw new ReviewError('Discovery expired or belongs to another administrator; run discovery again', 409);
    return session;
  };
  const handle = action => async (req, res) => {
    try { await action(req, res); }
    catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid Spond review input' });
      if (error instanceof ReviewError) {
        if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
        return res.status(error.status).json({ error: error.message });
      }
      if (error instanceof SpondError) {
        if (error.providerStatus === 401 || error.providerStatus === 403) sessions.delete(req.user.id);
        logger.error('Spond review provider call failed', { code: error.code });
        return res.status(502).json({ error: error.message });
      }
      logger.error('Spond review failed', { code: 'REVIEW_UNAVAILABLE' });
      res.status(503).json({ error: 'Spond review unavailable; check migrations and connection before retrying' });
    }
  };
  app.use('/api/spond', (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Administrator review required' });
    next();
  });
  app.get('/api/spond/status', (_req, res) => {
    prune();
    res.json({ mode: publishingEnabled ? 'reviewed-publication' : 'review', writesEnabled: publishingEnabled,
      credentialStorage: 'none', sessionMinutes: 15, quotas: 'durable' });
  });
  app.post('/api/spond/discovery', discoveryLimit, handle(async (req, res) => {
    const credentials = credentialsSchema.parse(req.body);
    prune();
    if (pending.has(req.user.id) || pending.size >= 3 || (!sessions.has(req.user.id) && sessions.size >= 20)) {
      throw new ReviewError('Discovery is busy; retry later', 429);
    }
    pending.add(req.user.id);
    sessions.delete(req.user.id);
    try {
      const pool = await getPool();
      const teams = await readTeams(pool);
      await consumeReviewQuota(pool, req.user.id, 'discovery');
      const token = await client.login(credentials.username, credentials.password);
      const groups = flattenGroups(await client.get(token, 'groups', { includeMembers: 'false' }));
      const session = { id: randomUUID(), token, groups, fingerprint: teamFingerprint(teams),
        expiresAt: now() + 15 * 60000, confirmedTeamIds: new Set(), busy: false };
      sessions.set(req.user.id, session);
      res.json({ discoveryId: session.id, expiresAt: new Date(session.expiresAt).toISOString(),
        teams: suggestMappings(teams.filter(team => team.active), groups), groups });
    } finally { pending.delete(req.user.id); }
  }));
  app.post('/api/spond/mappings/confirm', limit, handle(async (req, res) => {
    const input = confirmationSchema.parse(req.body);
    const session = sessionFor(req, input.discoveryId);
    if (session.busy) throw new ReviewError('Another review action is running', 409);
    const ids = new Set(input.mappings.map(mapping => mapping.teamId));
    if (ids.size !== input.mappings.length) throw new ReviewError('Review each team only once');
    session.busy = true;
    session.publicationPlan = undefined;
    let transaction, begun = false;
    try {
      await consumeReviewQuota(await getPool(), req.user.id, 'review');
      transaction = (await getPool()).transaction();
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      begun = true;
      const teams = await readTeams(transaction, true);
      if (teamFingerprint(teams) !== session.fingerprint) throw new ReviewError('Teams or mappings changed; run discovery again before confirming', 409);
      for (const mapping of input.mappings) {
        const team = teams.find(team => team.id === mapping.teamId && team.active);
        const group = session.groups.find(group => group.id === mapping.groupId);
        if (!team || !group) throw new ReviewError('Choose an active team and a discovered group');
        await transaction.request().input('team', sql.Int, mapping.teamId)
          .input('group', sql.NVarChar(100), group.id)
          .input('parent', sql.NVarChar(100), group.parentGroupId)
          .input('reviewer', sql.NVarChar(255), req.user.username)
          .query(`UPDATE dbo.teams SET spond_group_id = @group, spond_parent_group_id = @parent,
            spond_mapping_reviewed_by = @reviewer, spond_mapping_reviewed_at = SYSUTCDATETIME(),
            updated_at = SYSUTCDATETIME() WHERE id = @team`);
      }
      const fingerprint = teamFingerprint(await readTeams(transaction, true));
      await transaction.commit();
      begun = false;
      session.fingerprint = fingerprint;
      session.confirmedTeamIds = ids;
      logger.log('Spond mappings explicitly reviewed', { reviewerId: req.user.id, count: ids.size });
      res.json({ success: true, confirmedTeamIds: [...ids], writesEnabled: false });
    } catch (error) {
      if (begun) await transaction.rollback();
      throw error;
    } finally { session.busy = false; }
  }));
  app.post('/api/spond/reconciliation', limit, handle(async (req, res) => {
    const input = previewSchema.parse(req.body);
    const range = reviewRange(input.from, input.to);
    const session = sessionFor(req, input.discoveryId);
    if (!session.confirmedTeamIds.has(input.teamId)) throw new ReviewError('Explicitly confirm this team mapping before previewing', 409);
    if (session.busy) throw new ReviewError('Another review action is running', 409);
    session.busy = true;
    session.publicationPlan = undefined;
    try {
      const pool = await getPool();
      const teams = await readTeams(pool);
      if (teamFingerprint(teams) !== session.fingerprint) throw new ReviewError('Teams or mappings changed; repeat discovery and confirmation', 409);
      const team = teams.find(team => team.id === input.teamId);
      const group = session.groups.find(group => group.id === team?.spond_group_id);
      if (!group) throw new ReviewError('Confirmed mapping is no longer available', 409);
      await consumeReviewQuota(pool, req.user.id, 'review');
      if (publishingEnabled) {
        const result = await publications.preview({ session, group, range, teamId: input.teamId });
        return res.json({ ...result, teamId: input.teamId, from: input.from, to: input.to, timezone });
      }
      const events = await pool.request().input('team', sql.Int, input.teamId)
        .input('from', sql.DateTime2, range.from).input('to', sql.DateTime2, range.to)
        .query(`SELECT TOP (501) id, description, event_type, start_time, end_time, status, spond_id
          FROM dbo.events WHERE start_time < @to AND end_time > @from
          AND (team_id = @team OR CHARINDEX(',' + CONVERT(nvarchar(20), @team) + ',',
            ',' + REPLACE(COALESCE(team_ids, ''), ' ', '') + ',') > 0) ORDER BY start_time, id`);
      if (events.recordset.length > 500) throw new ReviewError('Too many QMT events; narrow the interval', 409);
      // Inspect the entire parent group for subgroup mappings: unknown recipient semantics must not hide possible duplicates.
      const remote = await client.get(session.token, 'sponds', providerEventQuery(group, range));
      const result = reconcileEvents(events.recordset, remote, { ...range, timezone });
      if (teamFingerprint(await readTeams(pool)) !== session.fingerprint) throw new ReviewError('Mapping changed during preview; repeat discovery', 409);
      res.json({ ...result, teamId: input.teamId, from: input.from, to: input.to, timezone,
        scope: group.parentGroupId ? 'Entire parent group inspected conservatively; subgroup recipient compatibility is unverified' : 'Mapped group' });
    } finally { session.busy = false; }
  }));
  app.post('/api/spond/publications', limit, handle(async (req, res) => {
    if (!publishingEnabled) throw new ReviewError('Reviewed Spond publication is not enabled', 409);
    const input = publishSchema.parse(req.body);
    const session = sessionFor(req, input.discoveryId);
    if (session.busy) throw new ReviewError('Another review action is running', 409);
    session.busy = true;
    try {
      await consumeReviewQuota(await getPool(), req.user.id, 'review');
      res.json(await publications.publish({ session, planId: input.planId, eventId: input.eventId, reviewerId: req.user.id }));
    } finally { session.busy = false; }
  }));
  app.use('/api/spond', (_req, res) => res.status(409).json({
    error: 'Legacy Spond sync and credential storage are disabled; use discovery, explicit mapping review, and read-only reconciliation',
  }));
}

module.exports = { registerSpondReviewRoutes };
