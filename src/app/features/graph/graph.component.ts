import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';
import { BondsService } from '../../core/services/bonds.service';
import { ThemeService } from '../../core/services/theme.service';
import {
  INTERACTION_ICONS,
  INTERACTION_LABELS,
  InteractionType,
  PersonWithStatus,
  dateInputToIso,
  daysUntilBirthday,
  formatAttentionCount,
  formatBirthdayCountdown,
  formatBirthdayLabel,
  formatDaysShort,
  formatDaysSinceContact,
  formatFrequencyDeadline,
  formatInteractionRegisteredLabel,
  formatLastInteractionSummary,
  formatPreferredContactHint,
  formatAttentionMessage,
  getAttentionCta,
  buildContactSharePayload,
  canShareContacts,
  birthdayCtaText,
  isBirthdayImminent,
  isPreferredInteractionType,
  suggestsWhatsApp,
  toDateInputValue,
  telHref,
  mailtoHref,
  whatsAppHref,
  whatsAppMessageForPerson,
} from '../../core/models/person.model';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { PersonAvatarComponent } from '../../shared/person-avatar/person-avatar.component';

interface GraphNode {
  id: string;
  isSelf: boolean;
  person?: PersonWithStatus;
  x: number;
  y: number;
  radius: number;
  angle: number;
  distance: number;
}

interface GraphLink {
  source: GraphNode;
  target: GraphNode;
  strength: number;
}

interface GraphThemeColors {
  zoneStroke: string;
  zoneLabel: string;
  selectedStroke: string;
  selfStroke: string;
  selfLabel: string;
  dimLabel: string;
  brightLabel: string;
  nodeDim: string;
  gradientStart: string;
  gradientEnd: string;
}

@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent, PersonAvatarComponent],
  template: `
    <section class="graph-page">
      @if (people().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">◉</div>
          <h1>Tu red</h1>
          <p>Tu mundo social está vacío.</p>
          <p class="hint">
            Agregá a alguien importante para empezar a visualizar quién está
            cerca y quién necesita atención.
          </p>
          <div class="empty-actions">
            <a routerLink="/bienvenida" class="btn-primary">Empezar</a>
          </div>
        </div>
      } @else {
        <div class="canvas" #graphContainer>
          <svg #graphSvg></svg>

          <header class="overlay-header">
            <div class="header-text">
              <span class="eyebrow">Tu red</span>
              <span class="stats">{{ headerStats() }}</span>
            </div>
            @if (showGraphSearch()) {
              <div class="graph-search-wrap">
                <input
                  type="search"
                  class="graph-search"
                  placeholder="Buscar persona…"
                  [value]="graphSearch()"
                  (input)="graphSearch.set($any($event.target).value)"
                  aria-label="Buscar en el grafo"
                />
                @if (graphSearch().trim() && graphSearchResults().length > 0) {
                  <ul class="graph-search-results">
                    @for (person of graphSearchResults(); track person.id) {
                      <li>
                        <button type="button" (click)="focusFromSearch(person.id)">
                          {{ person.name }}
                        </button>
                      </li>
                    }
                  </ul>
                } @else if (graphSearch().trim()) {
                  <p class="graph-search-empty">Sin coincidencias</p>
                }
              </div>
            }
          </header>

          @if (needsAttention().length > 0) {
            <div
              class="attention-rail"
              [class.with-birthdays]="imminentBirthdays().length > 0"
              aria-label="Personas que necesitan atención"
            >
              @for (person of needsAttention().slice(0, 5); track person.id) {
                <button
                  type="button"
                  class="attention-chip"
                  [class]="person.status"
                  (click)="focusPerson(person.id)"
                >
                  {{ person.name }}
                </button>
              }
            </div>
          }

          @if (imminentBirthdays().length > 0) {
            <div class="birthday-rail" aria-label="Cumpleaños hoy o mañana">
              @for (entry of imminentBirthdays(); track entry.person.id) {
                <button
                  type="button"
                  class="birthday-chip"
                  [class.imminent]="entry.daysUntil <= 0"
                  (click)="focusPerson(entry.person.id)"
                >
                  🎂 {{ entry.person.name.split(' ')[0] }} · {{ formatBirthdayCountdown(entry.daysUntil) }}
                </button>
              }
            </div>
          }

          <div class="zoom-controls" aria-label="Controles de zoom">
            <button type="button" (click)="zoomIn()" aria-label="Acercar">+</button>
            <button type="button" (click)="zoomOut()" aria-label="Alejar">−</button>
            <button type="button" (click)="resetZoom()" aria-label="Centrar red">◎</button>
          </div>

          @if (selected(); as person) {
            <button
              type="button"
              class="sheet-backdrop"
              aria-label="Cerrar detalle"
              (click)="clearSelection()"
            ></button>
            <div
              class="detail-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Detalle de persona"
              (touchstart)="onSheetTouchStart($event)"
              (touchend)="onSheetTouchEnd($event)"
            >
              <div class="sheet-grabber" aria-hidden="true"></div>
              <button
                type="button"
                class="sheet-close"
                (click)="clearSelection()"
                aria-label="Cerrar"
              >
                ×
              </button>
              <div class="sheet-profile">
                <app-person-avatar
                  [name]="person.name"
                  [photo]="person.photo"
                  [size]="56"
                />
                <div>
                  <strong>{{ person.name }}</strong>
                  <span class="sheet-meta">{{
                    formatContactDays(person.daysSinceContact)
                  }}</span>
                  <span class="sheet-freq">{{
                    formatFrequency(person.daysSinceContact, person.desiredFrequencyDays)
                  }}</span>
                  <app-status-badge
                    [status]="person.status"
                    [label]="person.statusLabel"
                  />
                  @if (person.preferredContact) {
                    <span class="sheet-pref">{{ preferredHint(person.preferredContact) }}</span>
                  }
                </div>
              </div>
              @if (showBirthdayCta(person)) {
                <div class="sheet-cta birthday">
                  <p>{{ birthdayCta(person) }}</p>
                  <button type="button" class="sheet-cta-btn" (click)="openWhatsApp(person)">
                    🎂 Felicitá por WhatsApp
                  </button>
                </div>
              }
              @if (attentionCta(person); as cta) {
                <div class="sheet-cta attention">
                  <p>{{ attentionMessage(person) }}</p>
                  @switch (cta.kind) {
                    @case ('whatsapp') {
                      <button type="button" class="sheet-cta-btn" (click)="openWhatsApp(person)">
                        {{ cta.label }}
                      </button>
                    }
                    @case ('call') {
                      <a [href]="telLink(person.phone!)" class="sheet-cta-btn link">{{ cta.label }}</a>
                    }
                    @case ('log') {
                      <button
                        type="button"
                        class="sheet-cta-btn"
                        (click)="logQuick(person.id, cta.logType!)"
                      >
                        {{ cta.label }}
                      </button>
                    }
                  }
                </div>
              }
              @if (person.birthday) {
                <p class="sheet-birthday">
                  🎂 {{ formatBirthday(person.birthday) }} · {{ birthdayCountdown(person.birthday) }}
                </p>
              }
              @if (person.pinnedNote) {
                <p class="sheet-pinned">📌 {{ person.pinnedNote }}</p>
              }
              @if (person.lastInteraction; as last) {
                <p class="sheet-last">
                  Último contacto: {{ formatLastInteraction(last.type, last.date) }}
                </p>
              }
              @if (person.phone || person.email) {
                <div class="sheet-contact">
                  @if (person.phone) {
                    <a
                      [href]="telLink(person.phone)"
                      class="sheet-contact-btn"
                      [class.preferred]="person.preferredContact === 'llamada'"
                    >
                      📞
                    </a>
                    <button
                      type="button"
                      class="sheet-contact-btn wa"
                      [class.preferred]="suggestsWhatsApp(person)"
                      (click)="openWhatsApp(person)"
                      title="Abrir WhatsApp con mensaje sugerido"
                    >
                      WA
                    </button>
                  }
                  @if (person.email) {
                    <a [href]="emailLink(person.email)" class="sheet-contact-btn">✉️</a>
                  }
                  @if (canShareContacts) {
                    <button
                      type="button"
                      class="sheet-contact-btn"
                      (click)="shareContact(person)"
                      title="Compartir teléfono o email"
                    >
                      ↗
                    </button>
                  }
                </div>
                @if (person.phone) {
                  <div class="sheet-contact-meta">
                    <span>{{ person.phone }}</span>
                    <button type="button" class="sheet-copy" (click)="copyText(person.phone!, 'Teléfono')">
                      Copiar
                    </button>
                  </div>
                }
                @if (person.email) {
                  <div class="sheet-contact-meta">
                    <span>{{ person.email }}</span>
                    <button type="button" class="sheet-copy" (click)="copyText(person.email!, 'Email')">
                      Copiar
                    </button>
                  </div>
                }
                @if (copyFeedback(); as feedback) {
                  <p class="sheet-copy-feedback">{{ feedback }}</p>
                }
              }
              @if (quickFeedback()) {
                <p class="sheet-feedback">{{ quickFeedback() }}</p>
              }
              @if (undoState(); as undo) {
                <div class="sheet-undo">
                  <span>{{ undo.label }}</span>
                  <button type="button" (click)="undoQuick()">Deshacer</button>
                </div>
              }
              @if (whatsAppPrompt()) {
                <div class="sheet-undo wa-prompt">
                  <span>¿Le escribiste?</span>
                  <button type="button" (click)="logWhatsAppContact()">Registrar mensaje</button>
                </div>
              }
              @if (person.lastInteraction; as last) {
                <button type="button" class="sheet-repeat" (click)="logQuick(person.id, last.type)">
                  ↻ Repetir {{ interactionLabels[last.type] }}
                </button>
              }
              <label class="sheet-date">
                Fecha
                <input type="date" [(ngModel)]="quickDate" [max]="maxDate" />
              </label>
              @if (showQuickNote()) {
                <label class="sheet-note">
                  <textarea
                    [(ngModel)]="quickNote"
                    rows="2"
                    maxlength="200"
                    placeholder="Nota opcional…"
                  ></textarea>
                </label>
              } @else {
                <button type="button" class="sheet-note-toggle" (click)="showQuickNote.set(true)">
                  + Agregar nota
                </button>
              }
              <div class="quick-actions">
                @for (type of quickTypes; track type) {
                  <button
                    type="button"
                    class="quick-btn"
                    [class.preferred]="isPreferredAction(person, type)"
                    (click)="logQuick(person.id, type)"
                  >
                    <span>{{ interactionIcons[type] }}</span>
                    {{ interactionLabels[type] }}
                  </button>
                }
              </div>
              <div class="sheet-links">
                <a [routerLink]="['/personas', person.id]" class="sheet-link">Ver perfil →</a>
                <a [routerLink]="['/personas', person.id, 'editar']" class="sheet-link secondary">Editar</a>
              </div>
            </div>
          } @else {
            <p class="canvas-hint">
              @if (needsAttention().length === 0) {
                🌿 Tu red está al día — tocá alguien para ver detalles
              } @else {
                Tocá una persona para conectar · Arrastrá para explorar
              }
            </p>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .graph-page {
      margin: calc(-1 * var(--page-top)) calc(-1 * var(--page-gutter)) calc(-1 * var(--page-bottom));
      height: calc(100dvh - var(--bottom-nav-total));
      min-height: 420px;
      display: flex;
      flex-direction: column;
    }

    .canvas {
      position: relative;
      flex: 1;
      overflow: hidden;
      background:
        radial-gradient(
          ellipse 80% 60% at 50% 45%,
          var(--graph-glow) 0%,
          transparent 65%
        ),
        radial-gradient(
          circle at 50% 50%,
          transparent 0%,
          var(--bg) 100%
        );
      touch-action: none;
    }

    svg {
      width: 100%;
      height: 100%;
      display: block;
      cursor: grab;

      &:active {
        cursor: grabbing;
      }
    }

    .overlay-header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      padding: calc(0.85rem + var(--sat)) var(--page-gutter) 0.85rem;
      background: linear-gradient(
        180deg,
        var(--graph-overlay) 0%,
        transparent 100%
      );
      pointer-events: none;
    }

    .header-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .eyebrow {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .stats {
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .graph-search-wrap {
      position: relative;
      margin-top: 0.65rem;
    }

    .graph-search {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border-radius: 0.65rem;
      border: 1px solid var(--border);
      background: var(--graph-chip-bg);
      color: var(--text);
      font: inherit;
      font-size: 0.82rem;
    }

    .graph-search-results {
      list-style: none;
      margin: 0.35rem 0 0;
      padding: 0.25rem;
      border-radius: 0.65rem;
      border: 1px solid var(--border);
      background: var(--graph-sheet-bg);
      max-height: 9rem;
      overflow-y: auto;

      li button {
        display: block;
        width: 100%;
        padding: 0.45rem 0.55rem;
        border: none;
        border-radius: 0.45rem;
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: 0.82rem;
        text-align: left;
        cursor: pointer;

        &:hover {
          background: rgba(99, 102, 241, 0.12);
        }
      }
    }

    .graph-search-empty {
      margin: 0.35rem 0 0;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .attention-rail {
      position: absolute;
      top: calc(4.5rem + var(--sat));
      left: 0;
      right: 0;
      display: flex;
      gap: 0.5rem;
      padding: 0 1rem;
      overflow-x: auto;
      scrollbar-width: none;
      mask-image: linear-gradient(
        90deg,
        transparent,
        black 1rem,
        black calc(100% - 1rem),
        transparent
      );

      &.with-birthdays {
        top: calc(3.85rem + var(--sat));
      }

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .birthday-rail {
      position: absolute;
      top: calc(5.65rem + var(--sat));
      left: 0;
      right: 0;
      display: flex;
      gap: 0.5rem;
      padding: 0 1rem;
      overflow-x: auto;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .birthday-chip {
      flex-shrink: 0;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      border: 1px solid var(--birthday-border);
      background: var(--birthday-bg);
      backdrop-filter: blur(8px);
      color: var(--birthday);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;

      &.imminent {
        border-color: var(--birthday);
      }
    }

    .attention-chip {
      flex-shrink: 0;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--graph-chip-bg);
      backdrop-filter: blur(8px);
      color: var(--text);
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      transition:
        transform 0.15s,
        border-color 0.2s;

      &:hover {
        transform: translateY(-1px);
      }

      &.soon {
        border-color: color-mix(in srgb, var(--status-soon-dot) 45%, transparent);
        color: var(--status-soon-text);
      }
      &.reconnect {
        border-color: color-mix(in srgb, var(--status-reconnect-dot) 45%, transparent);
        color: var(--status-reconnect-text);
      }
      &.attention {
        border-color: color-mix(in srgb, var(--status-attention-dot) 45%, transparent);
        color: var(--status-attention-text);
      }
    }

    .zoom-controls {
      position: absolute;
      right: 0.75rem;
      bottom: 5.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      z-index: 9;

      button {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 0.65rem;
        border: 1px solid var(--border);
        background: var(--graph-controls-bg);
        color: var(--text-muted);
        font-size: 1rem;
        line-height: 1;
        cursor: pointer;
        backdrop-filter: blur(8px);

        &:hover {
          color: var(--text);
          border-color: rgba(99, 102, 241, 0.45);
        }
      }
    }

    .canvas-hint {
      position: absolute;
      bottom: 0.75rem;
      left: 0;
      right: 0;
      margin: 0;
      text-align: center;
      font-size: 0.72rem;
      color: var(--text-muted);
      opacity: 0.7;
      pointer-events: none;
    }

    .sheet-backdrop {
      position: absolute;
      inset: 0;
      border: none;
      padding: 0;
      background: var(--graph-backdrop);
      cursor: pointer;
      z-index: 10;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .detail-sheet {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 11;
      padding: 0.5rem var(--page-gutter) calc(1rem + var(--sab));
      background: var(--graph-sheet-bg);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--border);
      border-radius: 1.25rem 1.25rem 0 0;
      animation: slideUp 0.25s ease-out;
    }

    .sheet-grabber {
      width: 2.5rem;
      height: 0.25rem;
      margin: 0.25rem auto 0.75rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.2);
    }

    @keyframes slideUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .sheet-close {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      width: 2rem;
      height: 2rem;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
    }

    .sheet-profile {
      display: flex;
      gap: 0.85rem;
      align-items: center;
      margin-bottom: 0.85rem;

      strong {
        display: block;
        font-size: 1.05rem;
        margin-bottom: 0.15rem;
      }
    }

    .sheet-meta {
      display: block;
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-bottom: 0.15rem;
    }

    .sheet-freq {
      display: block;
      font-size: 0.75rem;
      color: var(--accent-muted);
      margin-bottom: 0.35rem;
    }

    .sheet-pref {
      display: block;
      margin-top: 0.35rem;
      font-size: 0.72rem;
      color: var(--accent-muted);
    }

    .sheet-birthday {
      margin: 0 0 0.5rem;
      font-size: 0.78rem;
      color: var(--birthday);
    }

    .sheet-cta {
      margin-bottom: 0.65rem;
      padding: 0.65rem 0.75rem;
      border-radius: 0.65rem;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      p { margin: 0; font-size: 0.82rem; line-height: 1.4; }
      &.birthday {
        border: 1px solid var(--birthday-border);
        background: var(--birthday-bg);
        p { color: var(--birthday); font-weight: 600; }
      }
      &.attention {
        border: 1px solid rgba(99, 102, 241, 0.35);
        background: rgba(99, 102, 241, 0.1);
        p { color: var(--accent-soft); }
      }
    }

    .sheet-cta-btn {
      padding: 0.5rem 0.85rem;
      border-radius: 999px;
      border: 1px solid var(--wa-border);
      background: var(--wa-bg);
      color: var(--wa);
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
    }

    .sheet-cta.attention .sheet-cta-btn {
      border-color: rgba(99, 102, 241, 0.45);
      background: rgba(99, 102, 241, 0.15);
      color: var(--accent-muted);
    }

    .sheet-pinned {
      margin: 0 0 0.65rem;
      padding: 0.55rem 0.65rem;
      border-radius: 0.55rem;
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.2);
      font-size: 0.78rem;
      color: var(--accent-soft);
      line-height: 1.4;
    }

    .sheet-last {
      margin: 0 0 0.65rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .sheet-contact {
      display: flex;
      gap: 0.4rem;
      margin-bottom: 0.35rem;
    }

    .sheet-contact-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .sheet-copy {
      border: none;
      background: transparent;
      color: var(--accent-muted);
      font-size: 0.68rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }

    .sheet-copy-feedback {
      margin: 0 0 0.5rem;
      font-size: 0.72rem;
      color: var(--success);
    }

    .sheet-contact-btn {
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--accent-soft);
      font-size: 0.72rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      font: inherit;

      &.wa {
        color: var(--wa);
        border-color: var(--wa-border);
      }

      &.preferred {
        border-color: rgba(99, 102, 241, 0.55);
        background: rgba(99, 102, 241, 0.15);
      }

      &.wa.preferred {
        border-color: var(--wa);
        background: var(--wa-bg);
      }
    }

    .sheet-feedback {
      margin: 0 0 0.65rem;
      font-size: 0.82rem;
      color: var(--success);
      text-align: center;
    }

    .sheet-undo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin: 0 0 0.65rem;
      padding: 0.55rem 0.75rem;
      border-radius: 0.6rem;
      background: rgba(99, 102, 241, 0.15);
      font-size: 0.78rem;
      color: var(--accent-soft);

      &.wa-prompt {
        background: var(--wa-bg);
        border: 1px solid var(--wa-border);
        color: var(--wa-text);

        button { color: var(--wa); }
      }

      button {
        border: none;
        background: transparent;
        color: var(--accent-muted);
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
      }
    }

    .sheet-note-toggle {
      display: block;
      width: 100%;
      margin: 0 0 0.5rem;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--accent-muted);
      font-size: 0.78rem;
      text-align: left;
      cursor: pointer;
      text-decoration: underline;
    }

    .sheet-date {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0 0 0.5rem;
      font-size: 0.72rem;
      color: var(--text-muted);

      input {
        width: 100%;
        padding: 0.45rem 0.55rem;
        border-radius: 0.55rem;
        border: 1px solid var(--border);
        background: var(--bg);
        color: var(--text);
        font: inherit;
        font-size: 0.78rem;
        color-scheme: dark;
      }
    }

    .sheet-note {
      display: block;
      margin: 0 0 0.5rem;

      textarea {
        width: 100%;
        padding: 0.55rem 0.65rem;
        border-radius: 0.55rem;
        border: 1px solid var(--border);
        background: var(--bg);
        color: var(--text);
        font: inherit;
        font-size: 0.78rem;
        resize: none;
      }
    }

    .quick-actions {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.4rem;
      margin-bottom: 0.75rem;
    }

    .quick-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      padding: 0.5rem 0.25rem;
      border: 1px solid var(--border);
      border-radius: 0.65rem;
      background: var(--bg);
      color: var(--text-muted);
      font-size: 0.62rem;
      cursor: pointer;
      transition:
        border-color 0.2s,
        color 0.2s;

      span {
        font-size: 1.1rem;
      }

      &:hover {
        border-color: rgba(99, 102, 241, 0.5);
        color: var(--text);
      }

      &.preferred {
        border-color: rgba(99, 102, 241, 0.55);
        background: rgba(99, 102, 241, 0.15);
        color: var(--accent-soft);
      }
    }

    .sheet-repeat {
      display: block;
      width: 100%;
      margin-bottom: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.55rem;
      border: 1px dashed rgba(99, 102, 241, 0.35);
      background: rgba(99, 102, 241, 0.08);
      color: var(--accent-soft);
      font-size: 0.78rem;
      cursor: pointer;
      text-align: left;

      &:hover {
        border-color: rgba(99, 102, 241, 0.5);
        background: rgba(99, 102, 241, 0.14);
      }
    }

    .sheet-links {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-top: 0.35rem;
    }

    .sheet-link {
      display: inline-block;
      text-align: center;
      font-size: 0.82rem;
      color: var(--accent-muted);
      text-decoration: none;

      &.secondary {
        color: var(--text-muted);
      }

      &:hover {
        text-decoration: underline;
      }
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: calc(2rem + var(--sat)) 1.5rem 2rem;
      gap: 0.5rem;

      h1 {
        margin: 0.5rem 0 0;
        font-size: 1.5rem;
      }

      p {
        margin: 0;
        color: var(--text-muted);
      }

      .hint {
        font-size: 0.9rem;
        max-width: 280px;
        line-height: 1.5;
      }
    }

    .empty-icon {
      font-size: 3rem;
      opacity: 0.4;
      color: var(--accent);
    }

    .empty-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1.25rem;
      width: 100%;
      max-width: 240px;
    }

    @media (min-width: 768px) {
      .graph-page {
        height: calc(100dvh - var(--bottom-nav-total));
      }

      .quick-actions {
        max-width: 360px;
        margin-left: auto;
        margin-right: auto;
      }
    }
  `,
})
export class GraphComponent implements AfterViewInit, OnDestroy {
  @ViewChild('graphSvg') svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('graphContainer') containerRef!: ElementRef<HTMLDivElement>;

  private readonly bonds = inject(BondsService);
  private readonly theme = inject(ThemeService);
  private readonly route = inject(ActivatedRoute);
  private resizeObserver?: ResizeObserver;
  private viewReady = false;
  private graphColors: GraphThemeColors = {
    zoneStroke: 'rgba(255,255,255,0.08)',
    zoneLabel: 'rgba(148,163,184,0.35)',
    selectedStroke: '#a5b4fc',
    selfStroke: '#c7d2fe',
    selfLabel: '#e0e7ff',
    dimLabel: '#64748b',
    brightLabel: '#cbd5e1',
    nodeDim: '#475569',
    gradientStart: '#818cf8',
    gradientEnd: '#6366f1',
  };
  private zoomBehavior?: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private zoomLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private nodePositions = new Map<string, { x: number; y: number }>();

  readonly people = this.bonds.peopleWithStatus;
  readonly needsAttention = this.bonds.needsAttention;
  readonly upcomingBirthdays = this.bonds.upcomingBirthdays;
  readonly imminentBirthdays = computed(() =>
    this.upcomingBirthdays().filter((entry) => entry.daysUntil <= 1),
  );
  readonly needsCount = computed(() => this.needsAttention().length);
  readonly graphSearch = signal('');
  readonly showGraphSearch = computed(() => this.people().length > 6);
  readonly graphSearchResults = computed(() => {
    const query = this.graphSearch().trim().toLowerCase();
    if (!query) return [];
    return this.people()
      .filter((person) => person.name.toLowerCase().includes(query))
      .slice(0, 6);
  });
  readonly attentionLabel = computed(() => formatAttentionCount(this.needsCount()));
  readonly headerStats = computed(() => {
    const parts = [`${this.people().length} personas`, this.attentionLabel()];
    const birthdays = this.imminentBirthdays().length;
    if (birthdays > 0) {
      parts.push(birthdays === 1 ? '1 cumple' : `${birthdays} cumples`);
    }
    return parts.join(' · ');
  });
  readonly selected = signal<PersonWithStatus | null>(null);
  readonly quickFeedback = signal<string | null>(null);
  readonly copyFeedback = signal<string | null>(null);
  readonly canShareContacts = canShareContacts();
  readonly undoState = signal<{ id: string; label: string } | null>(null);
  readonly whatsAppPrompt = signal(false);
  readonly showQuickNote = signal(false);
  readonly maxDate = toDateInputValue();

  quickNote = '';
  quickDate = toDateInputValue();

  private feedbackTimer?: ReturnType<typeof setTimeout>;
  private undoTimer?: ReturnType<typeof setTimeout>;
  private whatsAppTimer?: ReturnType<typeof setTimeout>;
  private copyTimer?: ReturnType<typeof setTimeout>;
  private sheetTouchStartY = 0;

  readonly quickTypes: InteractionType[] = [
    'mensaje',
    'llamada',
    'visita',
    'salida',
    'videollamada',
  ];
  readonly interactionLabels = INTERACTION_LABELS;
  readonly interactionIcons = INTERACTION_ICONS;
  readonly formatContactDays = formatDaysSinceContact;
  readonly formatFrequency = formatFrequencyDeadline;
  readonly formatBirthday = formatBirthdayLabel;
  readonly birthdayCountdown = (birthday: string) =>
    formatBirthdayCountdown(daysUntilBirthday(birthday));
  readonly formatBirthdayCountdown = formatBirthdayCountdown;
  readonly formatLastInteraction = formatLastInteractionSummary;
  readonly telLink = telHref;
  readonly emailLink = mailtoHref;

  readonly preferredHint = formatPreferredContactHint;
  readonly suggestsWhatsApp = suggestsWhatsApp;
  readonly attentionMessage = formatAttentionMessage;
  readonly attentionCta = getAttentionCta;

  isPreferredAction(person: PersonWithStatus, type: InteractionType): boolean {
    return isPreferredInteractionType(person.preferredContact, type);
  }

  showBirthdayCta(person: PersonWithStatus): boolean {
    return (
      !!person.birthday &&
      !!person.phone &&
      isBirthdayImminent(daysUntilBirthday(person.birthday))
    );
  }

  birthdayCta(person: PersonWithStatus): string {
    return birthdayCtaText(daysUntilBirthday(person.birthday!), person.name);
  }

  constructor() {
    effect(() => {
      this.people();
      this.theme.resolvedTheme();
      if (this.viewReady) {
        this.renderGraph();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderGraph();
    this.resizeObserver = new ResizeObserver(() => this.renderGraph());
    this.resizeObserver.observe(this.containerRef.nativeElement);
    this.focusFromQuery(this.route.snapshot.queryParamMap.get('person'));
    this.route.queryParamMap.subscribe((params) => {
      this.focusFromQuery(params.get('person'));
    });
  }

  private focusFromQuery(personId: string | null): void {
    if (!personId || !this.people().some((person) => person.id === personId)) return;
    setTimeout(() => this.focusPerson(personId), 80);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.selected()) this.clearSelection();
  }

  clearSelection(): void {
    this.selected.set(null);
    this.resetQuickNote();
    this.whatsAppPrompt.set(false);
    this.copyFeedback.set(null);
    clearTimeout(this.feedbackTimer);
    clearTimeout(this.undoTimer);
    clearTimeout(this.whatsAppTimer);
    clearTimeout(this.copyTimer);
    this.highlightNode(null);
  }

  onSheetTouchStart(event: TouchEvent): void {
    this.sheetTouchStartY = event.touches[0]?.clientY ?? 0;
  }

  onSheetTouchEnd(event: TouchEvent): void {
    const endY = event.changedTouches[0]?.clientY ?? 0;
    if (endY - this.sheetTouchStartY > 72) {
      this.clearSelection();
    }
  }

  focusPerson(id: string): void {
    const person = this.people().find((p) => p.id === id);
    if (!person) return;
    this.resetQuickNote();
    this.selected.set(person);
    this.highlightNode(id);
    this.panToNode(id);
  }

  focusFromSearch(id: string): void {
    this.graphSearch.set('');
    this.focusPerson(id);
  }

  logQuick(personId: string, type: InteractionType): void {
    const note = this.quickNote.trim();
    const dateIso = dateInputToIso(this.quickDate);
    const interaction = this.bonds.logInteraction(personId, type, dateIso, note);
    this.selected.set(this.bonds.getPerson(personId) ?? null);
    this.quickNote = '';
    this.quickDate = toDateInputValue();
    this.showQuickNote.set(false);
    this.quickFeedback.set(
      `${this.interactionLabels[type]} · ${formatInteractionRegisteredLabel(dateIso)}`,
    );
    this.undoState.set({
      id: interaction.id,
      label: `${this.interactionLabels[type]} registrado`,
    });
    clearTimeout(this.feedbackTimer);
    clearTimeout(this.undoTimer);
    this.feedbackTimer = setTimeout(() => this.quickFeedback.set(null), 2500);
    this.undoTimer = setTimeout(() => this.undoState.set(null), 5000);
  }

  undoQuick(): void {
    const undo = this.undoState();
    if (!undo) return;
    this.bonds.removeInteraction(undo.id);
    const personId = this.selected()?.id;
    if (personId) {
      this.selected.set(this.bonds.getPerson(personId) ?? null);
    }
    this.undoState.set(null);
    this.quickFeedback.set('Interacción deshecha');
    clearTimeout(this.feedbackTimer);
    clearTimeout(this.undoTimer);
    this.feedbackTimer = setTimeout(() => this.quickFeedback.set(null), 2000);
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

  openWhatsApp(person: PersonWithStatus): void {
    if (!person.phone) return;
    const message = whatsAppMessageForPerson(person);
    window.open(whatsAppHref(person.phone, message), '_blank', 'noopener,noreferrer');
    this.whatsAppPrompt.set(true);
    clearTimeout(this.whatsAppTimer);
    this.whatsAppTimer = setTimeout(() => this.whatsAppPrompt.set(false), 30_000);
  }

  logWhatsAppContact(): void {
    const personId = this.selected()?.id;
    if (!personId) return;
    this.whatsAppPrompt.set(false);
    clearTimeout(this.whatsAppTimer);
    const dateIso = dateInputToIso(this.quickDate);
    const interaction = this.bonds.logInteraction(personId, 'mensaje', dateIso, 'WhatsApp');
    this.selected.set(this.bonds.getPerson(personId) ?? null);
    this.quickFeedback.set(`Mensaje · ${formatInteractionRegisteredLabel(dateIso)}`);
    this.undoState.set({ id: interaction.id, label: 'Mensaje registrado' });
    clearTimeout(this.feedbackTimer);
    clearTimeout(this.undoTimer);
    this.feedbackTimer = setTimeout(() => this.quickFeedback.set(null), 2500);
    this.undoTimer = setTimeout(() => this.undoState.set(null), 5000);
  }

  private resetQuickNote(): void {
    this.showQuickNote.set(false);
    this.quickNote = '';
    this.quickDate = toDateInputValue();
    this.quickFeedback.set(null);
    this.undoState.set(null);
    this.whatsAppPrompt.set(false);
    clearTimeout(this.whatsAppTimer);
  }

  zoomIn(): void {
    if (!this.svgRef || !this.zoomBehavior) return;
    d3.select(this.svgRef.nativeElement)
      .transition()
      .duration(200)
      .call(this.zoomBehavior.scaleBy, 1.25);
  }

  zoomOut(): void {
    if (!this.svgRef || !this.zoomBehavior) return;
    d3.select(this.svgRef.nativeElement)
      .transition()
      .duration(200)
      .call(this.zoomBehavior.scaleBy, 0.8);
  }

  resetZoom(): void {
    if (!this.svgRef || !this.zoomBehavior) return;
    d3.select(this.svgRef.nativeElement)
      .transition()
      .duration(250)
      .call(this.zoomBehavior.transform, d3.zoomIdentity);
  }

  private renderGraph(): void {
    const people = this.people();
    if (!this.svgRef || people.length === 0) return;

    const container = this.containerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.graphColors = this.readGraphColors();
    const svg = d3.select(this.svgRef.nativeElement);
    const savedTransform =
      this.zoomBehavior && this.svgRef.nativeElement
        ? d3.zoomTransform(this.svgRef.nativeElement)
        : d3.zoomIdentity;
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const centerX = width / 2;
    const centerY = height / 2;
    const maxOrbit = Math.min(width, height) * 0.38;

    const nodes = this.buildNodes(people, centerX, centerY, maxOrbit);
    const links: GraphLink[] = people.map((p) => {
      const target = nodes.find((n) => n.id === p.id)!;
      return {
        source: nodes[0],
        target,
        strength: this.linkStrength(p),
      };
    });

    const defs = svg.append('defs');

    defs
      .append('radialGradient')
      .attr('id', 'self-glow')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%')
      .selectAll('stop')
      .data([
        { offset: '0%', color: this.graphColors.gradientStart },
        { offset: '100%', color: this.graphColors.gradientEnd },
      ])
      .join('stop')
      .attr('offset', (d) => d.offset)
      .attr('stop-color', (d) => d.color);

    const filter = defs
      .append('filter')
      .attr('id', 'node-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter
      .append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'blur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    nodes.forEach((node) => {
      if (!node.isSelf && node.person?.photo) {
        defs
          .append('clipPath')
          .attr('id', `clip-${node.id}`)
          .append('circle')
          .attr('r', node.radius - 3);
      }
    });

    const g = svg.append('g').attr('class', 'zoom-layer');

    this.zoomLayer = g;
    this.zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 2.5])
      .filter((event) => {
        if (event.type === 'wheel') return true;
        const target = event.target as Element | null;
        if (target?.closest?.('g.node')) return false;
        return !event.ctrlKey && !event.button;
      })
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(this.zoomBehavior);
    if (savedTransform.k !== 1 || savedTransform.x !== 0 || savedTransform.y !== 0) {
      svg.call(this.zoomBehavior.transform, savedTransform);
    }

    const zones = [
      { ratio: 0.33, label: 'Cerca', opacity: 0.06 },
      { ratio: 0.66, label: 'Atención', opacity: 0.04 },
      { ratio: 1, label: 'Lejos', opacity: 0.025 },
    ];

    zones.forEach((zone) => {
      g.append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', maxOrbit * zone.ratio)
        .attr('fill', 'none')
        .attr('stroke', this.graphColors.zoneStroke)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', zone.ratio < 1 ? '4 6' : 'none');

      g.append('text')
        .attr('x', centerX)
        .attr('y', centerY - maxOrbit * zone.ratio - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', this.graphColors.zoneLabel)
        .attr('font-size', 9)
        .text(zone.label);
    });

    const linkGroup = g.append('g').attr('class', 'links');
    const link = linkGroup
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y)
      .attr('stroke', (d) => this.statusColor(d.target.person!.status))
      .attr('stroke-width', (d) => 1 + d.strength * 2.5)
      .attr('stroke-opacity', (d) => 0.15 + d.strength * 0.55)
      .attr('stroke-linecap', 'round');

    const nodeGroup = g.append('g').attr('class', 'nodes');
    const node = nodeGroup
      .selectAll<SVGGElement, GraphNode>('g.node')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('class', (d) => `node ${d.isSelf ? 'self' : d.person!.status}`)
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('cursor', (d) => (d.isSelf ? 'default' : 'pointer'))
      .style('opacity', 0)
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.isSelf || !d.person) return;
        this.resetQuickNote();
        this.selected.set(d.person);
        this.highlightNode(d.id);
      });

    node
      .transition()
      .duration(600)
      .delay((_, i) => i * 40)
      .style('opacity', (d) => (d.isSelf ? 1 : this.nodeOpacity(d)));

    node
      .filter((d) => !d.isSelf && d.person!.status === 'attention')
      .append('circle')
      .attr('r', (d) => d.radius + 8)
      .attr('fill', 'none')
      .attr('stroke', this.statusColor('attention'))
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.5)
      .attr('class', 'pulse-ring')
      .append('animate')
      .attr('attributeName', 'r')
      .attr('values', (d) => `${d.radius + 4};${d.radius + 12};${d.radius + 4}`)
      .attr('dur', '2.5s')
      .attr('repeatCount', 'indefinite');

    node
      .append('circle')
      .attr('class', 'node-body')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => (d.isSelf ? 'url(#self-glow)' : this.nodeFill(d)))
      .attr('stroke', (d) => this.nodeStroke(d))
      .attr('stroke-width', (d) => (d.isSelf ? 3 : 2.5))
      .attr('filter', (d) =>
        !d.isSelf && d.person!.status === 'well' ? 'url(#node-glow)' : null,
      );

    node
      .filter((d) => !d.isSelf && !!d.person?.photo)
      .append('image')
      .attr('href', (d) => d.person!.photo!)
      .attr('x', (d) => -(d.radius - 3))
      .attr('y', (d) => -(d.radius - 3))
      .attr('width', (d) => (d.radius - 3) * 2)
      .attr('height', (d) => (d.radius - 3) * 2)
      .attr('clip-path', (d) => `url(#clip-${d.id})`);

    node
      .filter((d) => !d.isSelf && !d.person?.photo)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('font-size', (d) => d.radius * 0.55)
      .attr('font-weight', 600)
      .text((d) => this.initials(d.person!.name));

    node
      .append('text')
      .attr('class', 'node-label')
      .text((d) => (d.isSelf ? 'YO' : d.person!.name))
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 14)
      .attr('fill', (d) => this.labelColor(d))
      .attr('font-size', (d) => (d.isSelf ? 12 : 10))
      .attr('font-weight', (d) => (d.isSelf ? 700 : 500));

    node
      .filter((d) => !d.isSelf)
      .append('text')
      .attr('class', 'node-days')
      .text((d) => formatDaysShort(d.person!.daysSinceContact))
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 26)
      .attr('fill', 'rgba(148,163,184,0.6)')
      .attr('font-size', 8);

    svg.on('click', () => this.clearSelection());

    this.nodePositions.clear();
    nodes.forEach((n) => this.nodePositions.set(n.id, { x: n.x, y: n.y }));

    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
  }

  private buildNodes(
    people: PersonWithStatus[],
    centerX: number,
    centerY: number,
    maxOrbit: number,
  ): GraphNode[] {
    const selfRadius = 32;
    const nodePadding = 14;
    const labelPadding = 12;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const maxPersonRadius = 26;
    const minOrbit = Math.max(
      selfRadius + maxPersonRadius + nodePadding,
      maxOrbit * 0.34,
    );

    const selfNode: GraphNode = {
      id: 'self',
      isSelf: true,
      x: centerX,
      y: centerY,
      radius: selfRadius,
      angle: 0,
      distance: 0,
    };

    const entries = people
      .map((person) => {
        const ratio = Math.min(person.attentionRatio, 2.5) / 2.5;
        const targetDistance = minOrbit + ratio * (maxOrbit - minOrbit);
        const radius = Math.max(
          20,
          maxPersonRadius - Math.min(person.attentionRatio, 2) * 3,
        );
        return { person, targetDistance, radius };
      })
      .sort(
        (a, b) =>
          a.targetDistance - b.targetDistance ||
          a.person.name.localeCompare(b.person.name, 'es'),
      );

    const occupied: { x: number; y: number; r: number }[] = [
      { x: centerX, y: centerY, r: selfRadius + nodePadding },
    ];
    const personNodes: GraphNode[] = [];
    let goldenIndex = 0;

    for (const entry of entries) {
      const labelHalfWidth = Math.min(entry.person.name.length * 3.4, 48);
      const hitRadius = Math.max(entry.radius + labelPadding, labelHalfWidth);
      let placed: GraphNode | null = null;

      for (let orbit = 0; orbit < 90 && !placed; orbit++) {
        const distance = Math.min(
          maxOrbit,
          entry.targetDistance + orbit * 9,
        );

        for (let step = 0; step < 72 && !placed; step++) {
          const angle =
            goldenIndex * goldenAngle + step * ((2 * Math.PI) / 72);
          const x = centerX + Math.cos(angle) * distance;
          const y = centerY + Math.sin(angle) * distance;

          if (!this.collidesWithOccupied(x, y, hitRadius, occupied, nodePadding)) {
            placed = {
              id: entry.person.id,
              isSelf: false,
              person: entry.person,
              x,
              y,
              radius: entry.radius,
              angle,
              distance,
            };
          }
        }
      }

      if (!placed) {
        const angle = goldenIndex * goldenAngle;
        const distance = maxOrbit;
        placed = {
          id: entry.person.id,
          isSelf: false,
          person: entry.person,
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
          radius: entry.radius,
          angle,
          distance,
        };
      }

      occupied.push({ x: placed.x, y: placed.y, r: hitRadius });
      personNodes.push(placed);
      goldenIndex++;
    }

    return [selfNode, ...personNodes];
  }

  private collidesWithOccupied(
    x: number,
    y: number,
    radius: number,
    occupied: { x: number; y: number; r: number }[],
    padding: number,
  ): boolean {
    for (const other of occupied) {
      const gap = Math.hypot(x - other.x, y - other.y);
      if (gap < radius + other.r + padding) {
        return true;
      }
    }
    return false;
  }

  private panToNode(id: string): void {
    const pos = this.nodePositions.get(id);
    if (!pos || !this.zoomBehavior || !this.svgRef) return;

    const container = this.containerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const svg = d3.select(this.svgRef.nativeElement);

    svg
      .transition()
      .duration(450)
      .call(
        this.zoomBehavior.transform,
        d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(1.3)
          .translate(-pos.x, -pos.y),
      );
  }

  private highlightNode(id: string | null): void {
    if (!this.zoomLayer) return;
    const layer = this.zoomLayer;
    layer.selectAll<SVGGElement, GraphNode>('g.node').each((d, _i, nodes) => {
      const el = d3.select(nodes[_i]);
      const isSelected = id === d.id;
      const dimmed = id !== null && !d.isSelf && d.id !== id;
      el.style('opacity', dimmed ? 0.25 : d.isSelf ? 1 : this.nodeOpacity(d));
      el.select('circle.node-body')
        .attr('stroke-width', isSelected ? 4 : d.isSelf ? 3 : 2.5)
        .attr('stroke', isSelected ? this.graphColors.selectedStroke : this.nodeStroke(d));
    });
  }

  private readGraphColors(): GraphThemeColors {
    const style = getComputedStyle(document.documentElement);
    const value = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;

    return {
      zoneStroke: value('--graph-zone-stroke', 'rgba(255,255,255,0.08)'),
      zoneLabel: value('--graph-zone-label', 'rgba(148,163,184,0.35)'),
      selectedStroke: value('--graph-selected', '#a5b4fc'),
      selfStroke: value('--graph-self-stroke', '#c7d2fe'),
      selfLabel: value('--graph-self-label', '#e0e7ff'),
      dimLabel: value('--graph-dim-label', '#64748b'),
      brightLabel: value('--graph-bright-label', '#cbd5e1'),
      nodeDim: value('--graph-node-dim', '#475569'),
      gradientStart: value('--graph-gradient-start', '#818cf8'),
      gradientEnd: value('--graph-gradient-end', '#6366f1'),
    };
  }

  private linkStrength(person: PersonWithStatus): number {
    return Math.max(0.12, 1 - Math.min(person.attentionRatio, 2.5) / 2.5);
  }

  private nodeFill(node: GraphNode): string {
    const ratio = node.person!.attentionRatio;
    if (ratio > 1.5) return this.graphColors.nodeDim;
    return this.statusColor(node.person!.status);
  }

  private nodeStroke(node: GraphNode): string {
    if (node.isSelf) return this.graphColors.selfStroke;
    return this.statusColor(node.person!.status);
  }

  private nodeOpacity(node: GraphNode): number {
    const ratio = node.person!.attentionRatio;
    return Math.max(0.45, 1 - Math.min(ratio - 0.8, 1.7) * 0.3);
  }

  private labelColor(node: GraphNode): string {
    if (node.isSelf) return this.graphColors.selfLabel;
    return this.nodeOpacity(node) < 0.65
      ? this.graphColors.dimLabel
      : this.graphColors.brightLabel;
  }

  private statusColor(status: string): string {
    const colors: Record<string, string> = {
      well: this.cssVar('--status-well-dot', '#34d399'),
      soon: this.cssVar('--status-soon-dot', '#fbbf24'),
      reconnect: this.cssVar('--status-reconnect-dot', '#fb923c'),
      attention: this.cssVar('--status-attention-dot', '#f87171'),
    };
    return colors[status] ?? this.cssVar('--graph-dim-label', '#64748b');
  }

  private cssVar(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  private initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }
}
