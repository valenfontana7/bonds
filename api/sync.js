import { getUserBondsData, saveUserBondsData } from '../lib/user-data.js';
import { methodNotAllowed, parseBody, requireAuth } from '../lib/http.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    try {
      const data = await getUserBondsData(auth.userId);
      res.status(200).json(data);
    } catch (error) {
      res.status(503).json({ error: error.message || 'No se pudo leer la nube.' });
    }
    return;
  }

  if (req.method === 'PUT') {
    const { people, interactions } = parseBody(req);
    if (!Array.isArray(people) || !Array.isArray(interactions)) {
      res.status(400).json({ error: 'people e interactions deben ser arrays.' });
      return;
    }

    try {
      const saved = await saveUserBondsData(auth.userId, { people, interactions });
      res.status(200).json(saved);
    } catch (error) {
      res.status(503).json({ error: error.message || 'No se pudo guardar en la nube.' });
    }
    return;
  }

  methodNotAllowed(res, ['GET', 'PUT']);
}
