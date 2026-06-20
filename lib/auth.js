import jwt from 'jsonwebtoken';

const TOKEN_TTL = '30d';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no configurado.');
  }
  return secret;
}

export function signToken(userId, email) {
  return jwt.sign({ sub: userId, email }, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

export function getBearerUser(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header?.startsWith('Bearer ')) return null;

  const payload = verifyToken(header.slice(7));
  if (!payload?.sub) return null;

  return { userId: payload.sub, email: payload.email };
}
