import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AiImportService } from '../../core/services/ai-import.service';
import { AuthService } from '../../core/services/auth.service';
import { BondsService } from '../../core/services/bonds.service';
import { SyncService } from '../../core/services/sync.service';
import {
  CATEGORY_LABELS,
  formatDaysSinceContact,
} from '../../core/models/person.model';
import { AiStatusResponse, ImportedPersonDraft } from '../../core/models/imported-person.model';
type Step = 'account' | 'method' | 'ai-input' | 'ai-preview' | 'manual';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="onboarding">
      @switch (step()) {
        @case ('account') {
          <header>
            <p class="eyebrow">Paso 1 de 3</p>
            <h1>Tu red, en la nube</h1>
            <p class="lead">
              Creá una cuenta para sincronizar tu red entre dispositivos y usar la importación con IA.
            </p>
          </header>

          <form class="card" (ngSubmit)="submitAccount()">
            @if (!loginMode) {
              <label>
                Nombre
                <input [(ngModel)]="name" name="name" placeholder="Valen" required />
              </label>
            }
            <label>
              Email
              <input [(ngModel)]="email" name="email" type="email" placeholder="tu@email.com" required />
            </label>
            <label>
              Contraseña
              <input
                [(ngModel)]="password"
                name="password"
                type="password"
                minlength="6"
                placeholder="Mínimo 6 caracteres"
                required
              />
            </label>
            @if (accountError) {
              <p class="error">{{ accountError }}</p>
            }
            <button type="submit" class="btn-primary" [disabled]="accountLoading">
              {{
                accountLoading
                  ? 'Esperá…'
                  : loginMode
                    ? 'Iniciar sesión'
                    : 'Crear cuenta y continuar'
              }}
            </button>
            <button type="button" class="btn-secondary" (click)="loginInstead()">
              {{ loginMode ? 'Crear cuenta nueva' : 'Ya tengo cuenta' }}
            </button>
          </form>
        }

        @case ('method') {
          <header>
            <p class="eyebrow">Paso 2 de 3</p>
            <h1>{{ methodTitle() }}</h1>
            <p class="lead">{{ methodLead() }}</p>
          </header>

          @if (syncNotice()) {
            <p class="sync-notice" [class.warn]="syncNoticeKind() === 'warn'">{{ syncNotice() }}</p>
          }

          @if (cloudPeopleCount() > 0) {
            <div class="card cloud-ready">
              <p class="ok-line">Ya tenés {{ cloudPeopleCount() }} persona{{ cloudPeopleCount() === 1 ? '' : 's' }} en la nube.</p>
              <button type="button" class="btn-primary" (click)="skipToNetwork()">Ir a mi red</button>
            </div>
          }

          <div class="card choices">
            @if (aiAvailable()) {
              <button type="button" class="choice" (click)="goToAi()">
                <strong>✦ Importar con IA</strong>
                <span>Ideal: un párrafo libre sobre mamá, amigos, laburo…</span>
              </button>
              <button type="button" class="choice secondary" (click)="goManual()">
                <strong>♡ Agregar una por una</strong>
                <span>Tutorial corto para tu primera persona</span>
              </button>
            } @else {
              <div class="ai-unavailable">
                <p class="warn">{{ aiUnavailableReason() }}</p>
                @if (aiStatusLoading) {
                  <p class="hint">Comprobando disponibilidad…</p>
                } @else {
                  <button type="button" class="btn-secondary compact" (click)="retryAiStatus()">
                    Reintentar IA
                  </button>
                }
              </div>
              <button type="button" class="choice recommended" (click)="goManual()">
                <strong>♡ Empezar persona por persona</strong>
                <span>Recomendado ahora — tutorial de 3 pasos</span>
              </button>
              <button type="button" class="choice secondary" (click)="goAddPerson()">
                <strong>→ Ir directo a agregar</strong>
                <span>Saltá el tutorial y cargá tu primera persona</span>
              </button>
            }
          </div>
        }

        @case ('ai-input') {
          <header>
            <p class="eyebrow">Importación con IA</p>
            <h1>Tu red en un párrafo</h1>
          </header>

          <div class="card">
            <textarea
              [(ngModel)]="aiText"
              rows="8"
              placeholder="Ej: Veo a mamá cada semana por llamada. Juan es un amigo del secundario, hace meses que no hablamos. Con Martín del laburo mando mensajes cada dos semanas…"
            ></textarea>
            <p class="hint">Solo usamos este texto para extraer nombres y frecuencias. No lo guardamos.</p>
            @if (aiError) {
              <p class="error">{{ aiError }}</p>
            }
            <button type="button" class="btn-primary" [disabled]="aiLoading" (click)="runAiImport()">
              {{ aiLoading ? 'Analizando…' : 'Analizar con IA' }}
            </button>
            <button type="button" class="btn-secondary" (click)="step.set('method')">Volver</button>
          </div>
        }

        @case ('ai-preview') {
          <header>
            <p class="eyebrow">Revisá antes de guardar</p>
            <h1>{{ preview().length }} personas detectadas</h1>
          </header>

          <ul class="preview-list">
            @for (person of preview(); track person.name) {
              <li class="card preview-item">
                <strong>{{ person.name }}</strong>
                <span>{{ categoryLabels[person.category] }} · cada {{ person.desiredFrequencyDays }} días</span>
                @if (person.daysSinceLastContact != null) {
                  <span class="meta">Último contacto {{ formatContactDays(person.daysSinceLastContact) }}</span>
                }
              </li>
            }
          </ul>

          <button type="button" class="btn-primary" (click)="confirmImport()">Agregar a mi red</button>
          <button type="button" class="btn-secondary" (click)="step.set('ai-input')">Editar párrafo</button>
        }

        @case ('manual') {
          <header>
            <p class="eyebrow">Tutorial</p>
            <h1>Tu primera persona</h1>
            <p class="lead">Tres pasos simples. Después podés sumar más desde Personas.</p>
          </header>

          <ol class="tutorial card">
            <li><strong>Elegí quién</strong> — alguien que quieras cuidar (familia, amigo, pareja…).</li>
            <li><strong>Definí la frecuencia</strong> — cada cuántos días te gustaría conectar.</li>
            <li><strong>Registrá el último contacto</strong> — así Bonds sabe si hoy hace falta un mensaje.</li>
          </ol>

          <button type="button" class="btn-primary" (click)="goAddPerson()">Agregar mi primera persona</button>
          <button type="button" class="btn-secondary" (click)="step.set('method')">Volver</button>
        }
      }
    </section>
  `,
  styles: `
    .onboarding {
      max-width: 480px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    header h1 {
      margin: 0.35rem 0 0.5rem;
      font-size: 1.5rem;
    }

    .eyebrow {
      margin: 0;
      font-size: 0.75rem;
      color: var(--accent-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .lead, .hint {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    input, textarea {
      width: 100%;
      padding: 0.7rem 0.85rem;
      border-radius: 0.65rem;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font: inherit;
    }

    textarea { resize: vertical; min-height: 140px; }

    .choices { gap: 0.75rem; }

    .choice {
      text-align: left;
      padding: 1rem;
      border-radius: 0.85rem;
      border: 1px solid rgba(99, 102, 241, 0.35);
      background: rgba(99, 102, 241, 0.1);
      color: var(--text);
      cursor: pointer;

      strong { display: block; margin-bottom: 0.25rem; }
      span { font-size: 0.82rem; color: var(--text-muted); }

      &.secondary {
        border-color: var(--border);
        background: transparent;
      }

      &.recommended {
        border-color: rgba(52, 211, 153, 0.45);
        background: rgba(52, 211, 153, 0.1);
      }
    }

    .ai-unavailable {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding-bottom: 0.25rem;
    }

    .cloud-ready {
      gap: 0.75rem;

      .ok-line {
        margin: 0;
        color: var(--success);
        font-size: 0.88rem;
        line-height: 1.45;
      }
    }

    .btn-secondary.compact {
      align-self: flex-start;
      padding: 0.45rem 0.85rem;
      font-size: 0.8rem;
    }

    .preview-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .preview-item {
      gap: 0.2rem;

      span { font-size: 0.82rem; color: var(--text-muted); }
      .meta { color: #fbbf24; }
    }

    .tutorial {
      margin: 0;
      padding-left: 1.25rem;
      line-height: 1.6;
      color: var(--text-muted);
    }

    .error { margin: 0; color: var(--sync-error-text); font-size: 0.85rem; }
    .warn { margin: 0; color: #fbbf24; font-size: 0.85rem; line-height: 1.45; }

    .sync-notice {
      margin: 0;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: rgba(52, 211, 153, 0.12);
      color: var(--success);
      font-size: 0.85rem;
      line-height: 1.45;

      &.warn {
        background: rgba(251, 191, 36, 0.12);
        color: var(--warning);
      }
    }
  `,
})
export class OnboardingComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly sync = inject(SyncService);
  private readonly bonds = inject(BondsService);
  private readonly ai = inject(AiImportService);
  private readonly router = inject(Router);

  readonly step = signal<Step>('account');
  readonly aiAvailable = signal(false);
  readonly aiStatus = signal<AiStatusResponse | null>(null);
  readonly cloudPeopleCount = signal(0);
  readonly preview = signal<ImportedPersonDraft[]>([]);
  readonly categoryLabels = CATEGORY_LABELS;
  readonly syncNotice = signal('');
  readonly syncNoticeKind = signal<'ok' | 'warn'>('ok');
  readonly formatContactDays = formatDaysSinceContact;

  readonly methodTitle = computed(() =>
    this.aiAvailable() ? 'Contanos tu red' : 'Armá tu red',
  );

  readonly methodLead = computed(() =>
    this.aiAvailable()
      ? 'Escribí un párrafo con las personas importantes y cómo suele ser el vínculo. La IA las organiza por vos.'
      : 'La importación con IA no está disponible ahora. Podés sumar personas manualmente — lleva solo un minuto.',
  );

  readonly aiUnavailableReason = computed(() => {
    const status = this.aiStatus();
    if (!status) return 'No pudimos contactar al servidor. Revisá tu conexión o el API local.';
    if (!status.redisReady && !status.geminiReady) {
      return 'Falta configurar Redis y Gemini en el servidor.';
    }
    if (!status.redisReady) return 'Falta Redis en el servidor (sync en la nube).';
    if (!status.geminiReady) return 'Falta la API key de Gemini en el servidor.';
    return 'La importación con IA no está disponible ahora.';
  });

  name = '';
  email = '';
  password = '';
  aiText = '';
  accountError = '';
  aiError = '';
  accountLoading = false;
  aiLoading = false;
  aiStatusLoading = false;
  loginMode = false;

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.step.set('method');
      void this.loadAiStatus();
      this.cloudPeopleCount.set(this.bonds.people().length);
    }
  }

  async submitAccount(): Promise<void> {
    this.accountError = '';
    this.accountLoading = true;
    try {
      if (this.loginMode) {
        await this.auth.login(this.email, this.password);
      } else {
        await this.auth.register(this.email, this.password, this.name);
      }
      const mergeResult = await this.sync.mergeOnLogin();
      this.applySyncNotice(mergeResult);
      this.bonds.reloadFromStorage();
      this.cloudPeopleCount.set(mergeResult.peopleCount);
      this.step.set('method');
      await this.loadAiStatus();
    } catch (error) {
      this.accountError = error instanceof Error ? error.message : 'No se pudo continuar.';
    } finally {
      this.accountLoading = false;
    }
  }

  loginInstead(): void {
    this.loginMode = !this.loginMode;
  }

  goToAi(): void {
    this.step.set('ai-input');
  }

  goManual(): void {
    this.step.set('manual');
  }

  async runAiImport(): Promise<void> {
    this.aiError = '';
    if (this.aiText.trim().length < 20) {
      this.aiError = 'Escribí un poco más sobre tu red.';
      return;
    }

    this.aiLoading = true;
    try {
      const people = await this.ai.importFromText(this.aiText);
      if (people.length === 0) {
        this.aiError = 'No detectamos personas. Probá agregar una por una.';
        return;
      }
      this.preview.set(people);
      this.step.set('ai-preview');
    } catch {
      this.aiError = 'La IA no respondió. Probá de nuevo o agregá persona por persona.';
      this.aiAvailable.set(false);
    } finally {
      this.aiLoading = false;
    }
  }

  confirmImport(): void {
    this.bonds.importFromDrafts(this.preview());
    void this.router.navigateByUrl('/');
  }

  goAddPerson(): void {
    void this.router.navigateByUrl('/personas/nueva');
  }

  skipToNetwork(): void {
    this.bonds.markOnboardingComplete();
    void this.router.navigateByUrl('/');
  }

  async retryAiStatus(): Promise<void> {
    await this.loadAiStatus();
  }

  private async loadAiStatus(): Promise<void> {
    this.aiStatusLoading = true;
    try {
      const status = await this.ai.getStatus();
      this.aiStatus.set(status);
      this.aiAvailable.set(!!status?.geminiReady && !!status?.redisReady);
    } finally {
      this.aiStatusLoading = false;
    }
  }

  private applySyncNotice(result: {
    message?: string;
    warning?: string;
  }): void {
    if (result.warning) {
      this.syncNotice.set(result.warning);
      this.syncNoticeKind.set('warn');
      return;
    }
    if (result.message) {
      this.syncNotice.set(result.message);
      this.syncNoticeKind.set('ok');
      return;
    }
    this.syncNotice.set('');
  }
}
