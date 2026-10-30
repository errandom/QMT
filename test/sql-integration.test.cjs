const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../scripts/migrate.cjs');
const { transaction, saveBooking } = require('../server/bookings.cjs');
const { createApp } = require('../server.js');
const { initializeFreshDatabase } = require('../scripts/initialize-app-service.cjs');
const { operationalTables } = require('../scripts/provision-database-user.cjs');
const { checkDatabase } = require('../scripts/check-database.cjs');

test('disposable SQL migration, concurrency, rollback and durable requests', {
  skip: process.env.QMT_TEST_DATABASE_APPROVED !== 'true', timeout: 120000,
}, async t => {
  assert.match(process.env.SQL_DATABASE, /^qmt_test_[a-f0-9]+$/);
  assert.equal(process.env.SQL_SERVER, '127.0.0.1');
  let pool = await new sql.ConnectionPool({
    server: '127.0.0.1', port: Number(process.env.SQL_PORT), database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true }, pool: { min: 0, max: 5 },
  }).connect();
  const operatorPool = pool;
  let server, app;
  try {
    await t.test('legacy base-schema upgrade preserves data without inventing request payloads', async () => {
      assert.match(process.env.SQL_LEGACY_DATABASE, /^qmt_test_[a-f0-9]+$/);
      const legacy = await new sql.ConnectionPool({
        server: '127.0.0.1', port: Number(process.env.SQL_PORT), database: process.env.SQL_LEGACY_DATABASE,
        user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
        options: { encrypt: true, trustServerCertificate: true }, pool: { min: 0, max: 1 },
      }).connect();
      try {
        const schema = fs.readFileSync(path.join(__dirname, '..', 'database-schema.sql'), 'utf8').split('-- Insert sample data (optional)')[0];
        assert.ok(schema.includes('CREATE TABLE events') && !schema.includes('INSERT INTO users'));
        await legacy.request().query(schema);
        await legacy.request().query(`
          INSERT INTO dbo.sites (name) VALUES ('Synthetic legacy site');
          INSERT INTO dbo.fields (site_id, name) VALUES (1, 'Synthetic legacy field');
          INSERT INTO dbo.teams (name, sport) VALUES ('Synthetic legacy team', 'Flag Football');
          INSERT INTO dbo.events (field_id, team_id, event_type, start_time, end_time)
            VALUES (1, 1, 'Practice', '2026-10-20T18:00:00', '2026-10-20T19:00:00');
          INSERT INTO dbo.requests (request_type, requestor_name) VALUES ('facility', 'Synthetic legacy request');
        `);
        await migrate(legacy);
        await migrate(legacy);
        const event = (await legacy.request().query('SELECT * FROM dbo.events')).recordset[0];
        assert.equal(event.field_ids, '1');
        assert.equal(event.team_ids, '1');
        assert.equal(event.start_time.toISOString(), '2026-10-20T18:00:00.000Z');
        const request = (await legacy.request().query('SELECT * FROM dbo.requests')).recordset[0];
        assert.equal(request.payload, null);
        assert.equal(request.requestor_name, 'Synthetic legacy request');
        assert.equal((await legacy.request().query('SELECT COUNT(*) AS count FROM dbo.users')).recordset[0].count, 0);
      } finally { await legacy.close(); }
    });
    await migrate(pool);
    await migrate(pool);
    const migrations = await pool.request().query('SELECT COUNT(*) AS count FROM dbo.qmt_migrations');
    assert.equal(migrations.recordset[0].count, fs.readdirSync(path.join(__dirname, '..', 'migrations'))
      .filter(name => /^\d+[-\w]*\.sql$/.test(name)).length);
    const applicationPassword = `aA1!${randomBytes(20).toString('hex')}`;
    const initialization = {
      SQL_USER: process.env.SQL_USER, SQL_PASSWORD: process.env.SQL_PASSWORD,
      QMT_APP_SQL_USER: 'qmt_runtime_test', QMT_APP_SQL_PASSWORD: applicationPassword,
      QMT_ADMIN_USERNAME: 'QMTadmin', QMT_ADMIN_PASSWORD: `aA1!${randomBytes(20).toString('hex')}`,
    };
    await t.test('bootstrap failure rolls back application principal and administrator together', async () => {
      await operatorPool.request().query(`CREATE TRIGGER dbo.qmt_test_bootstrap_failure ON dbo.users
        AFTER INSERT AS THROW 51000, 'Synthetic bootstrap rejection', 1;`);
      await assert.rejects(initializeFreshDatabase(operatorPool, initialization));
      const result = await operatorPool.request().query(`SELECT
        DATABASE_PRINCIPAL_ID('qmt_runtime_test') AS principal_id,
        (SELECT COUNT(*) FROM dbo.users) AS administrators`);
      assert.equal(result.recordset[0].principal_id, null);
      assert.equal(result.recordset[0].administrators, 0);
      await operatorPool.request().query('DROP TRIGGER dbo.qmt_test_bootstrap_failure');
    });
    await t.test('fresh initialization creates QMTadmin and a separate contained application user', async () => {
      await initializeFreshDatabase(operatorPool, initialization);
      await checkDatabase(operatorPool);
      const admin = (await operatorPool.request().query("SELECT username, role, password_hash FROM dbo.users")).recordset;
      assert.equal(admin.length, 1);
      assert.equal(admin[0].username, 'QMTadmin');
      assert.equal(admin[0].role, 'admin');
      assert.match(admin[0].password_hash, /^\$2[aby]\$/);
      await assert.rejects(initializeFreshDatabase(operatorPool, initialization), /empty operational tables/);
      pool = await new sql.ConnectionPool({
        server: '127.0.0.1', port: Number(process.env.SQL_PORT), database: process.env.SQL_DATABASE,
        user: initialization.QMT_APP_SQL_USER, password: applicationPassword,
        options: { encrypt: true, trustServerCertificate: true }, pool: { min: 0, max: 5 },
      }).connect();
    });
    await t.test('application credentials have operational DML but no migration, schema or role rights', async () => {
      for (const table of operationalTables) {
        for (const permission of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          const rows = await pool.request().input('object', sql.NVarChar(255), `dbo.${table}`)
            .input('permission', sql.NVarChar(50), permission)
            .query("SELECT HAS_PERMS_BY_NAME(@object, 'OBJECT', @permission) AS allowed");
          assert.equal(rows.recordset[0].allowed, 1);
        }
      }
      await assert.rejects(pool.request().query('SELECT * FROM dbo.qmt_migrations'));
      await assert.rejects(pool.request().query('CREATE TABLE dbo.qmt_unwanted (id int)'));
      const permissions = await pool.request().query(`SELECT
        HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'ALTER ANY USER') AS alter_users,
        HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'ALTER ANY ROLE') AS alter_roles,
        HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CONTROL') AS control_database`);
      assert.deepEqual(permissions.recordset[0], { alter_users: 0, alter_roles: 0, control_database: 0 });
    });
    const seed = await pool.request().query(`
      INSERT INTO dbo.sites (name) VALUES ('Synthetic test site');
      DECLARE @site int = SCOPE_IDENTITY();
      INSERT INTO dbo.fields (site_id, name) VALUES (@site, 'Synthetic test field');
      DECLARE @field int = SCOPE_IDENTITY();
      INSERT INTO dbo.teams (name, sport) VALUES ('Synthetic test team', 'Flag Football');
      DECLARE @team int = SCOPE_IDENTITY();
      INSERT INTO dbo.users (username, password_hash, role) VALUES ('synthetic-test-admin', 'no-login-test-fixture', 'admin');
      SELECT @field AS field, @team AS team, SCOPE_IDENTITY() AS admin;
    `);
    const fixture = seed.recordset[0];
    const booking = (date, start = '18:00', end = '19:00') => ({
      event_type: 'Practice', start_time: `${date}T${start}:00Z`, end_time: `${date}T${end}:00Z`,
      team_ids: String(fixture.team), field_ids: String(fixture.field),
    });
    const save = (body, id) => transaction(pool, tx => saveBooking(tx, body, id));
    await t.test('adjacent intervals succeed; overlapping simultaneous writers cannot both commit', async () => {
      await save(booking('2026-10-20'));
      await save(booking('2026-10-20', '19:00', '20:00'));
      const attempts = await Promise.allSettled([save(booking('2026-10-21')), save(booking('2026-10-21'))]);
      assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
      assert.equal(attempts.find(item => item.status === 'rejected').reason.status, 409);
    });
    await t.test('late recurrence conflict rolls back the entire series', async () => {
      await save(booking('2026-11-10'));
      await assert.rejects(save({ ...booking('2026-11-03'), recurring_days: '2', recurring_end_date: '2026-11-10' }),
        error => error.status === 409);
      const rows = await pool.request().query("SELECT id FROM events WHERE start_time = '2026-11-03T18:00:00'");
      assert.equal(rows.recordset.length, 0);
    });
    await t.test('failed update preserves the original and self-overlapping recurrence is rejected', async () => {
      const original = await save(booking('2026-12-01'));
      await save(booking('2026-12-02'));
      await assert.rejects(save(booking('2026-12-02'), original.id), error => error.status === 409);
      const row = await pool.request().input('id', sql.Int, original.id)
        .query('SELECT start_time FROM events WHERE id = @id');
      assert.equal(row.recordset[0].start_time.toISOString(), '2026-12-01T18:00:00.000Z');
      await assert.rejects(save({
        ...booking('2027-01-01'), end_time: '2027-01-03T18:00:00Z',
        recurring_days: '1,2,3,4,5,6,7', recurring_end_date: '2027-01-03',
      }, original.id), error => error.status === 409);
    });
    await t.test('recurrence reports all overlaps and an explicit override saves without modifying existing bookings', async () => {
      const first = await save({ ...booking('2027-04-06'), description: 'First existing practice' });
      const second = await save({ ...booking('2027-04-13'), description: 'Second existing practice' });
      const series = { ...booking('2027-04-06'), recurring_days: '2', recurring_end_date: '2027-04-13' };
      await assert.rejects(save(series), error => {
        assert.equal(error.status, 409);
        assert.equal(error.conflicts.length, 2);
        assert.equal(error.conflicts[0].eventId, first.id);
        assert.equal(error.conflicts[1].eventId, second.id);
        assert.equal(error.conflicts[0].fields[0].name, 'Synthetic test field');
        assert.equal(error.conflicts[0].fields[0].siteName, 'Synthetic test site');
        assert.equal(error.conflicts[0].teams[0].name, 'Synthetic test team');
        return true;
      });
      const saved = await save({ ...series, allow_conflicts: true });
      assert.equal(saved.length, 2);
      const originals = await pool.request().input('first', sql.Int, first.id).input('second', sql.Int, second.id)
        .query('SELECT * FROM events WHERE id IN (@first, @second) ORDER BY id');
      assert.deepEqual(originals.recordset, [first, second]);
      await assert.rejects(save(booking('2027-04-06'), first.id), error => error.status === 409);
      const edited = await save({ ...booking('2027-04-06'), allow_conflicts: true }, first.id);
      assert.equal(edited.id, first.id);
    });
    const secret = 'synthetic-sql-test-secret-not-a-production-credential';
    const token = jwt.sign({ id: fixture.admin, role: 'admin', username: 'synthetic-test-admin' }, secret);
    const start = async () => {
      app = createApp({ env: { JWT_SECRET: secret, QMT_API_REQUESTS_PER_MINUTE: '300' }, connect: async () => pool });
      server = app.listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
      return `http://127.0.0.1:${server.address().port}`;
    };
    const stop = async () => {
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
      server = undefined;
      await app.locals.close();
    };
    let base = await start();
    const post = async (url, body, key, authenticated = false) => fetch(base + url, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(key ? { 'Idempotency-Key': key } : {}), ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const submission = {
      type: 'facility', requestorName: 'Synthetic fixture', requestorPhone: '555-0100',
      eventType: 'Practice', teamIds: [String(fixture.team)], date: '2027-02-01', startTime: '18:00', duration: 60,
    };
    const prepareFacility = async (id, locationType = 'field') => {
      let version = 0;
      for (const action of [
        { action: 'acknowledge', channel: 'Phone', message: 'Receipt acknowledged.' },
        { action: 'evaluate' },
        { action: 'configure', locationType, route: 'ZVIS', department: 'Synthetic allocation office',
          contactEmail: '', reference: 'TEST', followUpDate: '', permitNotes: '' },
        { action: 'send', channel: 'Email', message: 'Allocation inquiry sent manually.' },
        { action: 'response', message: 'Allocation confirmed without additional conditions.' },
      ]) {
        const response = await post(`/api/requests/${id}/workflow`, { ...action, expectedVersion: version }, null, true);
        assert.equal(response.status, 200);
        version = (await response.json()).workflow.version;
      }
      return version;
    };
    let requestId;
    await t.test('retries are idempotent and changed payload is rejected', async () => {
      const key = randomUUID();
      const first = await post('/api/requests', submission, key);
      assert.equal(first.status, 201);
      requestId = (await first.json()).id;
      const retry = await post('/api/requests', submission, key);
      assert.equal(retry.status, 201);
      assert.equal((await retry.json()).id, requestId);
      assert.equal((await post('/api/requests', { ...submission, duration: 30 }, key)).status, 409);
    });
    await t.test('process restart retains requests; approval is atomic and cannot be repeated', async () => {
      assert.equal((await post(`/api/requests/${requestId}/review`, { status: 'Approved', expectedVersion: 0 }, null, true)).status, 409);
      const expectedVersion = await prepareFacility(requestId);
      await stop();
      await pool.connect();
      base = await start();
      const list = await fetch(base + '/api/requests', { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(list.status, 200);
      const saved = (await list.json()).find(request => request.id === requestId);
      assert.equal(saved.workflow.stage, 'Response received');
      assert.equal(saved.workflow.history.length, 5);
      const approvals = await Promise.all([
        post(`/api/requests/${requestId}/review`, { status: 'Approved', fieldId: String(fixture.field), expectedVersion }, null, true),
        post(`/api/requests/${requestId}/review`, { status: 'Approved', fieldId: String(fixture.field), expectedVersion }, null, true),
      ]);
      assert.deepEqual(approvals.map(response => response.status).sort(), [200, 409]);
      const approved = await approvals.find(response => response.status === 200).json();
      assert.equal(approved.request.reviewedBy, 'synthetic-test-admin');
      assert.equal(approved.event.field_id, fixture.field);
      assert.equal(approved.request.workflow.outcomeNotifiedAt, undefined);
      const notified = await post(`/api/requests/${requestId}/workflow`, {
        action: 'notify', expectedVersion: approved.request.workflow.version, channel: 'Email', message: 'Outcome sent manually.',
      }, null, true);
      assert.equal(notified.status, 200);
      assert.ok((await notified.json()).workflow.outcomeNotifiedAt);
    });
    await t.test('conflicting approval leaves the request pending and creates no partial booking', async () => {
      const first = await post('/api/requests', submission, randomUUID());
      const id = (await first.json()).id;
      const expectedVersion = await prepareFacility(id);
      assert.equal((await post(`/api/requests/${id}/review`, { status: 'Approved', fieldId: String(fixture.field), expectedVersion }, null, true)).status, 409);
      const rows = await pool.request().input('id', sql.Int, id).query('SELECT status FROM requests WHERE id = @id');
      assert.equal(rows.recordset[0].status, 'pending');
    });
    await t.test('meeting-room approval rejects a field and creates only the matching room booking', async () => {
      const room = (await pool.request().input('field', sql.Int, fixture.field).query(`
        INSERT INTO fields (site_id, name, location_type)
          OUTPUT INSERTED.id SELECT site_id, 'Synthetic meeting room', 'meeting_room' FROM fields WHERE id = @field
      `)).recordset[0].id;
      const submitted = await post('/api/requests', { ...submission, eventType: 'Meeting', locationType: 'meeting_room' }, randomUUID());
      assert.equal(submitted.status, 201);
      const id = (await submitted.json()).id;
      const expectedVersion = await prepareFacility(id, 'meeting_room');
      assert.equal((await post(`/api/requests/${id}/review`, {
        status: 'Approved', fieldId: String(fixture.field), expectedVersion,
      }, null, true)).status, 400);
      const approved = await post(`/api/requests/${id}/review`, { status: 'Approved', fieldId: String(room), expectedVersion }, null, true);
      assert.equal(approved.status, 200);
      const result = await approved.json();
      assert.equal(result.event.field_id, room);
      assert.equal(result.request.workflow.approvedFieldId, String(room));
    });
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (app) await app.locals.close();
    await pool.close();
    if (operatorPool !== pool) await operatorPool.close();
  }
});
