import { getRedis } from './redis.js';

const dataKey = (userId) => `bonds:data:${userId}`;

export async function getUserBondsData(userId) {
  const redis = getRedis();
  if (!redis) throw new Error('Almacenamiento no disponible.');

  const data = await redis.get(dataKey(userId));
  if (!data) {
    return { people: [], interactions: [], updatedAt: null };
  }

  return data;
}

export async function saveUserBondsData(userId, payload) {
  const redis = getRedis();
  if (!redis) throw new Error('Almacenamiento no disponible.');

  const next = {
    people: payload.people ?? [],
    interactions: payload.interactions ?? [],
    updatedAt: new Date().toISOString(),
  };

  await redis.set(dataKey(userId), next);
  return next;
}
