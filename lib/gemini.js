const VALID_CATEGORIES = new Set(['familia', 'amigos', 'pareja', 'trabajo', 'mentores']);

const SYSTEM_PROMPT = `Sos un asistente que extrae personas de un párrafo sobre relaciones personales.
Respondé SOLO con un array JSON válido, sin markdown ni texto extra.
Cada objeto debe tener:
- name (string, nombre o apodo)
- category (uno de: familia, amigos, pareja, trabajo, mentores)
- desiredFrequencyDays (número, cada cuántos días quiere conectar: semanal=7, quincenal=14, mensual=30)
- daysSinceLastContact (número o null, si se menciona cuándo fue el último contacto)
- note (string opcional, contexto breve)

Si no hay personas claras, devolvé [].`;

export function isGeminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

export async function parseNetworkParagraph(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Importación con IA no disponible.');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            { text: `Párrafo del usuario:\n${text.trim()}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini error: ${response.status} ${detail.slice(0, 120)}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('La IA no devolvió resultados.');

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No se pudo interpretar la respuesta de la IA.');
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed)) throw new Error('Formato de respuesta inválido.');

  return parsed
    .filter((item) => item?.name && typeof item.name === 'string')
    .map((item) => ({
      name: item.name.trim(),
      category: VALID_CATEGORIES.has(item.category) ? item.category : 'amigos',
      desiredFrequencyDays: clampDays(item.desiredFrequencyDays, 14),
      daysSinceLastContact:
        typeof item.daysSinceLastContact === 'number' && item.daysSinceLastContact >= 0
          ? Math.floor(item.daysSinceLastContact)
          : null,
      note: typeof item.note === 'string' ? item.note.trim() : undefined,
    }));
}

function clampDays(value, fallback) {
  const days = Number.parseInt(value, 10);
  if (!Number.isFinite(days)) return fallback;
  return Math.min(365, Math.max(1, days));
}
