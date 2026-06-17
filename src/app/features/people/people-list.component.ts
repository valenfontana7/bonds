import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BondsService } from '../../core/services/bonds.service';
import { CATEGORY_LABELS } from '../../core/models/person.model';
import { PersonAvatarComponent } from '../../shared/person-avatar/person-avatar.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-people-list',
  standalone: true,
  imports: [RouterLink, PersonAvatarComponent, StatusBadgeComponent],
  template: `
    <section class="people-page">
      <header class="page-header">
        <div>
          <h1>Personas</h1>
          <p class="subtitle">{{ people().length }} en tu red</p>
        </div>
        <a routerLink="/personas/nueva" class="btn-primary">+ Agregar</a>
      </header>

      @if (people().length === 0) {
        <div class="empty-state">
          <p>Aún no agregaste a nadie.</p>
          <a routerLink="/personas/nueva" class="btn-primary">Agregar primera persona</a>
        </div>
      } @else {
        <ul class="people-list">
          @for (person of people(); track person.id) {
            <li>
              <a [routerLink]="['/personas', person.id]" class="person-card">
                <app-person-avatar [name]="person.name" [photo]="person.photo" [size]="52" />
                <div class="info">
                  <div class="name-row">
                    <strong>{{ person.name }}</strong>
                    <span class="category">{{ categoryLabels[person.category] }}</span>
                  </div>
                  <p class="meta">
                    Último contacto: hace {{ person.daysSinceContact }} día{{ person.daysSinceContact === 1 ? '' : 's' }}
                  </p>
                  <app-status-badge [status]="person.status" [label]="person.statusLabel" />
                </div>
              </a>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .people-page {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;

      h1 {
        margin: 0;
        font-size: 1.5rem;
      }
    }

    .subtitle {
      margin: 0.25rem 0 0;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .people-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .person-card {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.2s, transform 0.15s;

      &:hover {
        border-color: rgba(99, 102, 241, 0.4);
        transform: translateY(-1px);
      }
    }

    .info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .name-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .category {
      font-size: 0.72rem;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
    }

    .meta {
      margin: 0;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: center;
    }
  `,
})
export class PeopleListComponent {
  private readonly bonds = inject(BondsService);
  readonly people = this.bonds.peopleWithStatus;
  readonly categoryLabels = CATEGORY_LABELS;
}
