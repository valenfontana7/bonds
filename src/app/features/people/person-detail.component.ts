import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BondsService } from '../../core/services/bonds.service';
import {
  INTERACTION_ICONS,
  INTERACTION_LABELS,
  InteractionType,
} from '../../core/models/person.model';
import { PersonAvatarComponent } from '../../shared/person-avatar/person-avatar.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-person-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, PersonAvatarComponent, StatusBadgeComponent],
  template: `
    @if (person(); as p) {
      <section class="detail-page">
        <header>
          <a routerLink="/personas" class="back-link">← Personas</a>
          <div class="profile">
            <app-person-avatar [name]="p.name" [photo]="p.photo" [size]="80" />
            <div>
              <h1>{{ p.name }}</h1>
              <p class="meta">Último contacto: hace {{ p.daysSinceContact }} días</p>
              <app-status-badge [status]="p.status" [label]="p.statusLabel" />
            </div>
          </div>
          <a [routerLink]="['/personas', p.id, 'editar']" class="btn-secondary">Editar</a>
        </header>

        <section class="card">
          <h2>Registrar interacción</h2>
          <div class="interaction-grid">
            @for (type of interactionTypes; track type) {
              <button type="button" class="interaction-btn" (click)="logInteraction(type)">
                <span class="icon">{{ interactionIcons[type] }}</span>
                {{ interactionLabels[type] }}
              </button>
            }
          </div>
        </section>

        <section class="card">
          <h2>Historial</h2>
          @if (interactions().length === 0) {
            <p class="empty">Sin interacciones registradas aún.</p>
          } @else {
            <ul class="history">
              @for (item of interactions(); track item.id) {
                <li>
                  <span class="icon">{{ interactionIcons[item.type] }}</span>
                  <div>
                    <strong>{{ interactionLabels[item.type] }}</strong>
                    <span class="date">{{ item.date | date:'d MMM y, HH:mm' }}</span>
                    @if (item.note) {
                      <p class="note">{{ item.note }}</p>
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
        border-color: #6366f1;
        background: rgba(99, 102, 241, 0.08);
      }

      .icon {
        font-size: 1.5rem;
      }
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

      .icon { font-size: 1.25rem; }

      .date {
        display: block;
        font-size: 0.8rem;
        color: var(--text-muted);
      }

      .note {
        margin: 0.25rem 0 0;
        font-size: 0.85rem;
        color: var(--text-muted);
      }
    }

    .empty, .not-found {
      color: var(--text-muted);
      text-align: center;
      padding: 2rem;
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

  private readonly personId = this.route.snapshot.paramMap.get('id')!;

  readonly person = computed(() => this.bonds.getPerson(this.personId));
  readonly interactions = computed(() =>
    this.bonds.getInteractionsForPerson(this.personId),
  );

  logInteraction(type: InteractionType): void {
    this.bonds.logInteraction(this.personId, type);
  }
}
