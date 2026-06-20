import bcrypt from 'bcryptjs';
import { getRedis } from './redis.js';

const emailKey = (email) => `bonds:auth:email:${email.toLowerCase()}`;
const userKey = (userId) => `bonds:auth:user:${userId}`;

export async function registerUser(email, password, name) {
  const redis = getRedis();
  if (!redis) throw new Error('Almacenamiento no disponible.');

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password || password.length < 6) {
    throw new Error('Email y contraseña (mín. 6 caracteres) son obligatorios.');
  }

  const existing = await redis.get(emailKey(normalizedEmail));
  if (existing) throw new Error('Ya existe una cuenta con ese email.');

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: userId,
    email: normalizedEmail,
    name: name?.trim() || normalizedEmail.split('@')[0],
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await redis.set(emailKey(normalizedEmail), userId);
  await redis.set(userKey(userId), user);

  return { id: user.id, email: user.email, name: user.name };
}

export async function loginUser(email, password) {
  const redis = getRedis();
  if (!redis) throw new Error('Almacenamiento no disponible.');

  const normalizedEmail = email.trim().toLowerCase();
  const userId = await redis.get(emailKey(normalizedEmail));
  if (!userId) throw new Error('Email o contraseña incorrectos.');

  const user = await redis.get(userKey(userId));
  if (!user) throw new Error('Email o contraseña incorrectos.');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Email o contraseña incorrectos.');

  return { id: user.id, email: user.email, name: user.name };
}

export async function getUserById(userId) {
  const redis = getRedis();
  if (!redis) return null;

  const user = await redis.get(userKey(userId));
  if (!user) return null;

  return { id: user.id, email: user.email, name: user.name };
}
