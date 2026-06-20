import { isGeminiConfigured, parseNetworkParagraph } from '../../lib/gemini.js';
import { isRedisReady } from '../../lib/redis.js';
import { methodNotAllowed, parseBody, requireAuth } from '../../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  if (!isRedisReady()) {
    res.status(503).json({ error: 'Servicio no disponible.' });
    return;
  }

  if (!isGeminiConfigured()) {
    res.status(503).json({ error: 'Importación con IA no configurada.', aiAvailable: false });
    return;
  }

  const { text } = parseBody(req);
  if (!text?.trim() || text.trim().length < 20) {
    res.status(400).json({ error: 'Escribí al menos un párrafo corto sobre tu red.' });
    return;
  }

  if (text.length > 4000) {
    res.status(400).json({ error: 'El texto es demasiado largo (máx. 4000 caracteres).' });
    return;
  }

  try {
    const people = await parseNetworkParagraph(text);
    res.status(200).json({ people, aiAvailable: true });
  } catch (error) {
    res.status(502).json({ error: error.message, aiAvailable: false });
  }
}
