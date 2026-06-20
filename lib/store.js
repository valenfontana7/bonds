import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'server', 'data');
const DATA_FILE = path.join(DATA_DIR, 'subscribers.json');
const REDIS_KEY = 'bonds:subscribers';

let redisClient;

function getRedisCredentials() {
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

function getRedis() {
  if (redisClient !== undefined) return redisClient;

  const credentials = getRedisCredentials();
  if (credentials) {
    redisClient = new Redis(credentials);
    return redisClient;
  }

  redisClient = null;
  return redisClient;
}

function ensureFileStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

export async function readSubscribers() {
  const redis = getRedis();
  if (redis) {
    return (await redis.get(REDIS_KEY)) ?? [];
  }

  ensureFileStore();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

export async function writeSubscribers(subscribers) {
  const redis = getRedis();
  if (redis) {
    await redis.set(REDIS_KEY, subscribers);
    return;
  }

  ensureFileStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(subscribers, null, 2), 'utf8');
}

export async function getSubscriber(deviceId) {
  const subscribers = await readSubscribers();
  return subscribers.find((entry) => entry.deviceId === deviceId) ?? null;
}

export async function upsertSubscriber(deviceId, patch) {
  const subscribers = await readSubscribers();
  const index = subscribers.findIndex((entry) => entry.deviceId === deviceId);
  const now = new Date().toISOString();
  const current = index >= 0 ? subscribers[index] : { deviceId, createdAt: now };

  const next = {
    ...current,
    ...patch,
    deviceId,
    updatedAt: now,
  };

  if (index >= 0) {
    subscribers[index] = next;
  } else {
    subscribers.push(next);
  }

  await writeSubscribers(subscribers);
  return next;
}

export async function removeSubscriber(deviceId) {
  const subscribers = await readSubscribers();
  await writeSubscribers(subscribers.filter((entry) => entry.deviceId !== deviceId));
}

export function isPersistentStoreReady() {
  if (process.env.VERCEL === '1') {
    return !!getRedis();
  }
  return true;
}
