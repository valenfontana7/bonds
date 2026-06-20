import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Interaction, Person } from '../models/person.model';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

const PEOPLE_KEY = 'bonds.people';
const INTERACTIONS_KEY = 'bonds.interactions';
const LAST_SYNC_KEY = 'bonds.lastSyncAt';

interface SyncPayload {
  people: Person[];
  interactions: Interaction[];
  updatedAt: string | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

export interface SyncIndicator {
  status: SyncStatus;
  message?: string;
}

export interface MergeOnLoginResult {
  source: 'cloud' | 'local' | 'empty';
  peopleCount: number;
  message?: string;
  warning?: string;
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);

  readonly indicator = signal<SyncIndicator>({ status: 'idle' });
  readonly lastSyncAt = signal<string | null>(this.storage.get<string | null>(LAST_SYNC_KEY, null));

  private idleTimer?: ReturnType<typeof setTimeout>;

  private apiUrl(path: string): string {
    return `${environment.pushApiUrl.replace(/\/$/, '')}${path}`;
  }

  schedulePush(): void {
    if (!this.auth.isLoggedIn()) return;
    void this.pushToCloud({ quiet: true });
  }

  async pullFromCloud(): Promise<SyncPayload | null> {
    if (!this.auth.isLoggedIn()) return null;

    try {
      return await firstValueFrom(
        this.http.get<SyncPayload>(this.apiUrl('/api/sync'), {
          headers: this.auth.authHeaders(),
        }),
      );
    } catch {
      return null;
    }
  }

  async pushToCloud(options?: { quiet?: boolean }): Promise<void> {
    if (!this.auth.isLoggedIn()) return;

    const people = this.storage.get<Person[]>(PEOPLE_KEY, []);
    const interactions = this.storage.get<Interaction[]>(INTERACTIONS_KEY, []);

    this.beginSync();
    try {
      await firstValueFrom(
        this.http.put(
          this.apiUrl('/api/sync'),
          { people, interactions },
          { headers: this.auth.authHeaders() },
        ),
      );
      this.finishOk('Red sincronizada');
    } catch (error) {
      const message = this.extractError(error);
      this.finishError(message);
      if (!options?.quiet) {
        throw new Error(message);
      }
    }
  }

  async mergeOnLogin(): Promise<MergeOnLoginResult> {
    const localPeople = this.storage.get<Person[]>(PEOPLE_KEY, []);
    this.beginSync();
    const cloud = await this.pullFromCloud();

    if (!cloud) {
      const warning = this.auth.isLoggedIn()
        ? 'No pudimos conectar con la nube. Seguís con tus datos locales.'
        : undefined;
      if (warning) this.finishError(warning);
      else this.finishIdle();
      return {
        source: 'empty',
        peopleCount: localPeople.length,
        warning,
      };
    }

    if (cloud.people.length === 0 && localPeople.length > 0) {
      try {
        await this.pushToCloud({ quiet: true });
        const message = `Subimos ${localPeople.length} persona${localPeople.length === 1 ? '' : 's'} a la nube.`;
        this.finishOk('Red sincronizada');
        return { source: 'local', peopleCount: localPeople.length, message };
      } catch (error) {
        const warning =
          error instanceof Error
            ? error.message
            : 'No pudimos subir tu red a la nube. Seguís con datos locales.';
        this.finishError(warning);
        return { source: 'local', peopleCount: localPeople.length, warning };
      }
    }

    if (cloud.people.length > 0) {
      this.storage.set(PEOPLE_KEY, cloud.people);
      this.storage.set(INTERACTIONS_KEY, cloud.interactions);
      this.finishOk('Red recuperada de la nube');
      return {
        source: 'cloud',
        peopleCount: cloud.people.length,
        message: `Recuperamos ${cloud.people.length} persona${cloud.people.length === 1 ? '' : 's'} de la nube.`,
      };
    }

    this.finishIdle();
    return { source: 'empty', peopleCount: 0 };
  }

  extractError(error: unknown): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const payload = (error as { error?: { error?: string } | string }).error;
      if (typeof payload === 'string') return payload;
      if (payload && typeof payload === 'object' && 'error' in payload) {
        const message = (payload as { error?: string }).error;
        if (message) return message;
      }
    }
    return 'No se pudo sincronizar con la nube.';
  }

  private beginSync(): void {
    clearTimeout(this.idleTimer);
    this.indicator.set({ status: 'syncing' });
  }

  private finishOk(message: string): void {
    const syncedAt = new Date().toISOString();
    this.storage.set(LAST_SYNC_KEY, syncedAt);
    this.lastSyncAt.set(syncedAt);
    this.indicator.set({ status: 'ok', message });
    this.scheduleIdle();
  }

  private finishError(message: string): void {
    this.indicator.set({ status: 'error', message });
    this.scheduleIdle();
  }

  private finishIdle(): void {
    clearTimeout(this.idleTimer);
    this.indicator.set({ status: 'idle' });
  }

  private scheduleIdle(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.indicator().status !== 'syncing') {
        this.indicator.set({ status: 'idle' });
      }
    }, 4000);
  }
}
