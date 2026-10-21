(() => {
  'use strict';

  const expectedOrigin = 'https://qmt.azurewebsites.net';
  if (window.location.origin !== expectedOrigin) {
    throw new Error('Run this snippet only in an already-open original QMT tab. Do not reload or change its origin.');
  }
  if (!document.body) {
    throw new Error('The original QMT document is not available. Preserve the browser profile; do not reload.');
  }

  const keys = [
    'app_events',
    'app_teams',
    'app_sites',
    'app_fields',
    'app_equipment',
    'app_facility_requests',
    'app_equipment_requests',
    'app_cancellation_requests',
  ];
  const capturedAt = new Date().toISOString();
  const entries = {};
  let presentKeyCount = 0;
  let arrayRecordCount = 0;

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    const entry = { raw, state: 'missing', recordCount: null };
    if (raw !== null) {
      presentKeyCount += 1;
      entry.state = 'invalid_json';
      try {
        const parsed = JSON.parse(raw);
        entry.state = Array.isArray(parsed) ? 'array' : 'non_array_json';
        if (Array.isArray(parsed)) {
          entry.recordCount = parsed.length;
          arrayRecordCount += parsed.length;
        }
      } catch {
        // Preserve malformed source text; never replace it with an empty array.
      }
    }
    entries[key] = entry;
  }

  if (presentKeyCount === 0) {
    throw new Error('No legacy QMT cache keys are present. Nothing exported; no recovery source established.');
  }

  const snapshot = {
    format: 'qmt-legacy-browser-cache-candidate',
    version: 1,
    origin: window.location.origin,
    capturedAt,
    keySpecificationRevision: '774bc483329b11719bac44759b94a7bc9753449a',
    presentKeyCount,
    arrayRecordCount,
    verifiedRecovery: false,
    entries,
  };
  if (!window.confirm(
    `Save a private QMT cache candidate from ${snapshot.origin}?\n` +
    `${presentKeyCount} present keys; ${arrayRecordCount} cached array records.\n` +
    'This may be empty, stale or incomplete and is NOT a verified backup. ' +
    'It may contain personal contact details. Nothing is uploaded or imported.'
  )) {
    console.info('QMT cache export cancelled. Browser storage is unchanged.');
    return;
  }

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  try {
    link.href = url;
    link.download = `qmt-legacy-cache-${capturedAt.replace(/[:.]/g, '-')}.json`;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  console.info('QMT private cache download requested. Verify the file was saved; no records have been validated or imported.');
})();
