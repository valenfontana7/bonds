import { configureWebPush, getPublicKey } from '../../lib/push.js';
import { methodNotAllowed } from '../../lib/http.js';

configureWebPush(process.env);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  const publicKey = getPublicKey();
  if (!publicKey) {
    res.status(503).json({ error: 'VAPID no configurado.' });
    return;
  }

  res.status(200).json({ publicKey });
}
