import { Component, inject, OnInit } from '@angular/core';
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
    :host {
      display: block;
      height: 100%;
    }

    .app-shell {
      height: 100%;
      display: flex;
      flex-direction: column;
      max-width: 640px;
      margin: 0 auto;
      background: var(--bg);
      overflow: hidden;
    }

    .content {
      flex: 1 1 auto;
      min-height: 0;
      padding: var(--page-top) var(--page-gutter) var(--page-bottom);
      overflow-x: hidden;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .bottom-nav {
      flex: 0 0 auto;
      width: 100%;
      display: flex;
      justify-content: space-around;
      padding: 0.5rem 0 var(--sab);
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

  ngOnInit(): void {
    this.bonds.seedDemoData();
    this.setupNotifications();
  }

  private setupNotifications(): void {
    void this.notifications.syncBadgeAndNotify();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.notifications.syncBadgeAndNotify();
      }
    });
  }
}
