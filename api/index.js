import { getPublicAppUrl } from '../lib/push.js';
import { methodNotAllowed } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    methodNotAllowed(res, ['GET', 'HEAD']);
    return;
  }

  const body = {
    ok: true,
    service: 'bonds-push',
    endpoints: [
      '/api/health',
      '/api/push/vapid-public-key',
      '/api/push/register',
      '/api/push/snapshot',
      '/api/push/test',
    ],
    publicAppUrl: getPublicAppUrl(),
  };

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  res.status(200).json(body);
}
