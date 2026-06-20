import { Component, effect, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BondsService } from './core/services/bonds.service';
import { NotificationService } from './core/services/notification.service';
import { PwaPromptsComponent } from './shared/pwa-prompts/pwa-prompts.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PwaPromptsComponent],
  template: `
    <div class="app-shell">
      <app-pwa-prompts />

      <main class="content">
        <router-outlet />
      </main>

      <nav class="bottom-nav" aria-label="Navegación principal">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
          <span class="nav-icon">◉</span>
          <span>Red</span>
        </a>
        <a routerLink="/personas" routerLinkActive="active">
          <span class="nav-icon">♡</span>
          <span>Personas</span>
        </a>
        <a routerLink="/semana" routerLinkActive="active">
          <span class="nav-icon">✦</span>
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
    .app-shell {
      height: 100dvh;
      height: -webkit-fill-available;
      display: flex;
      flex-direction: column;
      max-width: 640px;
      margin: 0 auto;
      background: var(--bg);
      overflow: hidden;
    }

    .content {
      flex: 1;
      min-height: 0;
      padding: var(--page-top) var(--page-gutter) var(--page-bottom);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
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
      background: rgba(15, 17, 26, 0.92);
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
          color: #a5b4fc;
        }
      }

      .nav-icon {
        font-size: 1.2rem;
        line-height: 1;
      }
    }
  `,
})
export class AppComponent implements OnInit {
  private readonly bonds = inject(BondsService);
  private readonly notifications = inject(NotificationService);

  constructor() {
    effect(() => {
      this.bonds.needsAttention();
      void this.notifications.refreshSnapshot();
    });
  }

  ngOnInit(): void {
    this.bonds.seedDemoData();
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
