const cacheState = (entry, ttl, now = Date.now()) => !entry ? "missing" : now - entry.at < ttl ? "fresh" : "expired";
function createSingleFlight() {
  let state = { phase: "idle" };
  return {
    get busy() { return state.phase === "running"; },
    get value() { return state.phase === "running" ? state.promise : null; },
    run(action) {
      if (state.phase === "running") return state.promise;
      const promise = action().finally(() => { if (state.promise === promise) state = { phase: "idle" }; });
      state = { phase: "running", promise }; return promise;
    },
  };
}
function createReadCache(ttl, maximum = Infinity, now = () => Date.now()) {
  const entries = new Map();
  return {
    clear() { entries.clear(); },
    get(key, build) {
      const hit = entries.get(key);
      if (cacheState(hit, ttl, now()) === "fresh") return hit.promise;
      const promise = build();
      if (entries.size >= maximum) entries.clear();
      const entry = { at: now(), phase: "pending", promise };
      entries.set(key, entry);
      promise.then(() => { if (entries.get(key) === entry) entry.phase = "ready"; }, () => { if (entries.get(key) === entry) entries.delete(key); });
      return promise;
    },
  };
}
function createSerialQueue() {
  let tail = Promise.resolve(), waiting = 0, running = false;
  return {
    get phase() { return running ? "running" : waiting ? "queued" : "idle"; },
    enqueue(action) {
      waiting++;
      const promise = tail.then(async () => {
        waiting--; running = true;
        try { return await action(); } finally { running = false; }
      });
      tail = promise.catch(() => {}); return promise;
    },
  };
}
const lazyState = (value, error) => error || value === null ? "unavailable" : value === undefined ? "uninitialized" : "ready";
module.exports = { cacheState, createSingleFlight, createReadCache, createSerialQueue, lazyState };
