import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BondsService } from '../../core/services/bonds.service';
import {
  INTERACTION_ICONS,
  INTERACTION_LABELS,
  Interaction,
  InteractionType,
  PersonWithStatus,
  CATEGORY_LABELS,
  dateInputToIso,
  formatInteractionRegisteredLabel,
  formatBirthdayLabel,
  formatBirthdayCountdown,
  birthdayCtaText,
  daysUntilBirthday,
  isBirthdayImminent,
  formatPreferredContactHint,
  formatLastContactLabel,
  formatFrequencyDeadline,
  formatAverageContactInterval,
  formatMonthLabel,
  formatLastInteractionSummary,
  formatInteractionAge,
  formatAttentionMessage,
  getAttentionCta,
  isPreferredInteractionType,
  suggestsWhatsApp,
  buildContactSharePayload,
  canShareContacts,
  getMonthKey,
  mailtoHref,
  telHref,
  toDateInputValue,
  whatsAppHref,
  whatsAppMessageForPerson,
} from '../../core/models/person.model';
import { PersonAvatarComponent } from '../../shared/person-avatar/person-avatar.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-person-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, PersonAvatarComponent, StatusBadgeComponent],
  template: `
    @if (person(); as p) {
      <section class="detail-page">
        <header>
          <a routerLink="/personas" class="back-link">← Personas</a>
          <div class="profile">
            <app-person-avatar [name]="p.name" [photo]="p.photo" [size]="80" />
            <div>
              <h1>{{ p.name }}</h1>
              <p class="meta category">{{ categoryLabels[p.category] }}</p>
              <p class="meta">{{ formatLastContact(p.daysSinceContact) }}</p>
              <p class="meta freq">{{ formatFrequency(p.daysSinceContact, p.desiredFrequencyDays) }}</p>
              <p class="meta subtle">{{ profileSubtitle(p) }}</p>
              @if (averageInterval(); as rhythm) {
                <p class="meta rhythm">{{ rhythm }}</p>
              }
              @if (p.birthday) {
                <p class="meta birthday">
                  🎂 {{ formatBirthday(p.birthday) }} · {{ birthdayCountdown(p.birthday) }}
                </p>
              }
              @if (p.preferredContact) {
                <p class="meta pref">{{ preferredHint(p.preferredContact) }}</p>
              }
              <div class="profile-links">
                <a routerLink="/" [queryParams]="{ person: p.id }">Ver en el grafo</a>
                @if (p.status !== 'well') {
                  <a routerLink="/semana">En esta semana</a>
                }
              </div>
              <app-status-badge [status]="p.status" [label]="p.statusLabel" />
            </div>
          </div>
          <a [routerLink]="['/personas', p.id, 'editar']" class="btn-secondary">Editar</a>
        </header>

        @if (showBirthdayCta(p)) {
          <section class="card birthday-cta">
            <p>{{ birthdayCta(p) }}</p>
            <button type="button" class="contact-btn primary" (click)="openWhatsApp(p)">
              🎂 Felicitá por WhatsApp
            </button>
          </section>
        }

        @if (attentionCta(p); as cta) {
          <section class="card attention-cta">
            <p>{{ attentionMessage(p) }}</p>
            @switch (cta.kind) {
              @case ('whatsapp') {
                <button type="button" class="contact-btn primary" (click)="openWhatsApp(p)">
                  {{ cta.label }}
                </button>
              }
              @case ('call') {
                <a [href]="telLink(p.phone!)" class="contact-btn primary">{{ cta.label }}</a>
              }
              @case ('log') {
                <button type="button" class="contact-btn primary" (click)="logInteraction(cta.logType!)">
                  {{ cta.label }}
                </button>
              }
            }
          </section>
        }

        @if (!p.phone && !p.email) {
          <section class="card contact-nudge">
            <p>Agregá teléfono o email para contactar más rápido desde acá.</p>
            <a [routerLink]="['/personas', p.id, 'editar']" class="btn-secondary">Completar contacto</a>
          </section>
        }

        @if (p.phone || p.email) {
          <section class="card contact-card">
            <h2>Contacto</h2>
            @if (p.phone) {
              <label class="note-field compact wa-field">
                Mensaje para WhatsApp
                <textarea [(ngModel)]="whatsAppDraft" rows="2" maxlength="500"></textarea>
              </label>
              <div class="contact-actions">
                <button type="button" class="contact-btn primary" (click)="openWhatsApp(p)">
                  💬 Abrir WhatsApp
                </button>
                <a [href]="telLink(p.phone)" class="contact-btn">📞 Llamar</a>
                <button type="button" class="contact-btn ghost" (click)="resetWhatsAppDraft(p)">
                  Restaurar sugerido
                </button>
                @if (canShareContacts) {
                  <button type="button" class="contact-btn ghost" (click)="shareContact(p)">
                    Compartir
                  </button>
                }
              </div>
              @if (whatsAppLogPrompt()) {
                <div class="wa-log-prompt">
                  <span>¿Le escribiste?</span>
                  <button type="button" (click)="logWhatsAppContact()">Registrar mensaje</button>
                </div>
              }
              <div class="contact-meta-row">
                <span>{{ p.phone }}</span>
                <button type="button" class="copy-btn" (click)="copyText(p.phone!, 'Teléfono')">
                  Copiar
                </button>
              </div>
            } @else {
              <div class="contact-actions">
                @if (p.email) {
                  <a [href]="emailLink(p.email)" class="contact-btn">✉️ Email</a>
                }
                @if (canShareContacts) {
                  <button type="button" class="contact-btn ghost" (click)="shareContact(p)">
                    Compartir
                  </button>
                }
              </div>
            }
            @if (p.email && p.phone) {
              <div class="contact-meta-row">
                <a [href]="emailLink(p.email)" class="contact-meta link">{{ p.email }}</a>
                <button type="button" class="copy-btn" (click)="copyText(p.email!, 'Email')">
                  Copiar
                </button>
              </div>
            } @else if (p.email) {
              <div class="contact-meta-row">
                <a [href]="emailLink(p.email)" class="contact-meta link">{{ p.email }}</a>
                <button type="button" class="copy-btn" (click)="copyText(p.email!, 'Email')">
                  Copiar
                </button>
              </div>
            }
            @if (copyFeedback(); as feedback) {
              <p class="copy-feedback">{{ feedback }}</p>
            }
          </section>
        }

        <section class="card pinned-card">
          <div class="pinned-header">
            <h2>Nota fija</h2>
            @if (!editingPinned()) {
              <button type="button" class="link-btn" (click)="startPinnedEdit(p)">
                {{ p.pinnedNote ? 'Editar' : 'Agregar' }}
              </button>
            }
          </div>
          @if (editingPinned()) {
            <label class="note-field compact">
              <textarea
                [(ngModel)]="pinnedNoteDraft"
                rows="3"
                maxlength="300"
                placeholder="Recordá algo importante sobre esta persona…"
              ></textarea>
            </label>
            <div class="history-actions">
              <button type="button" class="btn-secondary small" (click)="cancelPinnedEdit()">
                Cancelar
              </button>
              <button type="button" class="btn-primary small" (click)="savePinnedNote()">
                Guardar
              </button>
            </div>
          } @else if (p.pinnedNote) {
            <p class="pinned-text">{{ p.pinnedNote }}</p>
          } @else {
            <p class="empty pinned-empty">
              Ideal para gustos, temas de conversación o cosas a recordar antes de escribirle.
            </p>
          }
        </section>

        <section class="card">
          <h2>Registrar interacción</h2>
          @if (p.lastInteraction; as last) {
            <button type="button" class="repeat-btn" (click)="repeatLastInteraction(last.type)">
              ↻ Repetir {{ interactionLabels[last.type] }}
            </button>
          }
          <label class="note-field">
            Fecha del contacto
            <input
              type="date"
              [(ngModel)]="pendingDate"
              [max]="maxDate"
              class="date-input"
            />
          </label>
          <label class="note-field">
            Nota opcional
            <textarea
              [(ngModel)]="pendingNote"
              rows="2"
              maxlength="200"
              placeholder="Ej: Hablamos del viaje, quedamos en llamar el viernes…"
            ></textarea>
          </label>
          <div class="interaction-grid">
            @for (type of interactionTypes; track type) {
              <button
                type="button"
                class="interaction-btn"
                [class.suggested]="isPreferredAction(p.preferredContact, type)"
                (click)="logInteraction(type)"
              >
                <span class="icon">{{ interactionIcons[type] }}</span>
                {{ interactionLabels[type] }}
              </button>
            }
          </div>
          @if (interactionFeedback()) {
            <p class="feedback">{{ interactionFeedback() }}</p>
          }
          @if (undoState(); as undo) {
            <div class="undo-bar">
              <span>{{ undo.label }}</span>
              <button type="button" (click)="undoInteraction()">Deshacer</button>
            </div>
          }
        </section>

        <section class="card">
          <div class="history-header">
            <h2>Historial</h2>
            @if (interactionBreakdown().length > 0) {
              <div class="type-breakdown" aria-label="Contactos por tipo">
                @for (entry of interactionBreakdown(); track entry.type) {
                  <span class="type-pill" [title]="interactionLabels[entry.type]">
                    {{ interactionIcons[entry.type] }} {{ entry.count }}
                  </span>
                }
              </div>
            }
            @if (historyMonths().length > 1 || historyTypes().length > 1) {
              <div class="history-filters">
                @if (historyMonths().length > 1) {
                  <div class="month-filters">
                    <button
                      type="button"
                      class="month-chip"
                      [class.active]="historyMonth() === 'all'"
                      (click)="historyMonth.set('all')"
                    >
                      Todos
                    </button>
                    @for (month of historyMonths(); track month) {
                      <button
                        type="button"
                        class="month-chip"
                        [class.active]="historyMonth() === month"
                        (click)="historyMonth.set(month)"
                      >
                        {{ formatMonth(month) }}
                      </button>
                    }
                  </div>
                }
                @if (historyTypes().length > 1) {
                  <div class="type-filters">
                    <button
                      type="button"
                      class="month-chip"
                      [class.active]="historyType() === 'all'"
                      (click)="historyType.set('all')"
                    >
                      Todos los tipos
                    </button>
                    @for (type of historyTypes(); track type) {
                      <button
                        type="button"
                        class="month-chip"
                        [class.active]="historyType() === type"
                        (click)="historyType.set(type)"
                      >
                        {{ interactionIcons[type] }} {{ interactionLabels[type] }}
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
          @if (interactions().length === 0) {
            <p class="empty">Sin interacciones registradas aún.</p>
          } @else if (filteredInteractions().length === 0) {
            <p class="empty">{{ historyEmptyMessage() }}</p>
          } @else {
            <ul class="history">
              @for (item of filteredInteractions(); track item.id) {
                <li>
                  <span class="icon">{{ interactionIcons[item.type] }}</span>
                  <div class="history-body">
                    @if (editingId() === item.id) {
                      <label class="note-field compact">
                        Fecha
                        <input
                          type="date"
                          [(ngModel)]="editDate"
                          [max]="maxDate"
                          class="date-input"
                        />
                      </label>
                      <label class="note-field compact">
                        Nota
                        <textarea [(ngModel)]="editNote" rows="2" maxlength="200"></textarea>
                      </label>
                      <div class="history-actions">
                        <button type="button" class="btn-secondary small" (click)="cancelEdit()">
                          Cancelar
                        </button>
                        <button type="button" class="btn-primary small" (click)="saveEdit(item.id)">
                          Guardar
                        </button>
                      </div>
                    } @else {
                      <strong>{{ interactionLabels[item.type] }}</strong>
                      <span class="date">
                        {{ item.date | date:'d MMM y, HH:mm' }} · {{ formatInteractionAge(item.date) }}
                      </span>
                      @if (item.note) {
                        <p class="note">{{ item.note }}</p>
                      }
                      <div class="history-actions">
                        <button type="button" class="link-btn" (click)="startEdit(item)">
                          Editar
                        </button>
                        @if (deletingId() === item.id) {
                          <span class="delete-confirm">
                            ¿Eliminar?
                            <button type="button" class="link-btn danger" (click)="confirmDelete(item.id)">
                              Sí
                            </button>
                            <button type="button" class="link-btn" (click)="deletingId.set(null)">No</button>
                          </span>
                        } @else {
                          <button type="button" class="link-btn danger" (click)="deletingId.set(item.id)">
                            Eliminar
                          </button>
                        }
                      </div>
                    }
                  </div>
                </li>
              }
            </ul>
          }
        </section>
      </section>
    } @else {
      <div class="not-found">
        <p>Persona no encontrada.</p>
        <a routerLink="/personas">Volver a personas</a>
      </div>
    }
  `,
  styles: `
    .detail-page {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    header {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .back-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
    }

    .profile {
      display: flex;
      gap: 1rem;
      align-items: center;

      h1 {
        margin: 0 0 0.25rem;
        font-size: 1.5rem;
      }
    }

    .meta {
      margin: 0 0 0.5rem;
      color: var(--text-muted);
      font-size: 0.9rem;

      &.subtle {
        margin: 0 0 0.35rem;
        font-size: 0.82rem;
        opacity: 0.9;
      }

      &.rhythm {
        margin: 0 0 0.35rem;
        font-size: 0.78rem;
        font-style: italic;
        opacity: 0.85;
      }

      &.freq {
        margin: 0 0 0.35rem;
        font-size: 0.82rem;
        color: var(--accent-muted);
      }

      &.category {
        margin: 0 0 0.2rem;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.85;
      }

      &.birthday { color: var(--birthday); margin-bottom: 0.35rem; }
      &.pref { color: var(--accent-muted); margin-bottom: 0.35rem; font-size: 0.82rem; }
    }

    .profile-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      margin: 0.15rem 0 0.5rem;

      a {
        font-size: 0.75rem;
        color: var(--accent-muted);
        text-decoration: none;

        &:hover { text-decoration: underline; }
      }
    }

    .repeat-btn {
      display: block;
      width: 100%;
      margin-bottom: 0.85rem;
      padding: 0.55rem 0.85rem;
      border-radius: 0.65rem;
      border: 1px dashed rgba(99, 102, 241, 0.35);
      background: rgba(99, 102, 241, 0.08);
      color: var(--accent-soft);
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      text-align: left;

      &:hover {
        border-color: rgba(99, 102, 241, 0.5);
        background: rgba(99, 102, 241, 0.14);
      }
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1.25rem;

      h2 {
        margin: 0 0 1rem;
        font-size: 1rem;
        font-weight: 600;
      }
    }

    .pinned-card {
      h2 { margin: 0; }
    }

    .pinned-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .pinned-text {
      margin: 0;
      font-size: 0.9rem;
      line-height: 1.5;
      color: var(--text);
      white-space: pre-wrap;
    }

    .pinned-empty {
      padding: 0;
      text-align: left;
      font-size: 0.85rem;
    }

    .birthday-cta {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      border-color: var(--birthday-border);
      background: var(--birthday-bg);

      p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--birthday);
        font-weight: 600;
      }
    }

    .attention-cta {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      border-color: rgba(99, 102, 241, 0.35);
      background: rgba(99, 102, 241, 0.1);

      p {
        margin: 0;
        font-size: 0.88rem;
        color: var(--accent-soft);
        line-height: 1.45;
      }
    }

    .contact-nudge {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;

      p {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-muted);
        line-height: 1.45;
      }
    }

    .contact-card {
      h2 { margin: 0 0 0.75rem; }
    }

    .contact-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .contact-btn {
      padding: 0.45rem 0.75rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(99, 102, 241, 0.12);
      color: var(--accent-soft);
      font-size: 0.78rem;
      text-decoration: none;
      cursor: pointer;
      font: inherit;

      &.primary {
        background: var(--wa-bg);
        border-color: var(--wa-border);
        color: var(--wa);
      }

      &.ghost {
        background: transparent;
        color: var(--text-muted);
      }

      &:hover {
        border-color: rgba(99, 102, 241, 0.45);
        background: rgba(99, 102, 241, 0.2);
      }
    }

    .wa-field {
      margin-bottom: 0.65rem;
    }

    .wa-log-prompt {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-top: 0.65rem;
      padding: 0.6rem 0.75rem;
      border-radius: 0.65rem;
      background: var(--wa-bg);
      border: 1px solid var(--wa-border);
      font-size: 0.8rem;
      color: var(--wa-text);

      button {
        border: none;
        background: transparent;
        color: var(--wa);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
      }
    }

    .contact-meta {
      margin: 0.65rem 0 0;
      font-size: 0.78rem;
      color: var(--text-muted);

      &.link {
        display: inline-block;
        color: var(--accent-muted);
        text-decoration: none;
      }
    }

    .contact-meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-top: 0.65rem;
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .copy-btn {
      border: none;
      background: transparent;
      color: var(--accent-muted);
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      flex-shrink: 0;
    }

    .copy-feedback {
      margin: 0.5rem 0 0;
      font-size: 0.75rem;
      color: var(--success);
    }

    .history-header {
      margin-bottom: 1rem;

      h2 { margin: 0 0 0.75rem; }
    }

    .type-breakdown {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.75rem;
    }

    .type-pill {
      padding: 0.25rem 0.55rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg);
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .history-filters {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .month-filters,
    .type-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .month-chip {
      padding: 0.3rem 0.65rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text-muted);
      font-size: 0.72rem;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s, background 0.2s;

      &.active {
        border-color: rgba(99, 102, 241, 0.5);
        background: rgba(99, 102, 241, 0.15);
        color: var(--accent-soft);
      }
    }

    .note-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin-bottom: 0.85rem;
      font-size: 0.78rem;
      color: var(--text-muted);

      &.compact { margin-bottom: 0.5rem; }

      textarea {
        width: 100%;
        padding: 0.65rem 0.75rem;
        border-radius: 0.65rem;
        border: 1px solid var(--border);
        background: var(--bg);
        color: var(--text);
        font: inherit;
        resize: vertical;
        min-height: 2.5rem;
      }

      .date-input {
        width: 100%;
        padding: 0.55rem 0.75rem;
        border-radius: 0.65rem;
        border: 1px solid var(--border);
        background: var(--bg);
        color: var(--text);
        font: inherit;
        color-scheme: dark;
      }
    }

    .interaction-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 0.75rem;
    }

    .interaction-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      padding: 1rem 0.5rem;
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      background: var(--bg);
      color: var(--text);
      cursor: pointer;
      font-size: 0.82rem;
      transition: border-color 0.2s, background 0.2s;

      &:hover {
        border-color: var(--accent);
        background: rgba(99, 102, 241, 0.08);
      }

      &.suggested {
        border-color: rgba(99, 102, 241, 0.55);
        background: rgba(99, 102, 241, 0.15);
        box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2);
      }

      .icon { font-size: 1.5rem; }
    }

    .history {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      li {
        display: flex;
        gap: 0.75rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border);

        &:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
      }

      .icon { font-size: 1.25rem; flex-shrink: 0; }
    }

    .history-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .date {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .note {
      margin: 0.15rem 0 0;
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .history-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.35rem;
    }

    .link-btn {
      border: none;
      background: transparent;
      padding: 0;
      font-size: 0.75rem;
      color: var(--accent-muted);
      cursor: pointer;
      text-decoration: underline;

      &.danger { color: var(--sync-error-text); }
    }

    .delete-confirm {
      font-size: 0.75rem;
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .btn-primary.small,
    .btn-secondary.small {
      padding: 0.35rem 0.65rem;
      font-size: 0.75rem;
      width: auto;
    }

    .empty, .not-found {
      color: var(--text-muted);
      text-align: center;
      padding: 2rem;
    }

    .feedback {
      margin: 0.75rem 0 0;
      font-size: 0.85rem;
      color: var(--success);
      text-align: center;
    }

    .undo-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-top: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-radius: 0.65rem;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.25);
      font-size: 0.82rem;
      color: var(--accent-soft);

      button {
        border: none;
        background: transparent;
        color: var(--accent-muted);
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
        flex-shrink: 0;
      }
    }
  `,
})
export class PersonDetailComponent {
  private readonly bonds = inject(BondsService);
  private readonly route = inject(ActivatedRoute);

  readonly interactionTypes: InteractionType[] = [
    'mensaje',
    'llamada',
    'visita',
    'salida',
    'videollamada',
  ];
  readonly interactionLabels = INTERACTION_LABELS;
  readonly interactionIcons = INTERACTION_ICONS;
  readonly categoryLabels = CATEGORY_LABELS;
  readonly formatLastContact = formatLastContactLabel;
  readonly formatFrequency = formatFrequencyDeadline;
  readonly formatBirthday = formatBirthdayLabel;
  readonly birthdayCountdown = (birthday: string) =>
    formatBirthdayCountdown(daysUntilBirthday(birthday));
  readonly preferredHint = formatPreferredContactHint;
  readonly attentionMessage = formatAttentionMessage;
  readonly attentionCta = getAttentionCta;
  readonly isPreferredAction = isPreferredInteractionType;
  readonly formatInteractionAge = formatInteractionAge;
  readonly telLink = telHref;
  readonly emailLink = mailtoHref;
  readonly canShareContacts = canShareContacts();
  readonly whatsAppLogPrompt = signal(false);
  readonly copyFeedback = signal<string | null>(null);
  readonly maxDate = toDateInputValue();

  whatsAppDraft = '';
  private whatsAppTimer?: ReturnType<typeof setTimeout>;
  readonly interactionFeedback = signal<string | null>(null);
  readonly undoState = signal<{ id: string; label: string } | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly editingPinned = signal(false);
  readonly historyMonth = signal<'all' | string>('all');
  readonly historyType = signal<'all' | InteractionType>('all');

  pendingNote = '';
  pendingDate = toDateInputValue();
  editNote = '';
  editDate = toDateInputValue();
  pinnedNoteDraft = '';

  private feedbackTimer?: ReturnType<typeof setTimeout>;
  private undoTimer?: ReturnType<typeof setTimeout>;
  private copyTimer?: ReturnType<typeof setTimeout>;

  private readonly personId = this.route.snapshot.paramMap.get('id')!;

  constructor() {
    effect(() => {
      const person = this.person();
      if (person?.phone) {
        this.whatsAppDraft = whatsAppMessageForPerson(person);
      }
    });
  }

  readonly person = computed(() => this.bonds.getPerson(this.personId));
  readonly interactions = computed(() =>
    this.bonds.getInteractionsForPerson(this.personId),
  );
  readonly historyMonths = computed(() => {
    const months = new Set(this.interactions().map((item) => getMonthKey(item.date)));
    return [...months].sort((a, b) => b.localeCompare(a));
  });
  readonly historyTypes = computed(() => {
    const used = new Set(this.interactions().map((item) => item.type));
    return this.interactionTypes.filter((type) => used.has(type));
  });
  readonly filteredInteractions = computed(() => {
    let list = this.interactions();
    const month = this.historyMonth();
    if (month !== 'all') {
      list = list.filter((item) => getMonthKey(item.date) === month);
    }
    const type = this.historyType();
    if (type !== 'all') {
      list = list.filter((item) => item.type === type);
    }
    return list;
  });
  readonly interactionBreakdown = computed(() => {
    const counts = new Map<InteractionType, number>();
    for (const item of this.interactions()) {
      counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    }
    return this.interactionTypes
      .filter((type) => counts.has(type))
      .map((type) => ({ type, count: counts.get(type)! }))
      .sort((a, b) => b.count - a.count);
  });
  readonly averageInterval = computed(() =>
    formatAverageContactInterval(this.interactions()),
  );

  readonly formatMonth = formatMonthLabel;

  historyEmptyMessage(): string {
    if (this.historyType() !== 'all' && this.historyMonth() !== 'all') {
      return 'Sin interacciones con esos filtros.';
    }
    if (this.historyType() !== 'all') {
      return 'Sin interacciones de ese tipo.';
    }
    return 'Sin interacciones en este mes.';
  }

  profileSubtitle(person: PersonWithStatus): string {
    const count = this.interactions().length;
    const freq =
      person.desiredFrequencyDays === 1
        ? 'Cada día'
        : `Cada ${person.desiredFrequencyDays} días`;
    const contacts = count === 1 ? '1 contacto' : `${count} contactos`;
    return `${freq} · ${contacts}`;
  }

  repeatLastInteraction(type: InteractionType): void {
    this.logInteraction(type);
  }

  logInteraction(type: InteractionType): void {
    const note = this.pendingNote.trim();
    const dateIso = dateInputToIso(this.pendingDate);
    const interaction = this.bonds.logInteraction(this.personId, type, dateIso, note);
    this.pendingNote = '';
    this.pendingDate = toDateInputValue();
    this.interactionFeedback.set(
      `${this.interactionLabels[type]} registrado · ${formatInteractionRegisteredLabel(dateIso)}`,
    );
    this.undoState.set({
      id: interaction.id,
      label: `${this.interactionLabels[type]} registrado`,
    });
    clearTimeout(this.feedbackTimer);
    clearTimeout(this.undoTimer);
    this.feedbackTimer = setTimeout(() => this.interactionFeedback.set(null), 2500);
    this.undoTimer = setTimeout(() => this.undoState.set(null), 5000);
  }

  undoInteraction(): void {
    const undo = this.undoState();
    if (!undo) return;
    this.bonds.removeInteraction(undo.id);
    this.undoState.set(null);
    this.interactionFeedback.set('Interacción deshecha');
    clearTimeout(this.feedbackTimer);
    clearTimeout(this.undoTimer);
    this.feedbackTimer = setTimeout(() => this.interactionFeedback.set(null), 2000);
  }

  startEdit(item: Interaction): void {
    this.deletingId.set(null);
    this.editingId.set(item.id);
    this.editNote = item.note ?? '';
    this.editDate = toDateInputValue(item.date);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editNote = '';
    this.editDate = toDateInputValue();
  }

  saveEdit(interactionId: string): void {
    this.bonds.updateInteraction(interactionId, {
      note: this.editNote,
      date: dateInputToIso(this.editDate),
    });
    this.editingId.set(null);
    this.editNote = '';
    this.editDate = toDateInputValue();
    this.interactionFeedback.set('Interacción actualizada');
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.interactionFeedback.set(null), 2000);
  }

  confirmDelete(interactionId: string): void {
    this.bonds.removeInteraction(interactionId);
    this.deletingId.set(null);
    if (this.editingId() === interactionId) {
      this.cancelEdit();
    }
    this.interactionFeedback.set('Interacción eliminada');
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.interactionFeedback.set(null), 2000);
  }

  startPinnedEdit(person: { pinnedNote?: string }): void {
    this.pinnedNoteDraft = person.pinnedNote ?? '';
    this.editingPinned.set(true);
  }

  cancelPinnedEdit(): void {
    this.editingPinned.set(false);
    this.pinnedNoteDraft = '';
  }

  savePinnedNote(): void {
    this.bonds.updatePerson(this.personId, { pinnedNote: this.pinnedNoteDraft });
    this.editingPinned.set(false);
    this.pinnedNoteDraft = '';
    this.interactionFeedback.set('Nota guardada');
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.interactionFeedback.set(null), 2000);
  }

  copyText(text: string, label: string): void {
    void navigator.clipboard.writeText(text).then(
      () => {
        this.copyFeedback.set(`${label} copiado`);
        clearTimeout(this.copyTimer);
        this.copyTimer = setTimeout(() => this.copyFeedback.set(null), 2000);
      },
      () => {
        this.copyFeedback.set('No se pudo copiar');
        clearTimeout(this.copyTimer);
        this.copyTimer = setTimeout(() => this.copyFeedback.set(null), 2000);
      },
    );
  }

  async shareContact(person: PersonWithStatus): Promise<void> {
    const payload = buildContactSharePayload(person);
    if (!payload) return;
    try {
      await navigator.share(payload);
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;
      this.copyFeedback.set('No se pudo compartir');
      clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.copyFeedback.set(null), 2000);
    }
  }

  openWhatsApp(person: { phone?: string }): void {
    if (!person.phone) return;
    window.open(whatsAppHref(person.phone, this.whatsAppDraft), '_blank', 'noopener,noreferrer');
    this.whatsAppLogPrompt.set(true);
    clearTimeout(this.whatsAppTimer);
    this.whatsAppTimer = setTimeout(() => this.whatsAppLogPrompt.set(false), 30_000);
  }

  resetWhatsAppDraft(person: Parameters<typeof whatsAppMessageForPerson>[0]): void {
    this.whatsAppDraft = whatsAppMessageForPerson(person);
  }

  logWhatsAppContact(): void {
    this.whatsAppLogPrompt.set(false);
    clearTimeout(this.whatsAppTimer);
    const dateIso = dateInputToIso(this.pendingDate);
    const interaction = this.bonds.logInteraction(this.personId, 'mensaje', dateIso, 'WhatsApp');
    this.interactionFeedback.set(
      `Mensaje registrado · ${formatInteractionRegisteredLabel(dateIso)}`,
    );
    this.undoState.set({ id: interaction.id, label: 'Mensaje registrado' });
    clearTimeout(this.feedbackTimer);
    clearTimeout(this.undoTimer);
    this.feedbackTimer = setTimeout(() => this.interactionFeedback.set(null), 2500);
    this.undoTimer = setTimeout(() => this.undoState.set(null), 5000);
  }

  showBirthdayCta(person: { birthday?: string; phone?: string }): boolean {
    if (!person.birthday || !person.phone) return false;
    return isBirthdayImminent(daysUntilBirthday(person.birthday));
  }

  birthdayCta(person: { birthday?: string; name: string }): string {
    return birthdayCtaText(daysUntilBirthday(person.birthday!), person.name);
  }
}
