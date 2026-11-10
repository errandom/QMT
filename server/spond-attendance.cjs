const { randomUUID } = require('node:crypto');
const { HttpError } = require('./bookings.cjs');
const { createSpondClient, SpondError } = require('./spond-client.cjs');
const { attendanceStore } = require('./spond-attendance-store.cjs');
const { attendanceSchema, sourceMapping, bookingSignature, eventTeamIds, validateProviderEvent,
  responseSets, consolidate, tokenVault } = require('./spond-attendance-domain.cjs');

const intervalMs = 15 * 60000;
const errorText = error => error instanceof HttpError ? error.message
  : error instanceof SpondError && [401, 403].includes(error.providerStatus)
    ? 'Spond authorization expired or was revoked; reconnect in Office settings'
    : 'Attendance refresh failed; previous counts retained. Retry or review the connection.';

function createAttendanceService({ getPool, secret, timezone, logger, enabled,
  client = createSpondClient(), store = attendanceStore(getPool), now = Date.now }) {
  const vault = tokenVault(secret);
  let running = null, timer = null, stopped = false;
  const requireEnabled = () => { if (!enabled) throw new HttpError(409, 'Scheduled attendance is disabled by deployment policy'); };
  const status = async () => {
    const connection = await store.connection();
    return { enabled, connected: Boolean(connection), authorized: Boolean(connection?.authorized),
      intervalMinutes: 15, window: 'Yesterday through the next 30 days; up to 50 source reads per run, oldest attempts first',
      credentialStorage: 'encrypted-access-token-only', writesToSpond: false,
      lastAttemptAt: connection?.lastAttemptAt || null, lastSuccessAt: connection?.lastSuccessAt || null,
      nextRunAt: connection?.nextRunAt || null, running: Boolean(connection?.runningUntil && Date.parse(connection.runningUntil) > now()),
      blocked: connection?.blocked || false, error: connection?.error || null,
      processed: connection?.processed || 0, failed: connection?.failed || 0, queued: connection?.queued || 0 };
  };
  const connect = async (ownerId, token) => {
    requireEnabled();
    await store.locked(async source => {
      const prior = await store.connection(source);
      if (prior) await store.removeConnection(source);
      await store.saveConnection(source, { id: randomUUID(), ownerId, encryptedToken: vault.seal(token),
        nextRunAt: new Date(now()).toISOString(), runningUntil: null, leaseId: null, lastAttemptAt: null,
        lastSuccessAt: null, blocked: false, error: null, processed: 0, failed: 0, queued: 0 });
    });
    return status();
  };
  const disconnect = async () => {
    requireEnabled();
    await store.locked(source => store.removeConnection(source));
    return status();
  };
  const link = async ({ eventId, providerId, teamId, group, expected, token, reviewerId }) => {
    requireEnabled();
    const before = await store.event(null, eventId), teams = await store.teams();
    if (before.status !== 'Confirmed' || !eventTeamIds(before).includes(String(teamId)) ||
        bookingSignature(before) !== bookingSignature(expected)) {
      throw new HttpError(409, 'Booking changed since the preview; preview it again');
    }
    const mapping = sourceMapping(before, teams, group.id, group.parentGroupId);
    if (!mapping.teamIds.includes(String(teamId))) throw new HttpError(409, 'Reviewed team mapping changed');
    const candidate = { id: providerId, groupId: group.id, parentGroupId: group.parentGroupId, ...mapping,
      reviewedAt: new Date(now()).toISOString(), reviewedBy: reviewerId };
    const remote = await client.get(token, `sponds/${providerId}`, { includeComments: 'false', addProfileInfo: 'false' });
    validateProviderEvent(remote, before, candidate, timezone);
    responseSets(remote);
    await store.locked(async source => {
      const event = await store.event(source, eventId);
      if (event.status !== 'Confirmed' || bookingSignature(event) !== bookingSignature(before) ||
          sourceMapping(event, await store.teams(source), group.id, group.parentGroupId).mappingSignature !== candidate.mappingSignature) {
        throw new HttpError(409, 'Booking or team mapping changed while linking; preview again');
      }
      const prior = store.metadata(event).spondAttendance;
      const existing = prior ? attendanceSchema.parse(prior) : null;
      const sources = existing?.bookingSignature === bookingSignature(event)
        ? existing.sources.filter(item => item.id !== providerId || item.groupId !== group.id) : [];
      if (sources.length >= 20) throw new HttpError(409, 'Use at most 20 distinct Spond events for a QMT event');
      sources.push(candidate);
      await store.saveAttendance(source, event, { version: 1, bookingSignature: bookingSignature(event), sources });
    });
    return { linked: true, sourceId: providerId, message: 'Attendance link saved; bookings and Spond are unchanged. The next refresh consolidates reviewed sources.' };
  };
  const unlink = async eventId => {
    requireEnabled();
    await store.locked(async source => {
      const event = await store.event(source, eventId);
      const metadata = store.metadata(event);
      if (!metadata.spondAttendance) throw new HttpError(404, 'No reviewed attendance links on this event');
      await store.removeAttendance(source, event);
    });
    return { unlinked: true };
  };
  const cycle = async () => {
    let lease;
    try {
      lease = await store.locked(async source => {
        const connection = await store.connection(source);
        if (!connection || !connection.authorized || connection.blocked || Date.parse(connection.nextRunAt) > connection.now ||
            (connection.runningUntil && Date.parse(connection.runningUntil) > connection.now)) return null;
        const current = { ...connection, leaseId: randomUUID(), lastAttemptAt: new Date(connection.now).toISOString(),
          nextRunAt: new Date(connection.now + intervalMs).toISOString(), runningUntil: new Date(connection.now + intervalMs).toISOString() };
        await store.saveConnection(source, current);
        return current;
      });
      if (!lease) return;
      let token;
      try { token = vault.open(lease.encryptedToken); }
      catch { throw new HttpError(401, 'Stored Spond connection cannot be decrypted; reconnect after key rotation'); }
      const events = await store.linkedEvents(), cache = new Map();
      let budget = 50, processed = 0, failed = 0, queued = events.length, blocked = false, lastError = null;
      const leaseCurrent = async () => {
        const current = await store.connection();
        return current?.id === lease.id && current.leaseId === lease.leaseId && current.authorized && !stopped;
      };
      for (const event of events) {
        if (stopped || now() - Date.parse(lease.lastAttemptAt) > 10 * 60000 || !await leaseCurrent()) break;
        const attendance = attendanceSchema.parse(store.metadata(event).spondAttendance);
        const unread = [...new Set(attendance.sources.map(item => item.id))].filter(id => !cache.has(id));
        if (unread.length > budget) break;
        budget -= unread.length;
        let updated;
        try {
          if (attendance.bookingSignature !== bookingSignature(event)) throw new HttpError(409, 'Booking changed; review attendance links again');
          const teams = await store.teams(), results = [];
          for (const item of attendance.sources) {
            if (sourceMapping(event, teams, item.groupId, item.parentGroupId).mappingSignature !== item.mappingSignature) {
              throw new HttpError(409, 'Team mapping changed; review attendance links again');
            }
            if (!cache.has(item.id)) {
              if (!await leaseCurrent()) throw new HttpError(409, 'Attendance connection stopped while refreshing');
              cache.set(item.id, client.get(token, `sponds/${item.id}`, { includeComments: 'false', addProfileInfo: 'false' }));
            }
            const raw = await cache.get(item.id);
            results.push({ source: item, exactAudience: validateProviderEvent(raw, event, item, timezone), responses: responseSets(raw) });
          }
          const covered = new Set(attendance.sources.flatMap(item => item.teamIds));
          if (eventTeamIds(event).some(id => !covered.has(id))) throw new HttpError(409, 'Link Spond attendance for every participating team before consolidating this event');
          updated = { ...attendance, error: undefined, lastAttemptAt: new Date(now()).toISOString(),
            snapshot: { ...consolidate(results), syncedAt: new Date(now()).toISOString() } };
        } catch (error) {
          blocked = error instanceof SpondError && [401, 403].includes(error.providerStatus);
          lastError = errorText(error);
          updated = { ...attendance, error: lastError, lastAttemptAt: new Date(now()).toISOString() };
          failed++;
          logger.error('Spond attendance event refresh failed', { eventId: event.id, code: blocked ? 'RECONNECT_REQUIRED' : 'ATTENDANCE_UNAVAILABLE' });
        }
        const saved = await store.locked(async source => {
          const connection = await store.connection(source);
          if (connection?.id !== lease.id || connection.leaseId !== lease.leaseId || !connection.authorized) return false;
          const current = await store.event(source, event.id);
          const currentAttendance = store.metadata(current).spondAttendance;
          if (current.status !== 'Confirmed' || bookingSignature(current) !== bookingSignature(event) ||
              !currentAttendance || JSON.stringify(attendanceSchema.parse(currentAttendance)) !== JSON.stringify(attendance)) return false;
          const currentTeams = await store.teams(source);
          let mappingsCurrent;
          try {
            mappingsCurrent = attendance.sources.every(item =>
              sourceMapping(current, currentTeams, item.groupId, item.parentGroupId).mappingSignature === item.mappingSignature);
          } catch (error) {
            if (!error.status) throw error;
            mappingsCurrent = false;
          }
          if (!mappingsCurrent) {
            if (!updated.error) failed++;
            updated = { ...attendance, error: 'Team mapping changed; review attendance links again', lastAttemptAt: new Date(now()).toISOString() };
            lastError = updated.error;
            logger.error('Spond attendance mapping changed during refresh', { eventId: event.id, code: 'MAPPING_REVIEW_REQUIRED' });
          }
          await store.saveAttendance(source, current, updated);
          return true;
        });
        if (!saved) {
          if (!updated.error) failed++;
          lastError = 'An event or attendance link changed during refresh; review the current links';
        }
        if (saved && !updated.error) processed++;
        queued--;
        if (blocked) break;
      }
      await store.locked(async source => {
        const current = await store.connection(source);
        if (current?.id !== lease.id || current.leaseId !== lease.leaseId) return;
        await store.saveConnection(source, { ...current, runningUntil: null, leaseId: null,
          lastSuccessAt: processed ? new Date(now()).toISOString() : current.lastSuccessAt,
          processed, failed, queued, blocked, error: lastError });
      });
    } catch (error) {
      logger.error('Spond attendance cycle failed', { code: 'ATTENDANCE_CYCLE_UNAVAILABLE' });
      if (lease) await store.locked(async source => {
        const current = await store.connection(source);
        if (current?.id !== lease.id || current.leaseId !== lease.leaseId) return;
        await store.saveConnection(source, { ...current, runningUntil: null, leaseId: null,
          blocked: error instanceof HttpError && error.status === 401, error: errorText(error) });
      });
    }
  };
  const tick = () => {
    if (!enabled || stopped) return Promise.resolve();
    if (!running) running = cycle().finally(() => { running = null; });
    return running;
  };
  const requestRefresh = async () => {
    requireEnabled();
    await store.locked(async source => {
      const current = await store.connection(source);
      if (!current?.authorized || current.blocked) throw new HttpError(409, 'Connect Spond attendance before refreshing');
      if ((current.runningUntil && Date.parse(current.runningUntil) > current.now) ||
          (current.lastAttemptAt && current.now - Date.parse(current.lastAttemptAt) < intervalMs)) {
        throw new HttpError(429, 'An attendance refresh is running or was attempted within the last 15 minutes');
      }
      await store.saveConnection(source, { ...current, nextRunAt: new Date(current.now).toISOString() });
    });
    void tick().catch(() => logger.error('Attendance refresh unavailable', { code: 'ATTENDANCE_UNAVAILABLE' }));
    return { queued: true };
  };
  const links = async () => (await store.linkedEvents()).map(event => {
    const attendance = attendanceSchema.parse(store.metadata(event).spondAttendance);
    return { eventId: event.id, title: event.description || event.event_type, start: new Date(event.start_time).toISOString(),
      sourceCount: attendance.sources.length, lastSync: attendance.snapshot?.syncedAt || null, error: attendance.error || null };
  });
  return { status, connect, disconnect, link, unlink, links, tick, requestRefresh,
    start() {
      if (!enabled || timer) return;
      timer = setInterval(() => { void tick().catch(() => logger.error('Attendance scheduler unavailable', { code: 'ATTENDANCE_UNAVAILABLE' })); }, 60000);
      timer.unref();
    },
    async close() { stopped = true; if (timer) clearInterval(timer); await running; },
  };
}

module.exports = { createAttendanceService };
