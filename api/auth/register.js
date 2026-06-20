import { signToken } from '../../lib/auth.js';
import { isRedisReady } from '../../lib/redis.js';
import { registerUser } from '../../lib/users.js';
import { methodNotAllowed, parseBody } from '../../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  if (!isRedisReady()) {
    res.status(503).json({ error: 'Sync en la nube no disponible (falta Redis).' });
    return;
  }

  const { email, password, name } = parseBody(req);

  try {
    const user = await registerUser(email, password, name);
    const token = signToken(user.id, user.email);
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
