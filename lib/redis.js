import { Redis } from '@upstash/redis';

let redisClient;

export function getRedisCredentials() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.KV_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;
  return { url, token };
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
