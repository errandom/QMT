function createLogger() {
  function emit(level, message, details) {
    const error = details.find(value => value instanceof Error);
    // Never serialize recordsets, request bodies, SQL errors, tokens or provider responses.
    process.stderr.write(JSON.stringify({
      level,
      message: String(message).slice(0, 160),
      ...(error?.code ? { code: String(error.code).slice(0, 40) } : {}),
    }) + '\n');
  }
  return {
    log() {},
    warn(message, ...details) { emit('warning', message, details); },
    error(message, ...details) { emit('error', message, details); },
  };
}
module.exports = { createLogger };
