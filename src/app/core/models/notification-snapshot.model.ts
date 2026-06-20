export const NOTIFICATION_DB_NAME = 'bonds-notifications';
export const NOTIFICATION_STORE = 'snapshot';
export const NOTIFICATION_SNAPSHOT_KEY = 'current';
export const PERIODIC_SYNC_TAG = 'bonds-attention-check';

export interface AttentionPersonSnapshot {
  name: string;
  daysSinceContact: number;
}

export interface NotificationSnapshot {
  enabled: boolean;
  lastDigestDate: string | null;
  needsAttention: AttentionPersonSnapshot[];
  upcomingBirthdays?: BirthdayPersonSnapshot[];
}

export interface BirthdayPersonSnapshot {
  name: string;
  daysUntil: number;
}
