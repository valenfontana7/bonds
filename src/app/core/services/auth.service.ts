import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, AuthUser } from '../models/auth.model';

const TOKEN_KEY = 'bonds.auth.token';
const USER_KEY = 'bonds.auth.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<AuthUser | null>(this.loadUser());
  readonly isLoggedIn = signal(!!this.getToken());

  private apiUrl(path: string): string {
    return `${environment.pushApiUrl.replace(/\/$/, '')}${path}`;
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  authHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async register(email: string, password: string, name: string): Promise<AuthUser> {
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(this.apiUrl('/api/auth/register'), { email, password, name }),
      );
      this.persistSession(response);
      return response.user;
    } catch (error) {
      throw new Error(this.extractError(error));
    }
  }

  async login(email: string, password: string): Promise<AuthUser> {
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(this.apiUrl('/api/auth/login'), { email, password }),
      );
      this.persistSession(response);
      return response.user;
    } catch (error) {
      throw new Error(this.extractError(error));
    }
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.isLoggedIn.set(false);
  }

  private persistSession(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.user.set(response.user);
    this.isLoggedIn.set(true);
  }

  private loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  private extractError(error: unknown): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const payload = (error as { error?: { error?: string } }).error;
      if (payload?.error) return payload.error;
    }
    return 'No se pudo completar la operación.';
  }
}
