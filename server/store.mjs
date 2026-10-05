import { encryption, AppError, randomId } from './security.mjs';

// No process-memory persistence: every function instance uses the same durable store.
export function createStore(env, fetcher = fetch) {
  const crypt = encryption(env), prefix = env.ROMTECH_STORE_PREFIX;
  if (!prefix || !/^https:\/\//.test(env.UPSTASH_REDIS_REST_URL || '') || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new AppError(503, 'setup_required', 'נדרשת השלמת הגדרת השרת על ידי בעל האתר.');
  }
  const key = name => `${prefix}:${name}`;
  async function command(args) {
    const response = await fetcher(env.UPSTASH_REDIS_REST_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new AppError(503, 'store_unavailable', 'שירות החיבור אינו זמין כרגע. הנתונים לא שונו; נסה שוב.');
    const result = await response.json();
    if (result.error) throw new AppError(503, 'store_unavailable', 'שירות החיבור אינו זמין כרגע. נסה שוב.');
    return result.result;
  }
  return {
    async get(name) { return crypt.open(await command(['GET', key(name)])); },
    async take(name) { return crypt.open(await command(['GETDEL', key(name)])); },
    async set(name, value, ttl) { return command(['SET', key(name), crypt.seal(value), ...(ttl ? ['EX', ttl] : [])]); },
    async del(name) { return command(['DEL', key(name)]); },
    async rate(name, max, seconds) {
      const count = await command(['EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, key(`rate:${name}`), seconds]);
      if (count > max) throw new AppError(429, 'rate_limit', 'בוצעו יותר מדי ניסיונות. המתן כמה דקות ונסה שוב.');
    },
    async lock(name, fn) {
      const token = randomId(), lockKey = key(`lock:${name}`);
      if (!await command(['SET', lockKey, token, 'NX', 'EX', 90])) throw new AppError(409, 'busy', 'פעולה אחרת מתבצעת כרגע. המתן ונסה שוב.');
      try { return await fn(); }
      finally { await command(['EVAL', "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, lockKey, token]); }
    }
  };
}
