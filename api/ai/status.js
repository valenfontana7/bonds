import { isGeminiConfigured } from '../../lib/gemini.js';
import { isRedisReady } from '../../lib/redis.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = {
    redisReady: isRedisReady(),
    geminiReady: isGeminiConfigured(),
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite',
  };

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  res.status(200).json(body);
}
