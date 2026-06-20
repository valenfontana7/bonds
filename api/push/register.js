import { configureWebPush } from '../../../server/src/push.js';
import { removeSubscriber, upsertSubscriber } from '../../../server/src/store.js';
import { methodNotAllowed, parseBody } from '../../_lib/http.js';

configureWebPush(process.env);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { deviceId, subscription, timezone, digestHour } = parseBody(req);
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

    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === 'DELETE') {
    const { deviceId } = parseBody(req);
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId es obligatorio.' });
      return;
    }

    await removeSubscriber(deviceId);
    res.status(200).json({ ok: true });
    return;
  }

  methodNotAllowed(res, ['POST', 'DELETE']);
}
