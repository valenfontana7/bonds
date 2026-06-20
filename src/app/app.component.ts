import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { BondsService } from './core/services/bonds.service';
import { NotificationService } from './core/services/notification.service';
import { SyncService } from './core/services/sync.service';
import { ThemeService } from './core/services/theme.service';
import { PwaPromptsComponent } from './shared/pwa-prompts/pwa-prompts.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PwaPromptsComponent],
  template: `
    <div class="app-shell">
      <app-pwa-prompts />

      <main class="content" [class.no-bottom-nav]="!showNav()">
        <router-outlet />
      </main>

      @if (showNav() && syncBanner(); as banner) {
        <div class="sync-banner" [class]="banner.status" role="status" aria-live="polite">
          @if (banner.status === 'syncing') {
            <span class="sync-spinner" aria-hidden="true"></span>
          }
          {{ banner.message }}
        </div>
      }

      <nav class="bottom-nav" aria-label="Navegación principal" [class.hidden]="!showNav()">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
          <span class="nav-icon-wrap">
            <span class="nav-icon" aria-hidden="true">◉</span>
            @if (attentionCount() > 0) {
              <span class="nav-badge" [attr.aria-label]="attentionCount() + ' necesitan atención'">
                {{ attentionCount() > 9 ? '9+' : attentionCount() }}
              </span>
            }
          </span>
          <span>Red</span>
        </a>
        <a routerLink="/personas" routerLinkActive="active">
          <span class="nav-icon-wrap">
            <span class="nav-icon" aria-hidden="true">♡</span>
            @if (imminentBirthdayCount() > 0) {
              <span class="nav-badge birthday" aria-label="Cumpleaños hoy o mañana">🎂</span>
            }
          </span>
          <span>Personas</span>
        </a>
        <a routerLink="/semana" routerLinkActive="active">
          <span class="nav-icon-wrap">
            <span class="nav-icon" aria-hidden="true">✦</span>
            @if (weekCount() > 0) {
              <span class="nav-badge">{{ weekCount() > 9 ? '9+' : weekCount() }}</span>
            }
          </span>
          <span>Semana</span>
        </a>
        <a routerLink="/ajustes" routerLinkActive="active">
          <span class="nav-icon">⚙</span>
          <span>Ajustes</span>
        </a>
      </nav>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .app-shell {
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 640px;
      height: 100%;
      height: 100dvh;
      height: -webkit-fill-available;
      display: flex;
      flex-direction: column;
      background: var(--bg);
      overflow: hidden;
    }

    .content {
      flex: 1 1 auto;
      min-height: 0;
      padding: var(--page-top) var(--page-gutter) var(--page-bottom);
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior-y: contain;
      -webkit-overflow-scrolling: touch;

      &.no-bottom-nav {
        padding-bottom: calc(var(--page-gutter) + var(--sab));
      }
    }

    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 640px;
      display: flex;
      justify-content: space-around;
      padding: 0.5rem 0 calc(0.5rem + var(--sab));
      background: var(--nav-bg);
      backdrop-filter: blur(12px);
      border-top: 1px solid var(--border);
      z-index: 100;

      a {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.15rem;
        padding: 0.35rem 0.85rem;
        text-decoration: none;
        color: var(--text-muted);
        font-size: 0.68rem;
        font-weight: 500;
        transition: color 0.2s;

        &.active {
          color: var(--nav-active);
        }
      }

      .nav-icon {
        font-size: 1.2rem;
        line-height: 1;
      }

      .nav-icon-wrap {
        position: relative;
        display: inline-flex;
      }

      .nav-badge {
        position: absolute;
        top: -0.35rem;
        right: -0.55rem;
        min-width: 1rem;
        height: 1rem;
        padding: 0 0.25rem;
        border-radius: 999px;
        background: var(--status-attention-dot);
        color: white;
        font-size: 0.58rem;
        font-weight: 700;
        line-height: 1rem;
        text-align: center;

        &.birthday {
          min-width: 1.1rem;
          background: var(--birthday);
          color: var(--bg);
          font-size: 0.5rem;
          line-height: 1.1rem;
        }
      }

      &.hidden {
        display: none;
      }
    }

    .sync-banner {
      position: fixed;
      bottom: var(--bottom-nav-total);
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 640px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.45rem 1rem;
      font-size: 0.72rem;
      font-weight: 500;
      z-index: 101;
      backdrop-filter: blur(10px);
      border-top: 1px solid var(--border);
      animation: syncSlideUp 0.2s ease-out;

      &.syncing {
        background: var(--sync-syncing-bg);
        color: var(--sync-syncing-text);
      }

      &.ok {
        background: var(--sync-ok-bg);
        color: var(--sync-ok-text);
      }

      &.error {
        background: var(--sync-error-bg);
        color: var(--sync-error-text);
      }
    }

    .sync-spinner {
      width: 0.75rem;
      height: 0.75rem;
      border: 2px solid color-mix(in srgb, var(--sync-syncing-text) 30%, transparent);
      border-top-color: var(--sync-syncing-text);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes syncSlideUp {
      from {
        transform: translateX(-50%) translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `,
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly bonds = inject(BondsService);
  private readonly sync = inject(SyncService);
  private readonly notifications = inject(NotificationService);
  private readonly theme = inject(ThemeService);

  readonly syncBanner = computed(() => {
    const { status, message } = this.sync.indicator();
    if (status === 'idle') return null;
    const defaultMessage =
      status === 'syncing'
        ? 'Sincronizando…'
        : status === 'ok'
          ? 'Sincronizado'
          : 'Error de sincronización';
    return { status, message: message ?? defaultMessage };
  });

  readonly weekCount = computed(() => this.bonds.weekConnections().length);

  readonly attentionCount = computed(() => this.bonds.networkStats().needsAttention);

  readonly imminentBirthdayCount = computed(
    () => this.bonds.upcomingBirthdays().filter((entry) => entry.daysUntil <= 1).length,
  );

  readonly showNav = () => {
    const path = this.router.url.split('?')[0];
    if (path === '/personas/nueva' || /\/personas\/[^/]+\/editar$/.test(path)) {
      return false;
    }
    return (
      this.auth.isLoggedIn() &&
      this.bonds.isOnboardingComplete() &&
      !path.startsWith('/bienvenida')
    );
  };

  constructor() {
    effect(() => {
      this.bonds.needsAttention();
      void this.notifications.refreshSnapshot();
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.auth.isLoggedIn()) {
      await this.sync.mergeOnLogin();
      this.bonds.reloadFromStorage();
    }
    this.setupNotifications();
    if (this.notifications.isEnabled()) {
      void this.notifications.setEnabled(true);
    }
  }

  private setupNotifications(): void {
    void this.notifications.syncBadgeAndNotify();
    void this.notifications.registerPeriodicSync();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.notifications.syncBadgeAndNotify();
      } else {
        void this.notifications.requestBackgroundCheck();
      }
    });
  }
}
