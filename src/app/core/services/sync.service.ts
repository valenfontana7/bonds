import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Interaction, Person } from '../models/person.model';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

const PEOPLE_KEY = 'bonds.people';
const INTERACTIONS_KEY = 'bonds.interactions';

interface SyncPayload {
  people: Person[];
  interactions: Interaction[];
  updatedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);

  private apiUrl(path: string): string {
    return `${environment.pushApiUrl.replace(/\/$/, '')}${path}`;
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

  async pushToCloud(): Promise<void> {
    if (!this.auth.isLoggedIn()) return;

    const people = this.storage.get<Person[]>(PEOPLE_KEY, []);
    const interactions = this.storage.get<Interaction[]>(INTERACTIONS_KEY, []);

    await firstValueFrom(
      this.http.put(
        this.apiUrl('/api/sync'),
        { people, interactions },
        { headers: this.auth.authHeaders() },
      ),
    );
  }

  async mergeOnLogin(): Promise<'cloud' | 'local' | 'empty'> {
    const cloud = await this.pullFromCloud();
    if (!cloud) return 'empty';

    const localPeople = this.storage.get<Person[]>(PEOPLE_KEY, []);
    const localInteractions = this.storage.get<Interaction[]>(INTERACTIONS_KEY, []);

    if (cloud.people.length === 0 && localPeople.length > 0) {
      await this.pushToCloud();
      return 'local';
    }

    if (cloud.people.length > 0) {
      this.storage.set(PEOPLE_KEY, cloud.people);
      this.storage.set(INTERACTIONS_KEY, cloud.interactions);
      return 'cloud';
    }

    return 'empty';
  }
}
