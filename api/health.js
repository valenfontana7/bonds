import {
  configureWebPush,
  getPublicAppUrl,
} from '../../server/src/push.js';
import { isPersistentStoreReady } from '../../server/src/store.js';
import { methodNotAllowed } from '../_lib/http.js';

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
