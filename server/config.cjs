function integer(env, name, fallback, min, max) {
  const value = env[name] === undefined ? fallback : Number(env[name]);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function flag(env, name) {
  if (env[name] !== undefined && !['true', 'false'].includes(env[name])) {
    throw new Error(`${name} must be true or false`);
  }
  return env[name] === 'true';
}

function readConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32 || /your.secret|change.in.production/i.test(jwtSecret)) {
    throw new Error('JWT_SECRET must be an independently generated secret of at least 32 characters');
  }
  const aiEnabled = flag(env, 'QMT_AI_ENABLED');
  const spondEnabled = flag(env, 'QMT_SPOND_ENABLED');
  if (aiEnabled) {
    throw new Error('Legacy AI is retired; use the synthetic-only AI benchmark. Production AI requires durable quotas and provider approval');
  }
  if (env.NODE_ENV === 'production' && spondEnabled) {
    throw new Error('External integrations are disabled for production; durable quotas and provider approval are required first');
  }
  const transportEmail = env.QMT_TRANSPORT_EMAIL?.trim() || '';
  if (transportEmail && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(transportEmail)) {
    throw new Error('QMT_TRANSPORT_EMAIL must be a single valid email address');
  }
  return {
    jwtSecret,
    aiEnabled,
    spondEnabled,
    port: integer(env, 'PORT', 3000, 0, 65535),
    poolMax: integer(env, 'SQL_POOL_MAX', 5, 1, 5),
    requestsPerMinute: integer(env, 'QMT_API_REQUESTS_PER_MINUTE', 120, 1, 300),
    clubName: env.QMT_CLUB_NAME || 'QMT by errandom',
    timezone: env.QMT_TIMEZONE || 'Europe/Zurich',
    transportEmail,
  };
}

module.exports = { readConfig };
