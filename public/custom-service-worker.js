/// <reference lib="webworker" />
importScripts('./ngsw-worker.js');

const DB_NAME = 'bonds-notifications';
const STORE = 'snapshot';
const SNAPSHOT_KEY = 'current';
const PERIODIC_SYNC_TAG = 'bonds-attention-check';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readSnapshot() {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).get(SNAPSHOT_KEY);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      }),
  );
}

function writeSnapshot(snapshot) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(snapshot, SNAPSHOT_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildNotificationBody(people) {
  const names = people.slice(0, 3).map((p) => p.name);
  const extra = people.length > 3 ? ` y ${people.length - 3} más` : '';
  if (people.length === 1) {
    return `${people[0].name} hace ${people[0].daysSinceContact} días que no conectás. Un mensaje corto puede bastar.`;
  }
  return `${names.join(', ')}${extra} — tu red pide un poco de atención.`;
}

async function updateBadge(count) {
  const nav = self.navigator;
  if (!nav.setAppBadge) return;
  if (count > 0) {
    await nav.setAppBadge(count);
  } else if (nav.clearAppBadge) {
    await nav.clearAppBadge();
  }
}

async function checkAndNotify() {
  const snapshot = await readSnapshot();
  if (!snapshot) return;

  const count = snapshot.needsAttention?.length ?? 0;
  await updateBadge(count);

  if (!snapshot.enabled || count === 0) return;
  if (snapshot.lastDigestDate === todayKey()) return;

  const body = buildNotificationBody(snapshot.needsAttention);
  await self.registration.showNotification('Bonds — Tu red te espera', {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: 'bonds-attention-digest',
    data: { url: '/semana' },
  });

  await writeSnapshot({ ...snapshot, lastDigestDate: todayKey() });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === PERIODIC_SYNC_TAG) {
    event.waitUntil(checkAndNotify());
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? 'Tu red te espera.' };
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title || 'Bonds — Tu red te espera', {
        body: payload.body || 'Tu red te espera.',
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/icon-96x96.png',
        tag: payload.tag || 'bonds-attention-digest',
        data: { url: payload.url || '/semana' },
      });

      const snapshot = await readSnapshot();
      if (snapshot) {
        await writeSnapshot({ ...snapshot, lastDigestDate: todayKey() });
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_ATTENTION') {
    event.waitUntil(checkAndNotify());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/semana';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).pathname === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
