import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AiImportResponse,
  AiStatusResponse,
  ImportedPersonDraft,
} from '../models/imported-person.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AiImportService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private apiUrl(path: string): string {
    return `${environment.pushApiUrl.replace(/\/$/, '')}${path}`;
  }

  async getStatus(): Promise<AiStatusResponse | null> {
    try {
      return await firstValueFrom(this.http.get<AiStatusResponse>(this.apiUrl('/api/ai/status')));
    } catch {
      return null;
    }
  }

  async importFromText(text: string): Promise<ImportedPersonDraft[]> {
    const response = await firstValueFrom(
      this.http.post<AiImportResponse>(
        this.apiUrl('/api/ai/import-network'),
        { text },
        { headers: this.auth.authHeaders() },
      ),
    );
    return response.people;
  }
}
