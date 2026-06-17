export type PersonCategory = 'familia' | 'amigos' | 'pareja' | 'trabajo' | 'mentores';

export type InteractionType =
  | 'mensaje'
  | 'llamada'
  | 'visita'
  | 'salida'
  | 'videollamada';

export type ConnectionStatus = 'well' | 'soon' | 'reconnect' | 'attention';

export interface Person {
  id: string;
  name: string;
  photo?: string;
  category: PersonCategory;
  desiredFrequencyDays: number;
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

export const STATUS_LABELS: Record<ConnectionStatus, string> = {
  well: 'Bien atendida',
  soon: 'Podrías contactar esta semana',
  reconnect: 'Quizás valga la pena reconectar',
  attention: 'Necesita tu atención',
};
