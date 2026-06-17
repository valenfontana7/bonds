import { Injectable, inject, signal } from '@angular/core';
import { BondsService } from './bonds.service';
import { PersonWithStatus } from '../models/person.model';
import { StorageService } from './storage.service';

const SETTINGS_KEY = 'bonds.notifications';

interface NotificationSettings {
  enabled: boolean;
  lastDigestDate: string | null;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly bonds = inject(BondsService);
  private readonly storage = inject(StorageService);

  readonly supported = typeof Notification !== 'undefined';
  readonly permission = signal<NotificationPermission>(
    this.supported ? Notification.permission : 'denied',
  );

  isEnabled(): boolean {
    return this.getSettings().enabled;
  }

  setEnabled(enabled: boolean): void {
    this.saveSettings({ ...this.getSettings(), enabled });
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.supported) return 'denied';
    const result = await Notification.requestPermission();
    this.permission.set(result);
    if (result === 'granted') {
      this.setEnabled(true);
    }
    return result;
  }

  async enableWithPermission(): Promise<boolean> {
    if (!this.supported) return false;
    if (Notification.permission === 'granted') {
      this.setEnabled(true);
      this.permission.set('granted');
      return true;
    }
    if (Notification.permission === 'denied') return false;
    return (await this.requestPermission()) === 'granted';
  }

  async syncBadgeAndNotify(): Promise<void> {
    const needsAttention = this.bonds.needsAttention();
    await this.updateBadge(needsAttention.length);

    if (!this.isEnabled() || Notification.permission !== 'granted') return;
    if (needsAttention.length === 0) return;
    if (this.alreadyNotifiedToday()) return;

    await this.showAttentionDigest(needsAttention);
    this.markNotifiedToday();
  }

  private async showAttentionDigest(people: PersonWithStatus[]): Promise<void> {
    const registration = await this.getRegistration();
    if (!registration) return;

    const names = people.slice(0, 3).map((p) => p.name);
    const extra = people.length > 3 ? ` y ${people.length - 3} más` : '';
    const body =
      people.length === 1
        ? `${people[0].name} hace ${people[0].daysSinceContact} días que no conectás. Un mensaje corto puede bastar.`
        : `${names.join(', ')}${extra} — tu red pide un poco de atención.`;

    await registration.showNotification('Bonds — Tu red te espera', {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: 'bonds-attention-digest',
      data: { url: '/semana' },
    } as NotificationOptions);
  }

  private async updateBadge(count: number): Promise<void> {
    const nav = navigator as Navigator & {
      setAppBadge?: (count: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    if (count > 0) {
      await nav.setAppBadge(count);
    } else if (nav.clearAppBadge) {
      await nav.clearAppBadge();
    }
  }

  private async getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    try {
      return await navigator.serviceWorker.ready;
    } catch {
      return null;
    }
  }

  private getSettings(): NotificationSettings {
    return this.storage.get<NotificationSettings>(SETTINGS_KEY, {
      enabled: false,
      lastDigestDate: null,
    });
  }

  private saveSettings(settings: NotificationSettings): void {
    this.storage.set(SETTINGS_KEY, settings);
  }

  private alreadyNotifiedToday(): boolean {
    const { lastDigestDate } = this.getSettings();
    if (!lastDigestDate) return false;
    return lastDigestDate === this.todayKey();
  }

  private markNotifiedToday(): void {
    this.saveSettings({
      ...this.getSettings(),
      lastDigestDate: this.todayKey(),
    });
  }

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
