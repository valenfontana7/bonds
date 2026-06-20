import { signToken } from '../../lib/auth.js';
import { isRedisReady } from '../../lib/redis.js';
import { loginUser } from '../../lib/users.js';
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

  const { email, password } = parseBody(req);

  try {
    const user = await loginUser(email, password);
    const token = signToken(user.id, user.email);
    res.status(200).json({ user, token });
  } catch (error) {
    const message = error.message || 'No se pudo iniciar sesión.';
    const status = message.includes('incorrectos') ? 401 : 400;
    res.status(status).json({ error: message });
  }
}
