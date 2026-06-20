import { getUserById } from '../../lib/users.js';
import { getUserBondsData, saveUserBondsData } from '../../lib/user-data.js';
import { methodNotAllowed, parseBody, requireAuth } from '../../lib/http.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    const data = await getUserBondsData(auth.userId);
    res.status(200).json(data);
    return;
  }

  if (req.method === 'PUT') {
    const { people, interactions } = parseBody(req);
    if (!Array.isArray(people) || !Array.isArray(interactions)) {
      res.status(400).json({ error: 'people e interactions deben ser arrays.' });
      return;
    }

    const saved = await saveUserBondsData(auth.userId, { people, interactions });
    res.status(200).json(saved);
    return;
  }

  methodNotAllowed(res, ['GET', 'PUT']);
}
