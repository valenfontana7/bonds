import { Component, inject } from '@angular/core';
import { PwaService } from '../../core/services/pwa.service';

@Component({
  selector: 'app-pwa-prompts',
  standalone: true,
  template: `
    @if (pwa.updateAvailable()) {
      <div class="banner update" role="status">
        <span>Hay una versión nueva de Bonds</span>
        <button type="button" class="banner-btn" (click)="pwa.applyUpdate()">Actualizar</button>
      </div>
    }

    @if (pwa.showInstallBanner()) {
      <div class="banner install" role="dialog" aria-label="Instalar Bonds">
        <div class="banner-text">
          <strong>Instalar Bonds</strong>
          <span>Accedé rápido desde tu pantalla de inicio</span>
        </div>
        <div class="banner-actions">
          <button type="button" class="banner-btn primary" (click)="install()">Instalar</button>
          <button type="button" class="banner-btn" (click)="dismissInstall()">Ahora no</button>
        </div>
      </div>
    }
  `,
  styles: `
    .banner {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 2rem);
      max-width: 608px;
      padding: 0.85rem 1rem;
      border-radius: 1rem;
      border: 1px solid var(--border);
      background: rgba(26, 29, 46, 0.96);
      backdrop-filter: blur(12px);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    }

    .install {
      bottom: calc(4.75rem + env(safe-area-inset-bottom));
    }

    .update {
      top: calc(0.75rem + env(safe-area-inset-top));
    }

    .banner-text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;

      strong { font-size: 0.9rem; }
      span { font-size: 0.78rem; color: var(--text-muted); }
    }

    .banner-actions {
      display: flex;
      gap: 0.5rem;
    }

    .banner-btn {
      padding: 0.45rem 0.85rem;
      border-radius: 0.6rem;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-muted);
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;

      &.primary {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-color: transparent;
        color: white;
      }
    }
  `,
})
export class PwaPromptsComponent {
  readonly pwa = inject(PwaService);

  async install(): Promise<void> {
    await this.pwa.install();
  }

  dismissInstall(): void {
    this.pwa.dismissInstall();
  }
}
