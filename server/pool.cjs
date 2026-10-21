function createLazyPool(connect, reportError = console.error) {
  let pending;
  let pool;
  let closed = false;
  let failedAt = 0;
  async function getPool() {
    if (closed) throw new Error('Database pool is closed');
    if (pool?.connected) return pool;
    if (pending) return pending;
    if (failedAt && Date.now() - failedAt < 5000) {
      throw new Error('Database temporarily unavailable; retry later');
    }
    pending = Promise.resolve().then(async () => {
      if (pool) {
        const stale = pool;
        pool = undefined;
        await stale.close();
      }
      return connect();
    }).then(connected => {
      pool = connected;
      failedAt = 0;
      connected.on('error', error => {
        reportError('Database pool error', error);
        if (pool === connected) pool = undefined;
        failedAt = Date.now();
        connected.close().catch(closeError => reportError('Database pool close failed', closeError));
      });
      return connected;
    }).catch(error => {
      failedAt = Date.now();
      throw error;
    }).finally(() => { pending = undefined; });
    return pending;
  }
  async function close() {
    closed = true;
    try {
      const connected = pending ? await pending : pool;
      if (connected) await connected.close();
    } finally {
      pool = undefined;
    }
  }
  return { getPool, close };
}

module.exports = { createLazyPool };
