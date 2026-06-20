import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationSnapshot } from '../models/notification-snapshot.model';

const DEVICE_ID_KEY = 'bonds.deviceId';

@Injectable({ providedIn: 'root' })
export class PushApiService {
  private readonly http = inject(HttpClient);

  readonly configured = !!environment.pushApiUrl || environment.production;

  getDeviceId(): string {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  private apiUrl(path: string): string {
    const base = environment.pushApiUrl.replace(/\/$/, '');
    return `${base}${path}`;
  }

  async isServerReady(): Promise<boolean> {
    const health = await this.getHealth();
    if (!health) return false;
    return health.pushReady && health.storeReady;
  }

  async getHealth(): Promise<{ pushReady: boolean; storeReady: boolean; publicAppUrl?: string } | null> {
    if (!this.configured) return null;
    try {
      return await firstValueFrom(
        this.http.get<{ pushReady: boolean; storeReady: boolean; publicAppUrl?: string }>(
          this.apiUrl('/api/health'),
        ),
      );
    } catch {
      return null;
    }
  }

  async getVapidPublicKey(): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ publicKey: string }>(this.apiUrl('/api/push/vapid-public-key')),
      );
      return response.publicKey;
    } catch {
      return null;
    }
  }

  async register(subscription: PushSubscription): Promise<void> {
    await firstValueFrom(
      this.http.post(this.apiUrl('/api/push/register'), {
        deviceId: this.getDeviceId(),
        subscription: subscription.toJSON(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        digestHour: 9,
      }),
    );
  }

  async syncSnapshot(snapshot: NotificationSnapshot): Promise<void> {
    await firstValueFrom(
      this.http.put(this.apiUrl('/api/push/snapshot'), {
        deviceId: this.getDeviceId(),
        enabled: snapshot.enabled,
        needsAttention: snapshot.needsAttention,
        upcomingBirthdays: snapshot.upcomingBirthdays ?? [],
        lastDigestDate: snapshot.lastDigestDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        digestHour: 9,
      }),
    );
  }

  async unregister(): Promise<void> {
    await firstValueFrom(
      this.http.delete(this.apiUrl('/api/push/register'), {
        body: { deviceId: this.getDeviceId() },
      }),
    );
  }

  async sendTest(): Promise<void> {
    await firstValueFrom(
      this.http.post(this.apiUrl('/api/push/test'), {
        deviceId: this.getDeviceId(),
      }),
    );
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription> {
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'PushManager' in window && 'serviceWorker' in navigator;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}
