import { Injectable, inject, signal } from '@angular/core';
import { BondsService } from './bonds.service';
import {
  isIOS,
  isPushSupported,
  PushApiService,
  subscribeToPush,
} from './push-api.service';
import { StorageService } from './storage.service';
import {
  NOTIFICATION_DB_NAME,
  NOTIFICATION_SNAPSHOT_KEY,
  NOTIFICATION_STORE,
  NotificationSnapshot,
  PERIODIC_SYNC_TAG,
} from '../models/notification-snapshot.model';

const SETTINGS_KEY = 'bonds.notifications';

interface NotificationSettings {
  enabled: boolean;
  lastDigestDate: string | null;
}

interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
}

interface ServiceWorkerRegistrationWithPeriodicSync extends ServiceWorkerRegistration {
  periodicSync?: PeriodicSyncManager;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly bonds = inject(BondsService);
  private readonly storage = inject(StorageService);
  private readonly pushApi = inject(PushApiService);

  readonly supported = typeof Notification !== 'undefined';
  readonly pushSupported = isPushSupported();
  readonly permission = signal<NotificationPermission>(
    this.supported ? Notification.permission : 'denied',
  );
  readonly pushActive = signal(false);
  readonly remotePushAvailable = signal(false);
  readonly storeNotReady = signal(false);
  readonly iosNeedsInstall = signal(isIOS() && !this.detectStandalone());

  isEnabled(): boolean {
    return this.getSettings().enabled;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.saveSettings({ ...this.getSettings(), enabled });
    if (enabled) {
      await this.setupRemotePush();
      await this.registerPeriodicSync();
    } else {
      await this.teardownRemotePush();
      await this.unregisterPeriodicSync();
    }
    await this.refreshSnapshot();
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.supported) return 'denied';
    const result = await Notification.requestPermission();
    this.permission.set(result);
    if (result === 'granted') {
      await this.setEnabled(true);
    }
    return result;
  }

  async enableWithPermission(): Promise<boolean> {
    if (!this.supported) return false;
    if (isIOS() && !this.detectStandalone()) {
      this.iosNeedsInstall.set(true);
      return false;
    }
    if (Notification.permission === 'granted') {
      await this.setEnabled(true);
      this.permission.set('granted');
      return true;
    }
    if (Notification.permission === 'denied') return false;
    const granted = (await this.requestPermission()) === 'granted';
    return granted;
  }

  async syncBadgeAndNotify(): Promise<void> {
    await this.refreshSnapshot();
    await this.requestBackgroundCheck();
  }

  async refreshSnapshot(): Promise<void> {
    const needsAttention = this.bonds.needsAttention();
    const settings = this.getSettings();
    const existing = await this.readSnapshot();
    const lastDigestDate = this.latestDigestDate(
      settings.lastDigestDate,
      existing?.lastDigestDate ?? null,
    );

    if (lastDigestDate !== settings.lastDigestDate) {
      this.saveSettings({ ...settings, lastDigestDate });
    }

    const snapshot: NotificationSnapshot = {
      enabled: settings.enabled && Notification.permission === 'granted',
      lastDigestDate,
      needsAttention: needsAttention.map((p) => ({
        name: p.name,
        daysSinceContact: p.daysSinceContact,
      })),
    };

    await this.writeSnapshot(snapshot);
    await this.updateBadge(needsAttention.length);

    if (this.pushActive()) {
      try {
        await this.pushApi.syncSnapshot(snapshot);
      } catch {
        this.pushActive.set(false);
      }
    }
  }

  async sendTestPush(): Promise<void> {
    if (!this.pushActive()) {
      throw new Error('Push remoto no activo.');
    }
    await this.pushApi.sendTest();
  }

  async registerPeriodicSync(): Promise<void> {
    if (!this.isEnabled()) return;

    const registration = (await this.getRegistration()) as ServiceWorkerRegistrationWithPeriodicSync | null;
    const periodicSync = registration?.periodicSync;
    if (!periodicSync) return;

    try {
      await periodicSync.register(PERIODIC_SYNC_TAG, {
        minInterval: 24 * 60 * 60 * 1000,
      });
    } catch {
      // Android fallback when remote push is unavailable.
    }
  }

  async unregisterPeriodicSync(): Promise<void> {
    const registration = (await this.getRegistration()) as ServiceWorkerRegistrationWithPeriodicSync | null;
    const periodicSync = registration?.periodicSync;
    if (!periodicSync) return;

    try {
      await periodicSync.unregister(PERIODIC_SYNC_TAG);
    } catch {
      // Ignore if tag was never registered.
    }
  }

  async requestBackgroundCheck(): Promise<void> {
    const registration = await this.getRegistration();
    registration?.active?.postMessage({ type: 'CHECK_ATTENTION' });
  }

  private async setupRemotePush(): Promise<void> {
    this.remotePushAvailable.set(false);
    this.pushActive.set(false);
    this.storeNotReady.set(false);

    if (!this.pushSupported || !this.pushApi.configured) return;

    const health = await this.pushApi.getHealth();
    if (!health?.pushReady) return;

    this.remotePushAvailable.set(true);

    if (!health.storeReady) {
      this.storeNotReady.set(true);
      return;
    }

    const registration = await this.getRegistration();
    if (!registration) return;

    const publicKey = await this.pushApi.getVapidPublicKey();
    if (!publicKey) return;

    try {
      const subscription = await subscribeToPush(registration, publicKey);
      await this.pushApi.register(subscription);
      this.pushActive.set(true);
    } catch {
      this.pushActive.set(false);
    }
  }

  private async teardownRemotePush(): Promise<void> {
    if (this.pushActive()) {
      try {
        await this.pushApi.unregister();
      } catch {
        // Server may be offline while disabling locally.
      }
    }

    const registration = await this.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();

    this.pushActive.set(false);
    this.remotePushAvailable.set(false);
  }

  private detectStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true)
    );
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

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(NOTIFICATION_DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(NOTIFICATION_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async writeSnapshot(snapshot: NotificationSnapshot): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(NOTIFICATION_STORE, 'readwrite');
      tx.objectStore(NOTIFICATION_STORE).put(snapshot, NOTIFICATION_SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async readSnapshot(): Promise<NotificationSnapshot | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(NOTIFICATION_STORE, 'readonly');
      const request = tx.objectStore(NOTIFICATION_STORE).get(NOTIFICATION_SNAPSHOT_KEY);
      request.onsuccess = () => resolve((request.result as NotificationSnapshot) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private latestDigestDate(a: string | null, b: string | null): string | null {
    if (!a) return b;
    if (!b) return a;
    return a >= b ? a : b;
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
}
