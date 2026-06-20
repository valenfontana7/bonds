import { Redis } from '@upstash/redis';

let redisClient;

function pickHttpsPair(url, token) {
  if (url?.startsWith('https://') && token) return { url, token };
  return null;
}

/** Empareja URL REST https con el token de la misma fuente (Vercel KV vs Upstash). */
export function getRedisCredentials() {
  return (
    pickHttpsPair(process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN) ||
    pickHttpsPair(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN) ||
    pickHttpsPair(process.env.KV_URL, process.env.KV_REST_API_TOKEN)
  );
}

export function getRedis() {
  if (redisClient !== undefined) return redisClient;

  const credentials = getRedisCredentials();
  if (credentials) {
    redisClient = new Redis(credentials);
    return redisClient;
  }

  redisClient = null;
  return redisClient;
}

export function isRedisReady() {
  return !!getRedis();
}

const WRITE_PROBE_KEY = 'bonds:health:write-probe';

/** Comprueba que el token REST tenga permiso de escritura (SET). */
export async function checkRedisWritable() {
  const redis = getRedis();
  if (!redis) {
    return { ok: false, reason: 'missing_credentials' };
  }

  try {
    await redis.set(WRITE_PROBE_KEY, { t: Date.now() }, { ex: 30 });
    return { ok: true };
  } catch (error) {
    const message = error?.message ?? String(error);
    if (/NOPERM/i.test(message)) {
      return {
        ok: false,
        reason: 'read_only_token',
        message:
          'El token REST no puede ejecutar SET. Copiá KV_REST_API_URL y KV_REST_API_TOKEN (lectura/escritura) desde Vercel → Storage o Upstash → REST API.',
      };
    }
    return { ok: false, reason: 'write_failed', message };
  }
}
