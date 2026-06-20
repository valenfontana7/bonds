import webpush from 'web-push';
import { buildPushPayload, todayKeyForTimezone } from './notifications.js';
import { readSubscribers, upsertSubscriber } from './store.js';

let configured = false;

export function configureWebPush(env = process.env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    configured = false;
    return false;
  }

  webpush.setVapidDetails(
    env.VAPID_SUBJECT || 'mailto:support@bonds.app',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  configured = true;
  return true;
}

export function getPublicKey(env = process.env) {
  return env.VAPID_PUBLIC_KEY || null;
}

export async function sendPushToSubscriber(subscriber, payload) {
  if (!configured || !subscriber.subscription) {
    throw new Error('Push no configurado o suscripción ausente.');
  }

  await webpush.sendNotification(subscriber.subscription, JSON.stringify(payload), {
    TTL: 86_400,
    urgency: 'normal',
  });
}

export async function sendDigestToDevice(deviceId, appUrl, { force = false } = {}) {
  const subscribers = await readSubscribers();
  const subscriber = subscribers.find((entry) => entry.deviceId === deviceId);
  if (!subscriber?.enabled || !subscriber.subscription) {
    throw new Error('Dispositivo no suscripto.');
  }

  const people = subscriber.needsAttention ?? [];
  if (people.length === 0 && !force) {
    throw new Error('Nadie necesita atención ahora.');
  }

  const payload = buildPushPayload(
    force
      ? people.length
        ? people
        : [{ name: 'tu red', daysSinceContact: 0 }]
      : people,
    appUrl,
  );
  await sendPushToSubscriber(subscriber, payload);

  const today = todayKeyForTimezone(subscriber.timezone);
  await upsertSubscriber(deviceId, { lastServerDigestDate: today });
  return payload;
}

export async function runScheduledDigests(env = process.env) {
  if (!configured) return { sent: 0, skipped: 0 };

  const subscribers = await readSubscribers();
  let sent = 0;
  let skipped = 0;

  for (const subscriber of subscribers) {
    if (!subscriber.enabled || !subscriber.subscription) {
      skipped += 1;
      continue;
    }

    const people = subscriber.needsAttention ?? [];
    if (people.length === 0) {
      skipped += 1;
      continue;
    }

    const timezone = subscriber.timezone || 'UTC';
    const today = todayKeyForTimezone(timezone);

    if (subscriber.lastServerDigestDate === today) {
      skipped += 1;
      continue;
    }

    try {
      const payload = buildPushPayload(people, getPublicAppUrl(env));
      await sendPushToSubscriber(subscriber, payload);
      await upsertSubscriber(subscriber.deviceId, { lastServerDigestDate: today });
      sent += 1;
    } catch (error) {
      console.error(`Push falló para ${subscriber.deviceId}:`, error.message);
      skipped += 1;
    }
  }

  return { sent, skipped };
}

export function getPublicAppUrl(env = process.env) {
  if (env.PUBLIC_APP_URL) return env.PUBLIC_APP_URL.replace(/\/$/, '');
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return 'http://localhost:3001';
}
