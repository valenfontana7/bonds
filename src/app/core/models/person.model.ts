export type PersonCategory = 'familia' | 'amigos' | 'pareja' | 'trabajo' | 'mentores';

export type InteractionType =
  | 'mensaje'
  | 'llamada'
  | 'visita'
  | 'salida'
  | 'videollamada';

export type ConnectionStatus = 'well' | 'soon' | 'reconnect' | 'attention';

/** Canal preferido para reconectar con la persona. */
export type PreferredContact = 'mensaje' | 'llamada' | 'visita' | 'videollamada';

export interface Person {
  id: string;
  name: string;
  photo?: string;
  category: PersonCategory;
  desiredFrequencyDays: number;
  /** Día y mes en formato MM-DD (sin año). */
  birthday?: string;
  /** Recordatorio persistente sobre la persona (gustos, temas, etc.). */
  pinnedNote?: string;
  phone?: string;
  email?: string;
  preferredContact?: PreferredContact;
  createdAt: string;
}

export interface Interaction {
  id: string;
  personId: string;
  type: InteractionType;
  date: string;
  note?: string;
}

export interface PersonWithStatus extends Person {
  lastInteraction?: Interaction;
  daysSinceContact: number;
  status: ConnectionStatus;
  statusLabel: string;
  attentionRatio: number;
}

export const CATEGORY_LABELS: Record<PersonCategory, string> = {
  familia: 'Familia',
  amigos: 'Amigos',
  pareja: 'Pareja',
  trabajo: 'Trabajo',
  mentores: 'Mentores',
};

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  mensaje: 'Mensaje',
  llamada: 'Llamada',
  visita: 'Visita',
  salida: 'Salida',
  videollamada: 'Videollamada',
};

export const INTERACTION_ICONS: Record<InteractionType, string> = {
  mensaje: '💬',
  llamada: '📞',
  visita: '🏠',
  salida: '☕',
  videollamada: '📹',
};

export const PREFERRED_CONTACT_LABELS: Record<PreferredContact, string> = {
  mensaje: 'Mensaje / chat',
  llamada: 'Llamada',
  visita: 'Visita presencial',
  videollamada: 'Videollamada',
};

export const STATUS_LABELS: Record<ConnectionStatus, string> = {
  well: 'Al día',
  soon: 'Podrías contactar esta semana',
  reconnect: 'Quizás valga la pena reconectar',
  attention: 'Necesita tu atención',
};

/** "Hoy" | "hace 1 día" | "hace N días" */
export function formatDaysSinceContact(days: number): string {
  if (days === 0) return 'Hoy';
  if (days === 1) return 'hace 1 día';
  return `hace ${days} días`;
}

export function daysSinceIso(iso: string): number {
  const then = new Date(iso);
  const now = new Date();
  then.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

/** Edad relativa de una interacción registrada. */
export function formatInteractionAge(iso: string): string {
  return formatDaysSinceContact(daysSinceIso(iso));
}

/** "Último contacto: hoy" | "Último contacto: hace 1 día" | … */
export function formatLastContactLabel(days: number): string {
  if (days === 0) return 'Último contacto: hoy';
  if (days === 1) return 'Último contacto: hace 1 día';
  return `Último contacto: hace ${days} días`;
}

/** Etiqueta corta para nodos del grafo. */
export function formatDaysShort(days: number): string {
  if (days === 0) return 'Hoy';
  if (days === 1) return '1d';
  return `${days}d`;
}

/** "1 pide atención" | "N piden atención" */
export function formatAttentionCount(count: number): string {
  if (count === 1) return '1 pide atención';
  return `${count} piden atención`;
}

/** Valor para input[type=date] (YYYY-MM-DD) en hora local. */
export function toDateInputValue(isoOrDate?: string | Date): string {
  const date = isoOrDate instanceof Date ? isoOrDate : isoOrDate ? new Date(isoOrDate) : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Convierte YYYY-MM-DD a ISO (mediodía local, evita saltos por zona horaria). */
export function dateInputToIso(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

/** "contacto de hoy" | "contacto de ayer" | "contacto del 15 jun" */
export function formatInteractionRegisteredLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diffDays === 0) return 'contacto de hoy';
  if (diffDays === 1) return 'contacto de ayer';
  const label = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  return `contacto del ${label}`;
}

/** Etiqueta legible para la última sincronización. */
export function formatSyncTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Plazo según la frecuencia deseada vs. días desde el último contacto. */
export function formatFrequencyDeadline(
  daysSinceContact: number,
  desiredFrequencyDays: number,
): string {
  if (desiredFrequencyDays <= 0) return '';
  const daysUntilDue = desiredFrequencyDays - daysSinceContact;
  if (daysUntilDue > 1) return `Próximo contacto en ${daysUntilDue} días`;
  if (daysUntilDue === 1) return 'Próximo contacto mañana';
  if (daysUntilDue === 0) return 'Límite de frecuencia hoy';
  const overdue = daysSinceContact - desiredFrequencyDays;
  if (overdue === 1) return 'Venció ayer';
  return `Venció hace ${overdue} días`;
}

/** Promedio de días entre contactos consecutivos (mín. 2 registros). */
export function formatAverageContactInterval(interactions: Interaction[]): string | null {
  if (interactions.length < 2) return null;

  const sorted = [...interactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  let totalDays = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date);
    const curr = new Date(sorted[i].date);
    prev.setHours(0, 0, 0, 0);
    curr.setHours(0, 0, 0, 0);
    totalDays += Math.max(0, Math.round((curr.getTime() - prev.getTime()) / 86_400_000));
  }

  const avg = Math.round(totalDays / (sorted.length - 1));
  if (avg <= 1) return 'Soleás contactar seguido';
  return `Soleás contactar cada ${avg} días`;
}

/** Clave YYYY-MM para agrupar interacciones por mes. */
export function getMonthKey(iso: string): string {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** "junio 2026" a partir de YYYY-MM. */
export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Abreviatura de mes: "jun", "jul". */
export function formatMonthShort(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short' });
}

/** Convierte MM-DD a valor para input[type=date] (año ficticio 2000). */
export function birthdayToDateInput(birthday?: string): string {
  if (!birthday) return '';
  const [month, day] = birthday.split('-');
  return `2000-${month}-${day}`;
}

/** Extrae MM-DD de un input date; vacío si no hay valor. */
export function dateInputToBirthday(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const [, month, day] = dateStr.split('-');
  if (!month || !day) return undefined;
  return `${month}-${day}`;
}

/** "20 de junio" a partir de MM-DD. */
export function formatBirthdayLabel(birthday: string): string {
  const [month, day] = birthday.split('-').map(Number);
  return new Date(2000, month - 1, day).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
  });
}

/** Días hasta el próximo cumpleaños (0 = hoy). */
export function daysUntilBirthday(birthday: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [month, day] = birthday.split('-').map(Number);
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export function formatBirthdayCountdown(days: number): string {
  if (days === 0) return '¡Hoy!';
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
}

/** true si el cumpleaños es hoy o mañana. */
export function isBirthdayImminent(daysUntil: number): boolean {
  return daysUntil <= 1;
}

/** true si el cumpleaños cae dentro de los próximos N días (inclusive). */
export function isBirthdaySoon(daysUntil: number, withinDays = 14): boolean {
  return daysUntil <= withinDays;
}

export function birthdayBadgeLabel(birthday: string): string | null {
  const days = daysUntilBirthday(birthday);
  if (days > 14) return null;
  if (days === 0) return '🎂 Hoy';
  if (days === 1) return '🎂 Mañana';
  return `🎂 ${formatBirthdayCountdown(days)}`;
}

export function birthdayCtaText(daysUntil: number, name: string): string {
  const firstName = name.trim().split(/\s+/)[0] || name;
  if (daysUntil === 0) return `¡Hoy es el cumple de ${firstName}!`;
  return `Mañana cumple ${firstName}.`;
}

export function normalizeOptionalText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, '')}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}

/** Enlace wa.me con mensaje opcional precargado. */
export function whatsAppHref(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '#';
  const base = `https://wa.me/${digits}`;
  const text = message?.trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export interface WhatsAppMessageInput {
  name: string;
  daysSinceContact: number;
  /** 0 = hoy, 1 = mañana */
  birthdayDaysUntil?: number;
}

/** Mensaje sugerido según contexto de la relación. */
export function buildWhatsAppMessage(input: WhatsAppMessageInput): string {
  const firstName = input.name.trim().split(/\s+/)[0] || input.name;

  if (input.birthdayDaysUntil === 0) {
    return `¡Feliz cumple, ${firstName}! 🎂 Espero que tengas un día hermoso.`;
  }
  if (input.birthdayDaysUntil === 1) {
    return `Hola ${firstName}, mañana es tu cumple — ya te estoy deseando lo mejor. 🎂`;
  }
  if (input.daysSinceContact === 0) {
    return `Hola ${firstName}, ¿cómo andás?`;
  }
  if (input.daysSinceContact <= 7) {
    return `Hola ${firstName}, ¿cómo estás? Hace unos días que no hablamos.`;
  }
  if (input.daysSinceContact <= 30) {
    return `Hola ${firstName}, ¿cómo andás? Estaba pensando en vos.`;
  }
  return `Hola ${firstName}, ¡hace tiempo! ¿Cómo va todo?`;
}

export function whatsAppMessageForPerson(person: {
  name: string;
  daysSinceContact: number;
  birthday?: string;
}): string {
  return buildWhatsAppMessage({
    name: person.name,
    daysSinceContact: person.daysSinceContact,
    birthdayDaysUntil: person.birthday ? daysUntilBirthday(person.birthday) : undefined,
  });
}

/** Resumen corto de la última interacción. */
export function formatLastInteractionSummary(
  type: InteractionType,
  iso: string,
): string {
  const label = INTERACTION_LABELS[type];
  return `${label} · ${formatInteractionRegisteredLabel(iso)}`;
}

export function isPreferredInteractionType(
  preferred: PreferredContact | undefined,
  type: InteractionType,
): boolean {
  if (!preferred) return false;
  const map: Record<PreferredContact, InteractionType[]> = {
    mensaje: ['mensaje'],
    llamada: ['llamada'],
    visita: ['visita', 'salida'],
    videollamada: ['videollamada'],
  };
  return map[preferred].includes(type);
}

export function suggestsWhatsApp(person: {
  preferredContact?: PreferredContact;
  phone?: string;
}): boolean {
  return person.preferredContact === 'mensaje' && !!person.phone;
}

export type AttentionCtaKind = 'whatsapp' | 'call' | 'log';

export interface AttentionCta {
  kind: AttentionCtaKind;
  logType?: InteractionType;
  label: string;
}

export function formatAttentionMessage(person: PersonWithStatus): string {
  const first = person.name.trim().split(/\s+/)[0] || person.name;
  const messages: Record<ConnectionStatus, string> = {
    soon: `${first} podría estar contento/a con un contacto pronto.`,
    reconnect: `Hace un rato que no conectás con ${first}.`,
    attention: `${first} lleva bastante sin saber de vos.`,
    well: '',
  };
  return messages[person.status];
}

/** Acción principal sugerida cuando la persona necesita atención. */
export function getAttentionCta(person: PersonWithStatus): AttentionCta | null {
  if (person.status === 'well') return null;

  if (suggestsWhatsApp(person)) {
    return { kind: 'whatsapp', label: 'Escribile por WhatsApp' };
  }

  if (person.preferredContact === 'llamada' && person.phone) {
    return { kind: 'call', label: 'Llamar ahora' };
  }

  if (person.preferredContact === 'visita') {
    return { kind: 'log', logType: 'visita', label: 'Registrar visita' };
  }
  if (person.preferredContact === 'videollamada') {
    return { kind: 'log', logType: 'videollamada', label: 'Registrar videollamada' };
  }
  if (person.preferredContact === 'llamada') {
    return { kind: 'log', logType: 'llamada', label: 'Registrar llamada' };
  }

  return { kind: 'log', logType: 'mensaje', label: 'Registrar mensaje' };
}

/** Sugerencia según canal preferido. */
export function formatPreferredContactHint(method: PreferredContact): string {
  const hints: Record<PreferredContact, string> = {
    mensaje: 'Suele preferir mensajes',
    llamada: 'Suele preferir llamadas',
    visita: 'Suele preferir verse en persona',
    videollamada: 'Suele preferir videollamada',
  };
  return hints[method];
}

export function canShareContacts(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Texto para compartir teléfono/email de una persona (Web Share API). */
export function buildContactSharePayload(
  person: Pick<Person, 'name' | 'phone' | 'email'>,
): { title: string; text: string } | null {
  const lines: string[] = [];
  if (person.phone) lines.push(`Tel: ${person.phone}`);
  if (person.email) lines.push(`Email: ${person.email}`);
  if (lines.length === 0) return null;
  return {
    title: person.name,
    text: `${person.name}\n${lines.join('\n')}`,
  };
}
