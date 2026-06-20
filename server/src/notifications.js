export function buildNotificationBody(people) {
  if (!people?.length) return 'Tu red te espera. Abrí Bonds para ver quién necesita un mensaje.';

  const names = people.slice(0, 3).map((person) => person.name);
  const extra = people.length > 3 ? ` y ${people.length - 3} más` : '';

  if (people.length === 1) {
    return `${people[0].name} hace ${people[0].daysSinceContact} días que no conectás. Un mensaje corto puede bastar.`;
  }

  return `${names.join(', ')}${extra} — tu red pide un poco de atención.`;
}

export function buildPushPayload(people, appUrl) {
  const baseUrl = appUrl.replace(/\/$/, '');

  return {
    title: 'Bonds — Tu red te espera',
    body: buildNotificationBody(people),
    url: '/semana',
    icon: `${baseUrl}/icons/icon-192x192.png`,
    badge: `${baseUrl}/icons/icon-96x96.png`,
    tag: 'bonds-attention-digest',
  };
}

export function todayKeyForTimezone(timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function currentHourForTimezone(timezone) {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone || 'UTC',
    hour: 'numeric',
    hour12: false,
  }).format(new Date());

  return Number.parseInt(hour, 10);
}
