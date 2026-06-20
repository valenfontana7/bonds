import { configureWebPush, runScheduledDigests } from '../../server/src/push.js';
import { authorizeCron, methodNotAllowed } from '../_lib/http.js';

configureWebPush(process.env);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  if (!authorizeCron(req, res)) return;

  const result = await runScheduledDigests(process.env);
  res.status(200).json({ ok: true, ...result });
}
