import { configureWebPush, getPublicAppUrl } from '../lib/push.js';
import { isPersistentStoreReady } from '../lib/store.js';
import { methodNotAllowed } from '../lib/http.js';

configureWebPush(process.env);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  res.status(200).json({
    ok: true,
    pushReady: configureWebPush(process.env),
    storeReady: isPersistentStoreReady(),
    publicAppUrl: getPublicAppUrl(),
  });
}
