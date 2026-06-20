import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BondsService } from '../../core/services/bonds.service';
import {
  dateInputToIso,
  formatBirthdayCountdown,
  formatBirthdayLabel,
  formatDaysSinceContact,
  formatFrequencyDeadline,
  formatInteractionRegisteredLabel,
  formatPreferredContactHint,
  INTERACTION_ICONS,
  INTERACTION_LABELS,
  InteractionType,
  isPreferredInteractionType,
  PersonWithStatus,
  suggestsWhatsApp,
  telHref,
  toDateInputValue,
  whatsAppHref,
  whatsAppMessageForPerson,
} from '../../core/models/person.model';
import { PersonAvatarComponent } from '../../shared/person-avatar/person-avatar.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-week-connections',
  standalone: true,
  imports: [FormsModule, RouterLink, PersonAvatarComponent, StatusBadgeComponent],
  template: `
    <section class="week-page">
      <header>
        <h1>Esta semana</h1>
        <p class="subtitle">{{ headerSubtitle() }}</p>
      </header>

      @if (totalPeople() > 0 && connections().length > 0) {
        <input
          type="search"
          class="search"
          placeholder="Buscar en la lista…"
          [ngModel]="searchQuery()"
          (ngModelChange)="searchQuery.set($event)"
          aria-label="Buscar conexiones"
        />
      }

      @if (upcomingBirthdays().length > 0) {
        <section class="birthdays-section" aria-label="Próximos cumpleaños">
          <h2>🎂 Próximos cumpleaños</h2>
          <ul class="birthday-list">
            @for (entry of upcomingBirthdays(); track entry.person.id) {
              <li class="birthday-row" [class.imminent]="entry.daysUntil <= 1">
                <a [routerLink]="['/personas', entry.person.id]" class="birthday-item">
                  <app-person-avatar [name]="entry.person.name" [photo]="entry.person.photo" [size]="36" />
                  <div>
                    <strong>{{ entry.person.name }}</strong>
                    <span>{{ formatBirthday(entry.person.birthday!) }} · {{ formatCountdown(entry.daysUntil) }}</span>
                  </div>
                </a>
                <div class="birthday-actions">
                  @if (entry.person.phone) {
                    <button
                      type="button"
                      class="btn-secondary small wa"
                      (click)="openWhatsApp(entry.person)"
                      title="Felicitá por WhatsApp"
                    >
                      WA
                    </button>
                  }
                  <a [routerLink]="['/personas', entry.person.id]" class="btn-secondary small">Ver</a>
                </div>
              </li>
            }
          </ul>
        </section>
      }

      @if (totalPeople() === 0) {
        <div class="empty-state">
          <p>Todavía no hay nadie en tu red.</p>
          <p class="hint">Agregá a alguien importante para empezar a cuidar tus vínculos.</p>
          <a routerLink="/personas/nueva" class="btn-primary">Agregar primera persona</a>
        </div>
      } @else if (filteredConnections().length === 0) {
        <div class="empty-state">
          @if (searchQuery().trim()) {
            <p>Nadie coincide con «{{ searchQuery().trim() }}».</p>
            <button type="button" class="btn-secondary" (click)="searchQuery.set('')">Limpiar búsqueda</button>
          } @else {
            <p>🌿 Tu red está al día esta semana.</p>
            <p class="hint">Cuando alguien necesite atención, aparecerá acá.</p>
          }
        </div>
      } @else {
        <ul class="connection-list">
          @for (person of filteredConnections(); track person.id) {
            <li class="connection-item">
              <app-person-avatar [name]="person.name" [photo]="person.photo" [size]="44" />
              <div class="info">
                <a [routerLink]="['/personas', person.id]" class="person-name">{{ person.name }}</a>
                <span class="meta">
                  {{ formatContactDays(person.daysSinceContact) }}
                  · {{ formatFrequency(person.daysSinceContact, person.desiredFrequencyDays) }}
                </span>
                @if (person.pinnedNote) {
                  <span class="pinned-snippet">📌 {{ person.pinnedNote }}</span>
                }
                <span class="suggestion">{{ suggestion(person) }}</span>
                <app-status-badge [status]="person.status" [label]="person.statusLabel" />
              </div>
              <div class="actions">
                <button
                  type="button"
                  class="btn-secondary small"
                  [class.suggested]="isPreferredAction(person, 'mensaje')"
                  [disabled]="loggingId() === person.id"
                  (click)="logMessage(person.id)"
                  title="Registrar mensaje de hoy"
                >
                  {{ loggingId() === person.id && lastLogType() === 'mensaje' ? '✓' : '💬' }}
                </button>
                <button
                  type="button"
                  class="btn-secondary small"
                  [class.suggested]="isPreferredAction(person, 'llamada')"
                  [disabled]="loggingId() === person.id"
                  (click)="logCall(person.id)"
                  title="Registrar llamada de hoy"
                >
                  {{ loggingId() === person.id && lastLogType() === 'llamada' ? '✓' : '📞' }}
                </button>
                <button
                  type="button"
                  class="btn-secondary small"
                  [class.suggested]="isPreferredAction(person, 'visita')"
                  [disabled]="loggingId() === person.id"
                  (click)="quickLog(person.id, 'visita')"
                  title="Registrar visita de hoy"
                >
                  {{ loggingId() === person.id && lastLogType() === 'visita' ? '✓' : '🤝' }}
                </button>
                <button
                  type="button"
                  class="btn-secondary small"
                  [class.suggested]="isPreferredAction(person, 'salida')"
                  [disabled]="loggingId() === person.id"
                  (click)="quickLog(person.id, 'salida')"
                  title="Registrar salida de hoy"
                >
                  {{ loggingId() === person.id && lastLogType() === 'salida' ? '✓' : '☕' }}
                </button>
                <button
                  type="button"
                  class="btn-secondary small"
                  [class.suggested]="isPreferredAction(person, 'videollamada')"
                  [disabled]="loggingId() === person.id"
                  (click)="quickLog(person.id, 'videollamada')"
                  title="Registrar videollamada de hoy"
                >
                  {{ loggingId() === person.id && lastLogType() === 'videollamada' ? '✓' : '📹' }}
                </button>
                @if (person.phone) {
                  <button
                    type="button"
                    class="btn-secondary small wa"
                    [class.suggested]="suggestsWhatsApp(person)"
                    (click)="openWhatsApp(person)"
                    title="Abrir WhatsApp con mensaje sugerido"
                  >
                    WA
                  </button>
                }
                <button
                  type="button"
                  class="btn-secondary small"
                  [class.active]="dateLogId() === person.id"
                  (click)="toggleDateLog(person.id)"
                  title="Registrar con otra fecha"
                >
                  📅
                </button>
                <a [routerLink]="['/personas', person.id]" class="btn-secondary small">Ver</a>
              </div>
              @if (dateLogId() === person.id) {
                <div class="date-log-panel">
                  <label>
                    Fecha del contacto
                    <input type="date" [(ngModel)]="dateLogValue" [max]="maxDate" />
                  </label>
                  <div class="type-row">
                    <span class="type-label">Tipo</span>
                    <div class="type-chips">
                      @for (type of logTypes; track type) {
                        <button
                          type="button"
                          class="type-chip"
                          [class.active]="dateLogType === type"
                          (click)="dateLogType = type"
                        >
                          {{ interactionIcons[type] }}
                          {{ interactionLabels[type] }}
                        </button>
                      }
                    </div>
                  </div>
                  <div class="date-log-actions">
                    <button type="button" class="btn-secondary small" (click)="closeDateLog()">
                      Cancelar
                    </button>
                    <button type="button" class="btn-primary small" (click)="logOnDate(person.id)">
                      Registrar
                    </button>
                  </div>
                </div>
              }
            </li>
          }
        </ul>
        @if (undoState(); as undo) {
          <div class="undo-bar">
            <span>{{ undo.label }}</span>
            <button type="button" (click)="undoMessage()">Deshacer</button>
          </div>
        }
        @if (whatsAppPrompt(); as prompt) {
          <div class="undo-bar wa-prompt">
            <span>¿Le escribiste a {{ prompt.name }}?</span>
            <button type="button" (click)="logWhatsApp(prompt.personId)">Registrar mensaje</button>
          </div>
        }
      }

      @if (allAttended().length > 0) {
        <section class="attended-section">
          <h2>Al día</h2>
          @if (showAttendedSearch()) {
            <input
              type="search"
              class="search attended-search"
              placeholder="Buscar entre las al día…"
              [value]="attendedSearch()"
              (input)="attendedSearch.set($any($event.target).value)"
            />
          }
          <div class="attended-chips">
            @for (person of filteredAttended(); track person.id) {
              <a [routerLink]="['/personas', person.id]" class="chip">
                {{ person.name }}
              </a>
            }
          </div>
          @if (showAttendedSearch() && filteredAttended().length === 0) {
            <p class="attended-empty">Nadie coincide con esa búsqueda.</p>
          }
        </section>
      }
    </section>
  `,
  styles: `
    .week-page {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
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

    .search {
      width: 100%;
      padding: 0.65rem 0.85rem;
      border-radius: 0.65rem;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font: inherit;
    }

    .birthdays-section {
      h2 {
        margin: 0 0 0.65rem;
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--birthday);
      }
    }

    .birthday-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .birthday-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 0.75rem;
      border: 1px solid var(--birthday-border);
      background: var(--birthday-bg);

      &.imminent {
        border-color: var(--birthday);
        box-shadow: 0 0 0 1px var(--birthday-border);
      }
    }

    .birthday-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex: 1;
      min-width: 0;
      padding: 0.25rem;
      text-decoration: none;
      color: inherit;

      strong {
        display: block;
        font-size: 0.88rem;
      }

      span {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
    }

    .birthday-actions {
      display: flex;
      gap: 0.35rem;
      flex-shrink: 0;
    }

    .connection-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .connection-item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
    }

    .info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;

      strong,
      .person-name {
        font-size: 0.95rem;
        font-weight: 600;
      }

      .person-name {
        color: inherit;
        text-decoration: none;

        &:hover {
          color: var(--accent);
        }
      }
    }

    .meta {
      font-size: 0.78rem;
      color: var(--accent-muted);
    }

    .pinned-snippet {
      font-size: 0.72rem;
      color: var(--accent-muted);
      opacity: 0.85;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .suggestion {
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .btn-secondary.small {
      padding: 0.4rem 0.75rem;
      font-size: 0.8rem;
      white-space: nowrap;
      min-width: 2.75rem;
      text-align: center;

      &.active {
        border-color: rgba(99, 102, 241, 0.5);
        background: rgba(99, 102, 241, 0.15);
      }

      &.wa {
        color: var(--wa);
        border-color: var(--wa-border);
      }

      &.suggested {
        border-color: rgba(99, 102, 241, 0.55);
        background: rgba(99, 102, 241, 0.2);
        box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.25);
      }

      &.wa.suggested {
        border-color: var(--wa);
        background: var(--wa-bg);
        box-shadow: 0 0 0 1px var(--wa-border);
      }
    }

    .btn-primary.small {
      padding: 0.4rem 0.75rem;
      font-size: 0.8rem;
      white-space: nowrap;
    }

    .date-log-panel {
      flex: 1 1 100%;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border);

      label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.72rem;
        color: var(--text-muted);
      }

      input {
        width: 100%;
        padding: 0.5rem 0.65rem;
        border-radius: 0.55rem;
        border: 1px solid var(--border);
        background: var(--bg);
        color: var(--text);
        font: inherit;
        color-scheme: dark;
      }
    }

    .type-row {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .type-label {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .type-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .type-chip {
      padding: 0.3rem 0.55rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text-muted);
      font-size: 0.68rem;
      cursor: pointer;

      &.active {
        border-color: rgba(99, 102, 241, 0.5);
        background: rgba(99, 102, 241, 0.15);
        color: var(--accent-soft);
      }
    }

    .date-log-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      align-items: center;

      .hint {
        font-size: 0.85rem;
        margin: 0;
      }
    }

    .attended-section {
      h2 {
        font-size: 0.9rem;
        color: var(--text-muted);
        margin: 0 0 0.75rem;
        font-weight: 500;
      }
    }

    .attended-search {
      margin-bottom: 0.65rem;
    }

    .attended-empty {
      margin: 0.5rem 0 0;
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    .attended-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .chip {
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: var(--status-well-bg);
      color: var(--status-well-text);
      text-decoration: none;
      font-size: 0.82rem;

      &:hover {
        background: color-mix(in srgb, var(--status-well-dot) 25%, transparent);
      }
    }

    .undo-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
      font-size: 0.82rem;
      color: var(--accent-soft);

      &.wa-prompt {
        background: var(--wa-bg);
        border-color: var(--wa-border);
        color: var(--wa-text);

        button { color: var(--wa); }
      }

      button {
        border: none;
        background: transparent;
        color: var(--accent-muted);
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
      }
    }
  `,
})
export class WeekConnectionsComponent {
  private readonly bonds = inject(BondsService);

  readonly connections = this.bonds.weekConnections;
  readonly upcomingBirthdays = this.bonds.upcomingBirthdays;
  readonly searchQuery = signal('');
  readonly filteredConnections = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.connections();
    if (!query) return list;
    return list.filter((person) => person.name.toLowerCase().includes(query));
  });
  readonly totalPeople = computed(() => this.bonds.people().length);
  readonly loggingId = signal<string | null>(null);
  readonly lastLogType = signal<InteractionType | null>(null);
  readonly whatsAppPrompt = signal<{ personId: string; name: string } | null>(null);
  readonly undoState = signal<{ id: string; label: string } | null>(null);
  readonly dateLogId = signal<string | null>(null);
  readonly maxDate = toDateInputValue();
  readonly formatContactDays = formatDaysSinceContact;
  readonly formatFrequency = formatFrequencyDeadline;
  readonly formatBirthday = formatBirthdayLabel;
  readonly formatCountdown = formatBirthdayCountdown;
  readonly suggestsWhatsApp = suggestsWhatsApp;
  readonly interactionLabels = INTERACTION_LABELS;
  readonly interactionIcons = INTERACTION_ICONS;
  readonly logTypes: InteractionType[] = ['mensaje', 'llamada', 'visita', 'salida', 'videollamada'];

  dateLogValue = toDateInputValue();
  dateLogType: InteractionType = 'mensaje';

  private undoTimer?: ReturnType<typeof setTimeout>;
  private whatsAppTimer?: ReturnType<typeof setTimeout>;

  readonly headerSubtitle = computed(() => {
    const list = this.connections();
    const count = list.length;
    if (this.totalPeople() === 0) return 'Conexiones que merecen tu intención';
    if (count === 0) return 'Nadie pendiente por ahora — ¡buen trabajo!';
    const top = list[0];
    const firstName = top.name.trim().split(/\s+/)[0] || top.name;
    const last =
      top.daysSinceContact === 0
        ? 'último contacto hoy'
        : this.formatContactDays(top.daysSinceContact).toLowerCase();
    if (count === 1) return `${firstName} — ${last}`;
    return `${count} conexiones · ${firstName} — ${last}`;
  });

  readonly allAttended = computed(() =>
    this.bonds.peopleWithStatus().filter((p) => p.status === 'well'),
  );
  readonly attendedSearch = signal('');
  readonly showAttendedSearch = computed(() => this.allAttended().length > 8);
  readonly filteredAttended = computed(() => {
    const query = this.attendedSearch().trim().toLowerCase();
    const list = this.allAttended();
    if (!query) return list;
    return list.filter((person) => person.name.toLowerCase().includes(query));
  });

  logMessage(personId: string): void {
    this.quickLog(personId, 'mensaje');
  }

  logCall(personId: string): void {
    this.quickLog(personId, 'llamada');
  }

  quickLog(personId: string, type: InteractionType): void {
    this.closeDateLog();
    this.registerInteraction(
      personId,
      type,
      new Date().toISOString(),
      `${this.interactionLabels[type]} registrado`,
    );
  }

  openWhatsApp(person: PersonWithStatus): void {
    if (!person.phone) return;
    const message = whatsAppMessageForPerson(person);
    window.open(whatsAppHref(person.phone, message), '_blank', 'noopener,noreferrer');
    this.whatsAppPrompt.set({ personId: person.id, name: person.name.split(' ')[0] });
    clearTimeout(this.whatsAppTimer);
    this.whatsAppTimer = setTimeout(() => this.whatsAppPrompt.set(null), 30_000);
  }

  logWhatsApp(personId: string): void {
    this.whatsAppPrompt.set(null);
    clearTimeout(this.whatsAppTimer);
    this.registerInteraction(
      personId,
      'mensaje',
      new Date().toISOString(),
      'Mensaje registrado',
      'WhatsApp',
    );
  }

  toggleDateLog(personId: string): void {
    if (this.dateLogId() === personId) {
      this.closeDateLog();
      return;
    }
    this.dateLogId.set(personId);
    this.dateLogValue = toDateInputValue();
    this.dateLogType = 'mensaje';
  }

  closeDateLog(): void {
    this.dateLogId.set(null);
    this.dateLogValue = toDateInputValue();
    this.dateLogType = 'mensaje';
  }

  logOnDate(personId: string): void {
    const dateIso = dateInputToIso(this.dateLogValue);
    const type = this.dateLogType;
    this.closeDateLog();
    this.registerInteraction(
      personId,
      type,
      dateIso,
      `${this.interactionLabels[type]} · ${formatInteractionRegisteredLabel(dateIso)}`,
    );
  }

  undoMessage(): void {
    const undo = this.undoState();
    if (!undo) return;
    this.bonds.removeInteraction(undo.id);
    this.undoState.set(null);
    this.loggingId.set(null);
    this.lastLogType.set(null);
    clearTimeout(this.undoTimer);
  }

  suggestion(person: PersonWithStatus): string {
    const base: Record<string, string> = {
      soon: `Podrías escribirle o llamarle`,
      reconnect: `Hace tiempo — un mensaje corto puede bastar`,
      attention: `Te extraña, aunque no lo diga`,
      well: `Todo bien por ahora`,
    };
    const text = base[person.status] ?? `Conectar con ${person.name}`;
    if (person.preferredContact) {
      return `${formatPreferredContactHint(person.preferredContact)} · ${text}`;
    }
    return text;
  }

  isPreferredAction(person: PersonWithStatus, type: InteractionType): boolean {
    return isPreferredInteractionType(person.preferredContact, type);
  }

  private registerInteraction(
    personId: string,
    type: InteractionType,
    dateIso: string,
    label: string,
    note?: string,
  ): void {
    const interaction = this.bonds.logInteraction(personId, type, dateIso, note);
    this.loggingId.set(personId);
    this.lastLogType.set(type);
    this.undoState.set({ id: interaction.id, label });
    clearTimeout(this.undoTimer);
    this.undoTimer = setTimeout(() => {
      this.undoState.set(null);
      if (this.loggingId() === personId) {
        this.loggingId.set(null);
        this.lastLogType.set(null);
      }
    }, 5000);
    setTimeout(() => {
      if (this.loggingId() === personId && !this.undoState()) {
        this.loggingId.set(null);
        this.lastLogType.set(null);
      }
    }, 1500);
  }
}
