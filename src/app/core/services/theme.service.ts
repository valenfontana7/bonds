import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

export type ThemeMode = 'dark' | 'light' | 'system';

const THEME_KEY = 'bonds.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(StorageService);
  private readonly mediaQuery =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: light)')
      : null;

  readonly mode = signal<ThemeMode>(this.storage.get<ThemeMode>(THEME_KEY, 'dark'));

  constructor() {
    this.applyTheme();
    this.mediaQuery?.addEventListener('change', () => {
      if (this.mode() === 'system') {
        this.applyTheme();
      }
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.storage.set(THEME_KEY, mode);
    this.applyTheme();
  }

  resolvedTheme(): 'dark' | 'light' {
    const mode = this.mode();
    if (mode === 'system') {
      return this.mediaQuery?.matches ? 'light' : 'dark';
    }
    return mode;
  }

  private applyTheme(): void {
    if (typeof document === 'undefined') return;

    const resolved = this.resolvedTheme();
    document.documentElement.setAttribute('data-theme', resolved);

    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', resolved === 'light' ? '#f8fafc' : '#0f111a');
  }
}
