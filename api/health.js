import { configureWebPush, getPublicAppUrl } from '../lib/push.js';
import { isPersistentStoreReady } from '../lib/store.js';
import { checkRedisWritable } from '../lib/redis.js';
import { methodNotAllowed } from '../lib/http.js';

configureWebPush(process.env);

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    methodNotAllowed(res, ['GET', 'HEAD']);
    return;
  }

  const writeCheck = await checkRedisWritable();
  const body = {
    ok: true,
    pushReady: configureWebPush(process.env),
    storeReady: isPersistentStoreReady(),
    storeWritable: writeCheck.ok,
    ...(writeCheck.ok ? {} : { storeError: writeCheck.message ?? writeCheck.reason }),
    publicAppUrl: getPublicAppUrl(),
  };

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  res.status(200).json(body);
}
