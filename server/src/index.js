import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cron from 'node-cron';
import {
  configureWebPush,
  getPublicAppUrl,
  getPublicKey,
  runScheduledDigests,
  sendDigestToDevice,
} from './push.js';
import { getSubscriber, isPersistentStoreReady, removeSubscriber, upsertSubscriber } from './store.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const publicAppUrl = getPublicAppUrl(process.env);
const clientOrigin = process.env.CLIENT_ORIGIN || publicAppUrl;
const pushReady = configureWebPush(process.env);

app.use(
  cors({
    origin: clientOrigin.split(',').map((value) => value.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    pushReady,
    storeReady: isPersistentStoreReady(),
    publicAppUrl,
  });
});

app.get('/api/push/vapid-public-key', (_req, res) => {
  const publicKey = getPublicKey(process.env);
  if (!publicKey) {
    res.status(503).json({ error: 'VAPID no configurado.' });
    return;
  }
  res.json({ publicKey });
});

app.post('/api/push/register', async (req, res) => {
  const { deviceId, subscription, timezone, digestHour } = req.body ?? {};
  if (!deviceId || !subscription?.endpoint) {
    res.status(400).json({ error: 'deviceId y subscription son obligatorios.' });
    return;
  }

  await upsertSubscriber(deviceId, {
    subscription,
    enabled: true,
    timezone: timezone || 'UTC',
    digestHour: Number.isFinite(digestHour) ? digestHour : undefined,
  });

  res.json({ ok: true });
});

app.put('/api/push/snapshot', async (req, res) => {
  const { deviceId, enabled, needsAttention, lastDigestDate, timezone, digestHour } =
    req.body ?? {};

  if (!deviceId) {
    res.status(400).json({ error: 'deviceId es obligatorio.' });
    return;
  }

  const existing = await getSubscriber(deviceId);
  if (!existing) {
    res.status(404).json({ error: 'Dispositivo no registrado.' });
    return;
  }

  await upsertSubscriber(deviceId, {
    enabled: enabled ?? existing.enabled,
    needsAttention: Array.isArray(needsAttention) ? needsAttention : existing.needsAttention,
    lastDigestDate: lastDigestDate ?? existing.lastDigestDate,
    timezone: timezone || existing.timezone,
    digestHour: Number.isFinite(digestHour) ? digestHour : existing.digestHour,
  });

  res.json({ ok: true });
});

app.delete('/api/push/register', async (req, res) => {
  const deviceId = req.body?.deviceId;
  if (!deviceId) {
    res.status(400).json({ error: 'deviceId es obligatorio.' });
    return;
  }

  await removeSubscriber(deviceId);
  res.json({ ok: true });
});

app.post('/api/push/test', async (req, res) => {
  const { deviceId } = req.body ?? {};
  if (!deviceId) {
    res.status(400).json({ error: 'deviceId es obligatorio.' });
    return;
  }

  try {
    const payload = await sendDigestToDevice(deviceId, publicAppUrl, { force: true });
    res.json({ ok: true, payload });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const staticDir = process.env.STATIC_DIR
  ? path.resolve(__dirname, '..', process.env.STATIC_DIR)
  : null;

if (staticDir && fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

cron.schedule('*/15 * * * *', async () => {
  if (!pushReady) return;
  const result = await runScheduledDigests(process.env);
  if (result.sent > 0) {
    console.log(`Push programado enviado: ${result.sent}`);
  }
});

app.listen(port, () => {
  console.log(`Bonds push server en http://localhost:${port}`);
  console.log(`Push listo: ${pushReady ? 'sí' : 'no (generá VAPID con npm run vapid)'}`);
  if (staticDir && fs.existsSync(staticDir)) {
    console.log(`Sirviendo PWA desde ${staticDir}`);
  }
});
