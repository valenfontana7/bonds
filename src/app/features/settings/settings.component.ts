import { Component, inject } from '@angular/core';
import { NotificationService } from '../../core/services/notification.service';
import { PwaService } from '../../core/services/pwa.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `
    <section class="settings-page">
      <header>
        <h1>Ajustes</h1>
        <p class="subtitle">App instalada en tu teléfono</p>
      </header>

      <section class="card">
        <h2>Instalar Bonds</h2>
        @if (pwa.isStandalone()) {
          <p class="status ok">✓ Bonds está instalada como app</p>
        } @else if (pwa.canInstall()) {
          <p class="desc">Agregala a tu pantalla de inicio para abrirla como app nativa.</p>
          <button type="button" class="btn-primary" (click)="install()">Instalar en este dispositivo</button>
        } @else {
          <p class="desc">
            En Android (Chrome): menú ⋮ → <strong>Instalar app</strong> o <strong>Agregar a pantalla de inicio</strong>.
          </p>
          <p class="desc">
            En iPhone (Safari): compartir → <strong>Agregar a inicio</strong>.
          </p>
        }
      </section>

      <section class="card">
        <h2>Recordatorios</h2>
        @if (!notifications.supported) {
          <p class="desc muted">Tu navegador no soporta notificaciones.</p>
        } @else if (notifications.permission() === 'denied') {
          <p class="desc muted">
            Las notificaciones están bloqueadas. Habilitalas en la configuración del navegador.
          </p>
        } @else {
          <label class="toggle-row">
            <div>
              <strong>Recordarme quién necesita atención</strong>
              <span class="hint">Un aviso suave por día, máximo, cuando alguien de tu red lo pide.</span>
            </div>
            <input
              type="checkbox"
              [checked]="notificationsEnabled"
              (change)="toggleNotifications($event)"
            />
          </label>
          @if (notificationsEnabled) {
            <p class="status ok">Notificaciones activas</p>
          }
        }
      </section>

      <section class="card">
        <h2>Sobre Bonds</h2>
        <p class="desc">
          Visualiza, cuida y fortalece las relaciones importantes de tu vida antes de que el tiempo las erosione sin darte cuenta.
        </p>
        <p class="version">v0.1 · PWA · Datos en este dispositivo</p>
      </section>
    </section>
  `,
  styles: `
    .settings-page {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 480px;
      margin: 0 auto;
    }

    header h1 {
      margin: 0;
      font-size: 1.5rem;
    }

    .subtitle {
      margin: 0.25rem 0 0;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1.25rem;

      h2 {
        margin: 0 0 0.75rem;
        font-size: 0.95rem;
        font-weight: 600;
      }
    }

    .desc {
      margin: 0 0 0.75rem;
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.5;

      &.muted { margin: 0; }
      &:last-child { margin-bottom: 0; }
    }

    .status {
      margin: 0.5rem 0 0;
      font-size: 0.85rem;

      &.ok { color: #6ee7b7; }
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      cursor: pointer;

      strong {
        display: block;
        font-size: 0.9rem;
        margin-bottom: 0.2rem;
      }

      .hint {
        display: block;
        font-size: 0.78rem;
        color: var(--text-muted);
        line-height: 1.4;
        max-width: 240px;
      }

      input {
        width: 1.25rem;
        height: 1.25rem;
        accent-color: #6366f1;
        flex-shrink: 0;
      }
    }

    .version {
      margin: 0.75rem 0 0;
      font-size: 0.75rem;
      color: var(--text-muted);
      opacity: 0.7;
    }
  `,
})
export class SettingsComponent {
  readonly pwa = inject(PwaService);
  readonly notifications = inject(NotificationService);

  notificationsEnabled = this.notifications.isEnabled();

  async install(): Promise<void> {
    await this.pwa.install();
  }

  async toggleNotifications(event: Event): Promise<void> {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      const granted = await this.notifications.enableWithPermission();
      this.notificationsEnabled = granted;
      if (!granted) {
        (event.target as HTMLInputElement).checked = false;
      }
    } else {
      this.notifications.setEnabled(false);
      this.notificationsEnabled = false;
    }
  }
}
