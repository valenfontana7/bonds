import { getSubscriber, upsertSubscriber } from '../../lib/store.js';
import { methodNotAllowed, parseBody } from '../../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    methodNotAllowed(res, ['PUT']);
    return;
  }

  const { deviceId, enabled, needsAttention, upcomingBirthdays, lastDigestDate, timezone, digestHour } =
    parseBody(req);

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
    upcomingBirthdays: Array.isArray(upcomingBirthdays)
      ? upcomingBirthdays
      : existing.upcomingBirthdays,
    lastDigestDate: lastDigestDate ?? existing.lastDigestDate,
    timezone: timezone || existing.timezone,
    digestHour: Number.isFinite(digestHour) ? digestHour : existing.digestHour,
  });

  res.status(200).json({ ok: true });
}
