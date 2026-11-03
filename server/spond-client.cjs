const BASE = 'https://api.spond.com/core/v1/';

class SpondError extends Error {
  constructor(message, code, providerStatus) {
    super(message);
    this.name = 'SpondError';
    this.code = code;
    this.providerStatus = providerStatus;
  }
}

function createSpondClient({ fetchImpl = fetch, timeoutMs = 10000, maxBytes = 2 * 1024 * 1024, maxConcurrent = 3 } = {}) {
  for (const value of [timeoutMs, maxBytes, maxConcurrent]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Invalid Spond client limits');
  }
  let active = 0;
  async function request(endpoint, { token, method = 'GET', body, params = {} } = {}) {
    const url = new URL(endpoint, BASE);
    if (url.origin !== new URL(BASE).origin || !url.pathname.startsWith('/core/v1/')
        || url.username || url.password || url.hash) {
      throw new SpondError('Invalid Spond endpoint', 'INVALID_INPUT');
    }
    if (token !== undefined && (typeof token !== 'string' || !token.trim())) {
      throw new SpondError('Spond authentication token is missing', 'INVALID_INPUT');
    }
    if (active >= maxConcurrent) throw new SpondError('Spond is busy; retry later', 'BUSY');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    if (url.pathname === '/core/v1/groups') url.searchParams.set('includeMembers', 'true');
    const controller = new AbortController();
    let timer;
    active++;
    try {
      const expired = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new SpondError('Spond request timed out; check the connection before retrying', 'TIMEOUT'));
        }, timeoutMs);
      });
      const operation = async () => {
        const response = await fetchImpl(url.href, {
          method, redirect: 'error', signal: controller.signal,
          headers: { Accept: 'application/json', 'Content-Type': 'application/json',
            ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        if (!response.ok) {
          controller.abort();
          const message = response.status === 429 ? 'Spond rate limit reached; wait before retrying'
            : response.status === 401 || response.status === 403 ? 'Spond authentication failed; check credentials or sign in again'
              : `Spond service returned HTTP ${response.status}`;
          throw new SpondError(message, 'PROVIDER_HTTP', response.status);
        }
        if (Number(response.headers.get('content-length')) > maxBytes) {
          controller.abort();
          throw new SpondError('Spond response exceeds the allowed size; narrow the sync scope', 'RESPONSE_LIMIT');
        }
        const reader = response.body?.getReader();
        const chunks = [];
        let size = 0;
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maxBytes) {
              controller.abort();
              throw new SpondError('Spond response exceeds the allowed size; narrow the sync scope', 'RESPONSE_LIMIT');
            }
            chunks.push(Buffer.from(value));
          }
        }
        try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { throw new SpondError('Spond returned an invalid JSON response', 'INVALID_RESPONSE'); }
      };
      return await Promise.race([operation(), expired]);
    } catch (error) {
      if (error instanceof SpondError) throw error;
      throw new SpondError('Spond connection failed; check the connection before retrying', 'CONNECTION');
    } finally {
      clearTimeout(timer);
      active--;
    }
  }
  return {
    async login(username, password) {
      if (typeof username !== 'string' || !username.trim() || username.length > 254
          || typeof password !== 'string' || !password || password.length > 4096) {
        throw new SpondError('A Spond email and password are required', 'INVALID_INPUT');
      }
      const data = await request('login', { method: 'POST', body: { email: username.trim(), password } });
      if (!data || typeof data.loginToken !== 'string' || !data.loginToken.trim()) {
        throw new SpondError('Spond login did not return a token; additional authentication may be required', 'INVALID_RESPONSE');
      }
      return data.loginToken;
    },
    get(token, endpoint, params) { return request(endpoint, { token, params }); },
    post(token, endpoint, body) { return request(endpoint, { token, method: 'POST', body }); },
  };
}

module.exports = { createSpondClient, SpondError };
