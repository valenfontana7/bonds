import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BondsService } from '../../core/services/bonds.service';
import { PersonAvatarComponent } from '../../shared/person-avatar/person-avatar.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-week-connections',
  standalone: true,
  imports: [RouterLink, PersonAvatarComponent, StatusBadgeComponent],
  template: `
    <section class="week-page">
      <header>
        <h1>Esta semana</h1>
        <p class="subtitle">Conexiones que merecen tu intención</p>
      </header>

      @if (connections().length === 0) {
        <div class="empty-state">
          <p>🌿 Tu red está bien atendida esta semana.</p>
          <p class="hint">Cuando alguien necesite atención, aparecerá aquí.</p>
        </div>
      } @else {
        <ul class="connection-list">
          @for (person of connections(); track person.id) {
            <li class="connection-item">
              <app-person-avatar [name]="person.name" [photo]="person.photo" [size]="44" />
              <div class="info">
                <strong>{{ person.name }}</strong>
                <span class="suggestion">{{ suggestion(person) }}</span>
                <app-status-badge [status]="person.status" [label]="person.statusLabel" />
              </div>
              <a [routerLink]="['/personas', person.id]" class="btn-secondary small">
                Conectar
              </a>
            </li>
          }
        </ul>
      }

      @if (allAttended().length > 0) {
        <section class="attended-section">
          <h2>Bien atendidas</h2>
          <div class="attended-chips">
            @for (person of allAttended(); track person.id) {
              <a [routerLink]="['/personas', person.id]" class="chip">
                {{ person.name }}
              </a>
            }
          </div>
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
      gap: 0.25rem;

      strong { font-size: 0.95rem; }
    }

    .suggestion {
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    .btn-secondary.small {
      padding: 0.4rem 0.75rem;
      font-size: 0.8rem;
      white-space: nowrap;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);

      .hint {
        font-size: 0.85rem;
        margin-top: 0.5rem;
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

    .attended-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .chip {
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: rgba(52, 211, 153, 0.12);
      color: #6ee7b7;
      text-decoration: none;
      font-size: 0.82rem;

      &:hover {
        background: rgba(52, 211, 153, 0.2);
      }
    }
  `,
})
export class WeekConnectionsComponent {
  private readonly bonds = inject(BondsService);

  readonly connections = this.bonds.weekConnections;

  allAttended = () =>
    this.bonds.peopleWithStatus().filter((p) => p.status === 'well');

  suggestion(person: { status: string; name: string }): string {
    const suggestions: Record<string, string> = {
      soon: `Podrías escribirle o llamarla`,
      reconnect: `Hace tiempo — un mensaje corto puede bastar`,
      attention: `Te extraña, aunque no lo diga`,
      well: `Todo bien por ahora`,
    };
    return suggestions[person.status] ?? `Conectar con ${person.name}`;
  }
}
