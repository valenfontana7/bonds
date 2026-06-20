import { configureWebPush, getPublicAppUrl, sendDigestToDevice } from '../../lib/push.js';
import { methodNotAllowed, parseBody } from '../../lib/http.js';

configureWebPush(process.env);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const { deviceId } = parseBody(req);
  if (!deviceId) {
    res.status(400).json({ error: 'deviceId es obligatorio.' });
    return;
  }

  try {
    const payload = await sendDigestToDevice(deviceId, getPublicAppUrl(), { force: true });
    res.status(200).json({ ok: true, payload });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
