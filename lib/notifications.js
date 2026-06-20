export function buildNotificationBody(people, birthdays = []) {
  const parts = [];

  if (people?.length) {
    const names = people.slice(0, 3).map((person) => person.name);
    const extra = people.length > 3 ? ` y ${people.length - 3} más` : '';

    if (people.length === 1) {
      parts.push(
        `${people[0].name} hace ${people[0].daysSinceContact} días que no conectás. Un mensaje corto puede bastar.`,
      );
    } else {
      parts.push(`${names.join(', ')}${extra} — tu red pide un poco de atención.`);
    }
  }

  const today = birthdays.filter((entry) => entry.daysUntil === 0);
  const tomorrow = birthdays.filter((entry) => entry.daysUntil === 1);

  if (today.length === 1) {
    parts.push(`🎂 Hoy es el cumpleaños de ${today[0].name}.`);
  } else if (today.length > 1) {
    parts.push(`🎂 Hoy cumplen años ${today.map((entry) => entry.name).join(' y ')}.`);
  }

  if (tomorrow.length === 1) {
    parts.push(`Mañana cumple años ${tomorrow[0].name}.`);
  } else if (tomorrow.length > 1) {
    parts.push(`Mañana cumplen años ${tomorrow.map((entry) => entry.name).join(' y ')}.`);
  }

  if (parts.length === 0) {
    return 'Tu red te espera. Abrí Bonds para ver quién necesita un mensaje.';
  }

  return parts.join(' ');
}

export function buildPushPayload(people, appUrl, birthdays = []) {
  const baseUrl = appUrl.replace(/\/$/, '');
  const hasBirthdayAlert = birthdays.some((entry) => entry.daysUntil <= 1);
  const title =
    hasBirthdayAlert && !people?.length ? 'Bonds — Cumpleaños' : 'Bonds — Tu red te espera';

  return {
    title,
    body: buildNotificationBody(people, birthdays),
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
