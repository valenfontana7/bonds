import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import {
  BondsBackup,
  BondsService,
  ImportBackupMode,
  parseBondsBackup,
} from '../../core/services/bonds.service';
import { SyncService } from '../../core/services/sync.service';
import { PwaService } from '../../core/services/pwa.service';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { toDateInputValue, formatDaysSinceContact, CATEGORY_LABELS, PersonCategory, formatSyncTimestamp } from '../../core/models/person.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="settings-page">
      <header>
        <h1>Ajustes</h1>
        <p class="subtitle">{{ appSubtitle() }}</p>
      </header>

      @if (stats().totalPeople > 0) {
        <section class="card network-summary" aria-label="Resumen de tu red">
          <h2>Tu red en números</h2>
          <div class="stats-grid">
            <a class="stat-item" routerLink="/semana">
              <strong>{{ stats().contactsLast7Days }}</strong>
              <span>Esta semana</span>
            </a>
            <a class="stat-item" routerLink="/personas">
              <strong>{{ stats().contactsThisMonth }}</strong>
              <span>Este mes</span>
            </a>
            <a class="stat-item" routerLink="/personas" [queryParams]="{ estado: 'attention' }">
              <strong>{{ stats().needsAttention }}</strong>
              <span>Piden atención</span>
            </a>
            <a class="stat-item" routerLink="/personas" [queryParams]="{ estado: 'birthday' }">
              <strong>{{ stats().upcomingBirthdaysCount }}</strong>
              <span>Cumples pronto</span>
            </a>
            <a class="stat-item" routerLink="/personas">
              <strong>{{ stats().totalInteractions }}</strong>
              <span>Contactos totales</span>
            </a>
          </div>
          @if (stats().mostNeglected; as neglected) {
            <a [routerLink]="['/personas', neglected.id]" class="desc insight insight-link">
              Quien más espera: <strong>{{ neglected.name }}</strong> ({{ formatContactDays(neglected.days) }}) →
            </a>
          } @else if (stats().wellCount === stats().totalPeople) {
            <p class="desc insight ok-line">🌿 Toda tu red está al día.</p>
          }
          @if (categoryAttention().length > 0) {
            <ul class="category-attention">
              @for (item of categoryAttention(); track item.category) {
                <li>
                  <a
                    [routerLink]="['/personas']"
                    [queryParams]="{ categoria: item.category, estado: 'attention' }"
                  >
                    {{ item.label }} · {{ item.count }} {{ item.count === 1 ? 'persona' : 'personas' }} →
                  </a>
                </li>
              }
            </ul>
          }
          <div class="summary-links">
            <a routerLink="/semana">Esta semana →</a>
            <a routerLink="/personas">Personas →</a>
            @if (stats().upcomingBirthdaysCount > 0) {
              <a routerLink="/personas" [queryParams]="{ estado: 'birthday' }">Cumples pronto →</a>
            }
            @if (stats().noContactCount > 0) {
              <a routerLink="/personas" [queryParams]="{ estado: 'nocontact' }">
                Completar contactos ({{ stats().noContactCount }}) →
              </a>
            }
          </div>
        </section>
      }

      <section class="card">
        <h2>Tu cuenta</h2>
        @if (auth.isLoggedIn()) {
          <p class="desc ok-line">{{ auth.user()?.name }} · {{ auth.user()?.email }}</p>
          <p class="desc">Tu red se sincroniza en la nube al hacer cambios.</p>
          <button type="button" class="btn-secondary" [disabled]="syncing || syncBusy()" (click)="syncNow()">
            {{ syncing || syncBusy() ? 'Sincronizando…' : 'Sincronizar ahora' }}
          </button>
          @if (sync.lastSyncAt(); as syncedAt) {
            <p class="desc muted">Última sync: {{ formatSyncTimestamp(syncedAt) }}</p>
          }
          <p class="desc muted">El resultado aparece en la barra inferior de la app.</p>
          <button type="button" class="btn-danger" (click)="logout()">Cerrar sesión</button>
        } @else {
          <p class="desc">Iniciá sesión para guardar tu red en la nube.</p>
          <a routerLink="/bienvenida" class="btn-primary">Ir a bienvenida</a>
        }
      </section>

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
          @if (notifications.iosNeedsInstall() && !pwa.isStandalone()) {
            <p class="desc warn">
              En iPhone, instalá Bonds en la pantalla de inicio antes de activar recordatorios push.
            </p>
          }

          <label class="toggle-row">
            <div>
              <strong>Recordarme quién necesita atención</strong>
              <span class="hint">
                Un aviso por día, incluso con la app cerrada. Solo se sincronizan nombres y días sin contacto.
              </span>
            </div>
            <input
              type="checkbox"
              [checked]="notificationsEnabled"
              (change)="toggleNotifications($event)"
            />
          </label>

          @if (notificationsEnabled) {
            <p class="status ok">Notificaciones activas</p>

            @if (notifications.pushActive()) {
              <p class="desc platform-hint ok-line">
                Push remoto activo — funciona en Android e iPhone (iOS 16.4+) con la app instalada.
              </p>
              <button type="button" class="btn-secondary" [disabled]="testingPush" (click)="testPush()">
                {{ testingPush ? 'Enviando…' : 'Probar notificación ahora' }}
              </button>
              @if (pushTestError) {
                <p class="status error">{{ pushTestError }}</p>
              }
            } @else if (notifications.storeNotReady()) {
              <p class="desc platform-hint warn-line">
                El API responde, pero falta Redis. En Vercel: Storage → Upstash for Redis → conectar al proyecto y redeploy.
              </p>
            } @else if (notifications.remotePushAvailable()) {
              <p class="desc platform-hint warn-line">
                Push remoto pendiente. Abrí Bonds instalada en HTTPS para completar la suscripción.
              </p>
            } @else {
              <p class="desc platform-hint">
                Modo local: el aviso llega al abrir o cerrar la app. Para push en iOS/Android configurá el servidor.
              </p>
            }
          }
        }
      </section>

      <section class="card">
        <h2>Apariencia</h2>
        <p class="desc">Elegí cómo se ve Bonds en este dispositivo.</p>
        <div class="theme-modes" role="group" aria-label="Tema de la app">
          @for (option of themeOptions; track option.value) {
            <button
              type="button"
              class="mode-chip"
              [class.active]="theme.mode() === option.value"
              (click)="theme.setMode(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
        <p class="desc muted">
          Tema actual: {{ resolvedThemeLabel() }}.
        </p>
      </section>

      <section class="card">
        <h2>Datos</h2>
        <p class="desc">
          Exportá o importá una copia de tu red (personas e interacciones) en JSON.
        </p>
        <button type="button" class="btn-secondary" (click)="exportBackup()">
          Exportar copia de seguridad
        </button>
        @if (exportFeedback) {
          <p class="status ok">{{ exportFeedback }}</p>
        }

        <input
          #backupInput
          type="file"
          accept="application/json,.json"
          class="file-input"
          (change)="onBackupSelected($event)"
        />
        <button type="button" class="btn-secondary" (click)="backupInput.click()">
          Importar copia de seguridad
        </button>

        @if (pendingImport(); as pending) {
          <div class="import-panel">
            <p class="desc">
              <strong>{{ pending.fileName }}</strong><br />
              {{ pending.backup.people.length }} personas ·
              {{ pending.backup.interactions.length }} interacciones
            </p>
            <div class="import-modes" role="group" aria-label="Modo de importación">
              <button
                type="button"
                class="mode-chip"
                [class.active]="importMode() === 'merge'"
                (click)="importMode.set('merge')"
              >
                Combinar
              </button>
              <button
                type="button"
                class="mode-chip danger"
                [class.active]="importMode() === 'replace'"
                (click)="importMode.set('replace')"
              >
                Reemplazar todo
              </button>
            </div>
            <p class="desc muted">
              @if (importMode() === 'merge') {
                Agrega personas e interacciones que no existan (por ID). No borra nada local.
              } @else {
                Borra tu red actual y la reemplaza por la del archivo.
              }
            </p>
            <div class="import-actions">
              <button type="button" class="btn-secondary" (click)="cancelImport(backupInput)">
                Cancelar
              </button>
              <button type="button" class="btn-primary" (click)="confirmImport(backupInput)">
                {{ importMode() === 'replace' ? 'Reemplazar' : 'Importar' }}
              </button>
            </div>
          </div>
        }

        @if (importFeedback) {
          <p class="status" [class.ok]="importOk" [class.error]="!importOk">{{ importFeedback }}</p>
        }
      </section>

      <section class="card">
        <h2>Sobre Bonds</h2>
        <p class="desc">
          Visualizá, cuidá y fortalecé las relaciones importantes de tu vida antes de que el tiempo las erosione sin darte cuenta.
        </p>
        <p class="version">v0.3 · PWA · Sync en la nube</p>
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

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      padding: 0.65rem 0.5rem;
      border-radius: 0.65rem;
      border: 1px solid var(--border);
      background: var(--bg);
      text-align: center;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.2s, background 0.2s;

      &:hover {
        border-color: color-mix(in srgb, var(--accent) 35%, transparent);
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }

      strong {
        font-size: 1.2rem;
        color: var(--accent-soft);
      }

      span {
        font-size: 0.68rem;
        color: var(--text-muted);
      }
    }

    .insight {
      margin-bottom: 0.65rem;

      strong { color: var(--text); }

      &.insight-link {
        display: block;
        text-decoration: none;
        color: var(--text-muted);

        &:hover {
          color: var(--accent-muted);
        }
      }
    }

    .summary-links {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;

      a {
        font-size: 0.82rem;
        color: var(--accent-muted);
        text-decoration: none;

        &:hover { text-decoration: underline; }
      }
    }

    .category-attention {
      list-style: none;
      margin: 0 0 0.75rem;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;

      li {
        font-size: 0.78rem;

        a {
          color: var(--text-muted);
          text-decoration: none;

          &:hover {
            color: var(--accent-muted);
            text-decoration: underline;
          }
        }
      }
    }

    .desc {
      margin: 0 0 0.75rem;
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.5;

      &.muted { margin: 0; }
      &.warn { color: #fbbf24; }
      &:last-child { margin-bottom: 0; }
    }

    .status {
      margin: 0.5rem 0 0;
      font-size: 0.85rem;

      &.ok { color: var(--success); }
      &.error { color: var(--sync-error-text); }
    }

    .ok-line { color: var(--success); }

    .platform-hint {
      margin-top: 0.75rem;
      margin-bottom: 0;
      font-size: 0.78rem;
      line-height: 1.45;

      &.ok-line { color: var(--success); }
      &.warn-line { color: #fbbf24; }
    }

    .btn-secondary {
      margin-top: 0.75rem;
      width: 100%;
      padding: 0.65rem 1rem;
      border-radius: 0.75rem;
      border: 1px solid var(--border);
      background: rgba(99, 102, 241, 0.12);
      color: var(--accent-soft);
      font-size: 0.85rem;
      cursor: pointer;

      &:disabled {
        opacity: 0.6;
        cursor: default;
      }
    }

    .file-input {
      display: none;
    }

    .import-panel {
      margin-top: 0.85rem;
      padding: 0.85rem;
      border-radius: 0.75rem;
      border: 1px solid rgba(99, 102, 241, 0.25);
      background: rgba(99, 102, 241, 0.08);
    }

    .import-modes {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .mode-chip {
      flex: 1;
      padding: 0.45rem 0.65rem;
      border-radius: 0.55rem;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text-muted);
      font-size: 0.78rem;
      cursor: pointer;

      &.active {
        border-color: rgba(99, 102, 241, 0.5);
        background: rgba(99, 102, 241, 0.15);
        color: var(--accent-soft);
      }

      &.danger.active {
        border-color: color-mix(in srgb, var(--sync-error-text) 50%, transparent);
        background: var(--sync-error-bg);
        color: var(--sync-error-text);
      }
    }

    .import-actions {
      display: flex;
      gap: 0.5rem;

      .btn-secondary,
      .btn-primary {
        margin-top: 0;
        flex: 1;
      }
    }

    .theme-modes {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
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
        accent-color: var(--accent);
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
  private readonly bonds = inject(BondsService);
  readonly stats = this.bonds.networkStats;
  readonly formatContactDays = formatDaysSinceContact;
  readonly formatSyncTimestamp = formatSyncTimestamp;
  readonly categoryAttention = computed(() => {
    const counts = new Map<PersonCategory, number>();
    for (const person of this.bonds.peopleWithStatus()) {
      if (person.status === 'well') continue;
      counts.set(person.category, (counts.get(person.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({
        category,
        label: CATEGORY_LABELS[category],
        count,
      }));
  });
  readonly auth = inject(AuthService);
  readonly sync = inject(SyncService);
  readonly theme = inject(ThemeService);
  readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'dark', label: 'Oscuro' },
    { value: 'light', label: 'Claro' },
    { value: 'system', label: 'Sistema' },
  ];

  notificationsEnabled = this.notifications.isEnabled();
  testingPush = false;
  syncing = false;
  pushTestError = '';
  exportFeedback = '';
  importFeedback = '';
  importOk = true;

  readonly importMode = signal<ImportBackupMode>('merge');
  readonly pendingImport = signal<{ fileName: string; backup: BondsBackup } | null>(null);

  readonly syncBusy = computed(() => this.sync.indicator().status === 'syncing');

  appSubtitle(): string {
    if (this.pwa.isStandalone()) return 'App instalada en tu teléfono';
    if (this.pwa.canInstall()) return 'Instalala para acceso rápido';
    return 'Abrila desde el navegador o agregala al inicio';
  }

  resolvedThemeLabel(): string {
    const mode = this.theme.mode();
    if (mode === 'system') {
      return this.theme.resolvedTheme() === 'light' ? 'claro (sistema)' : 'oscuro (sistema)';
    }
    return mode === 'light' ? 'claro' : 'oscuro';
  }

  async install(): Promise<void> {
    await this.pwa.install();
  }

  async toggleNotifications(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const checked = input.checked;

    if (checked) {
      const granted = await this.notifications.enableWithPermission();
      this.notificationsEnabled = granted;
      if (!granted) {
        input.checked = false;
      }
    } else {
      await this.notifications.setEnabled(false);
      this.notificationsEnabled = false;
    }
  }

  async testPush(): Promise<void> {
    this.testingPush = true;
    this.pushTestError = '';
    try {
      await this.notifications.sendTestPush();
    } catch (error) {
      this.pushTestError =
        error instanceof Error ? error.message : 'No se pudo enviar la prueba.';
    } finally {
      this.testingPush = false;
    }
  }

  async syncNow(): Promise<void> {
    this.syncing = true;
    try {
      await this.sync.pushToCloud();
    } catch {
      // El banner global muestra el error.
    } finally {
      this.syncing = false;
    }
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/bienvenida');
  }

  exportBackup(): void {
    const data = this.bonds.exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bonds-backup-${toDateInputValue()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.exportFeedback = `Copia descargada · ${data.people.length} personas, ${data.interactions.length} contactos`;
    setTimeout(() => (this.exportFeedback = ''), 3000);
  }

  onBackupSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = parseBondsBackup(JSON.parse(String(reader.result)));
        this.importMode.set('merge');
        this.pendingImport.set({ fileName: file.name, backup });
        this.importFeedback = '';
      } catch (error) {
        this.importOk = false;
        this.importFeedback =
          error instanceof Error ? error.message : 'No se pudo leer el archivo.';
      }
    };
    reader.readAsText(file);
  }

  cancelImport(input: HTMLInputElement): void {
    this.pendingImport.set(null);
    input.value = '';
  }

  confirmImport(input: HTMLInputElement): void {
    const pending = this.pendingImport();
    if (!pending) return;

    try {
      const result = this.bonds.importBackup(pending.backup, this.importMode());
      this.importOk = true;
      this.importFeedback =
        this.importMode() === 'replace'
          ? `Red reemplazada (${result.peopleAdded} personas, ${result.interactionsAdded} interacciones).`
          : `Importación lista (+${result.peopleAdded} personas, +${result.interactionsAdded} interacciones).`;
      this.pendingImport.set(null);
      input.value = '';
      this.sync.schedulePush();
      setTimeout(() => (this.importFeedback = ''), 5000);
    } catch (error) {
      this.importOk = false;
      this.importFeedback =
        error instanceof Error ? error.message : 'No se pudo importar el archivo.';
    }
  }
}
