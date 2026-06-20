import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { BondsService } from '../../core/services/bonds.service';
import { StorageService } from '../../core/services/storage.service';
import {
  CATEGORY_LABELS,
  PersonCategory,
  PersonWithStatus,
  birthdayBadgeLabel,
  daysUntilBirthday,
  formatBirthdayCountdown,
  formatLastContactLabel,
  formatFrequencyDeadline,
  formatPreferredContactHint,
  isBirthdayImminent,
  isBirthdaySoon,
  mailtoHref,
  telHref,
  whatsAppHref,
  whatsAppMessageForPerson,
} from '../../core/models/person.model';
import { PersonAvatarComponent } from '../../shared/person-avatar/person-avatar.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

type StatusFilter = 'all' | 'attention' | 'well' | 'birthday' | 'nocontact';
type CategoryFilter = 'all' | PersonCategory;
type SortOption = 'urgency' | 'name' | 'category' | 'birthday' | 'recent';

const SORT_KEY = 'bonds.people.sort';

@Component({
  selector: 'app-people-list',
  standalone: true,
  imports: [FormsModule, RouterLink, PersonAvatarComponent, StatusBadgeComponent],
  template: `
    <section class="people-page">
      <header class="page-header">
        <div>
          <h1>Personas</h1>
          <p class="subtitle">{{ subtitle() }}</p>
        </div>
        <a routerLink="/personas/nueva" class="btn-primary">+ Agregar</a>
      </header>

      @if (people().length === 0) {
        <div class="empty-state">
          <p>Aún no agregaste a nadie.</p>
          <a routerLink="/personas/nueva" class="btn-primary">Agregar primera persona</a>
        </div>
      } @else {
        <div class="stats-row" aria-label="Resumen de tu red">
          <div class="stat-card static">
            <span class="stat-value">{{ stats().contactsThisMonth }}</span>
            <span class="stat-label">Contactos este mes</span>
          </div>
          <button
            type="button"
            class="stat-card"
            [class.active]="statusFilter() === 'attention'"
            (click)="toggleStatusFilter('attention')"
          >
            <span class="stat-value">{{ stats().needsAttention }}</span>
            <span class="stat-label">Necesitan atención</span>
          </button>
          <button
            type="button"
            class="stat-card"
            [class.active]="statusFilter() === 'well'"
            (click)="toggleStatusFilter('well')"
          >
            <span class="stat-value">{{ stats().wellCount }}</span>
            <span class="stat-label">Al día</span>
          </button>
        </div>

        @if (showMonthlyChart()) {
          <section class="chart-card" aria-label="Contactos por mes">
            <h2 class="chart-title">Contactos · últimos 6 meses</h2>
            <div class="bar-chart">
              @for (month of contactsByMonth(); track month.key) {
                <div class="bar-col">
                  <span class="bar-value">{{ month.count || '' }}</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill"
                      [style.height.%]="barHeight(month.count)"
                      [class.empty]="month.count === 0"
                    ></div>
                  </div>
                  <span class="bar-label">{{ month.label }}</span>
                </div>
              }
            </div>
          </section>
        }

        @if (upcomingBirthdays().length > 0) {
          <section class="birthdays-strip" aria-label="Próximos cumpleaños">
            <h2 class="strip-title">🎂 Próximos cumpleaños</h2>
            <div class="birthday-chips">
              @for (entry of upcomingBirthdays(); track entry.person.id) {
                <div class="birthday-chip" [class.imminent]="entry.daysUntil <= 1">
                  <a [routerLink]="['/personas', entry.person.id]" class="chip-link">
                    <strong>{{ entry.person.name.split(' ')[0] }}</strong>
                    <span>{{ formatCountdown(entry.daysUntil) }}</span>
                  </a>
                  @if (entry.person.phone) {
                    <button
                      type="button"
                      class="chip-wa"
                      (click)="openBirthdayWhatsApp(entry.person)"
                      title="Felicitá por WhatsApp"
                    >
                      WA
                    </button>
                  }
                </div>
              }
            </div>
          </section>
        }

        <div class="toolbar">
          <input
            type="search"
            class="search"
            placeholder="Buscar por nombre…"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            aria-label="Buscar personas"
          />
          <div class="filters" role="group" aria-label="Filtrar por estado">
            @for (option of statusFilters; track option.value) {
              <button
                type="button"
                class="filter-chip"
                [class.active]="statusFilter() === option.value"
                (click)="statusFilter.set(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>
          <div class="filters" role="group" aria-label="Ordenar lista">
            @for (option of sortOptions; track option.value) {
              <button
                type="button"
                class="filter-chip"
                [class.active]="sortBy() === option.value"
                (click)="setSort(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>
          @if (availableCategories().length > 1) {
            <div class="filters" role="group" aria-label="Filtrar por categoría">
              <button
                type="button"
                class="filter-chip"
                [class.active]="categoryFilter() === 'all'"
                (click)="categoryFilter.set('all')"
              >
                Todas las categorías
              </button>
              @for (category of availableCategories(); track category) {
                <button
                  type="button"
                  class="filter-chip"
                  [class.active]="categoryFilter() === category"
                  (click)="categoryFilter.set(category)"
                >
                  {{ categoryLabels[category] }}
                </button>
              }
            </div>
          }
        </div>

        @if (filteredPeople().length === 0) {
          <div class="empty-state compact">
            <p>Ninguna persona coincide con tu búsqueda.</p>
            <button type="button" class="btn-secondary" (click)="clearFilters()">Limpiar filtros</button>
          </div>
        } @else {
          <ul class="people-list">
            @for (person of filteredPeople(); track person.id) {
              <li class="person-row">
                <a [routerLink]="['/personas', person.id]" class="person-card">
                  <app-person-avatar [name]="person.name" [photo]="person.photo" [size]="52" />
                  <div class="info">
                    <div class="name-row">
                      <strong>{{ person.name }}</strong>
                      @if (birthdayLabel(person.birthday); as badge) {
                        <span class="birthday-badge" [class.imminent]="birthdayImminent(person.birthday!)">
                          {{ badge }}
                        </span>
                      }
                      <span class="category">{{ categoryLabels[person.category] }}</span>
                    </div>
                    <p class="meta">{{ formatLastContact(person.daysSinceContact) }}</p>
                    <p class="meta freq">{{ formatFrequency(person.daysSinceContact, person.desiredFrequencyDays) }}</p>
                    <p class="meta subtle">{{ formatInteractionCount(interactionCount(person.id)) }}</p>
                    @if (person.preferredContact) {
                      <p class="pref-hint">{{ preferredHint(person.preferredContact) }}</p>
                    }
                    @if (person.pinnedNote) {
                      <p class="pinned-snippet">📌 {{ person.pinnedNote }}</p>
                    }
                    <app-status-badge [status]="person.status" [label]="person.statusLabel" />
                  </div>
                </a>
                @if (person.phone || person.email) {
                  <div class="quick-actions">
                    @if (person.phone) {
                      <a
                        [href]="telLink(person.phone)"
                        class="quick-btn"
                        title="Llamar"
                        (click)="$event.stopPropagation()"
                      >
                        📞
                      </a>
                      <button
                        type="button"
                        class="quick-btn wa"
                        title="Abrir WhatsApp"
                        (click)="openWhatsApp(person)"
                      >
                        WA
                      </button>
                    }
                    @if (person.email) {
                      <a
                        [href]="emailLink(person.email)"
                        class="quick-btn"
                        title="Enviar email"
                        (click)="$event.stopPropagation()"
                      >
                        ✉️
                      </a>
                    }
                  </div>
                }
              </li>
            }
          </ul>
        }
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

    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }

    .stat-card {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.75rem 0.5rem;
      border-radius: 0.75rem;
      border: 1px solid var(--border);
      background: var(--surface);
      text-align: center;
      cursor: pointer;
      font: inherit;
      color: inherit;
      transition: border-color 0.2s, background 0.2s;

      &.static {
        cursor: default;
      }

      &.active {
        border-color: rgba(99, 102, 241, 0.5);
        background: rgba(99, 102, 241, 0.1);
      }

      &:not(.static):hover {
        border-color: rgba(99, 102, 241, 0.35);
      }
    }

    .stat-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--accent-soft);
      line-height: 1;
    }

    .stat-label {
      font-size: 0.65rem;
      color: var(--text-muted);
      line-height: 1.3;
    }

    .birthdays-strip {
      padding: 0.85rem;
      border-radius: 0.75rem;
      border: 1px solid var(--birthday-border);
      background: var(--birthday-bg);
    }

    .strip-title {
      margin: 0 0 0.65rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--birthday);
    }

    .birthday-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }

    .birthday-chip {
      display: flex;
      align-items: stretch;
      border-radius: 999px;
      border: 1px solid var(--birthday-border);
      background: var(--surface);
      overflow: hidden;

      &.imminent {
        border-color: var(--birthday);
      }
    }

    .chip-link {
      display: flex;
      flex-direction: column;
      gap: 0.05rem;
      padding: 0.35rem 0.65rem;
      text-decoration: none;
      color: inherit;

      strong {
        font-size: 0.78rem;
      }

      span {
        font-size: 0.65rem;
        color: var(--text-muted);
      }
    }

    .chip-wa {
      border: none;
      border-left: 1px solid var(--birthday-border);
      background: var(--wa-bg);
      color: var(--wa);
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0 0.55rem;
      cursor: pointer;
    }

    .chart-card {
      padding: 0.85rem;
      border-radius: 0.75rem;
      border: 1px solid var(--border);
      background: var(--surface);
    }

    .chart-title {
      margin: 0 0 0.75rem;
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--text-muted);
    }

    .bar-chart {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 0.35rem;
      align-items: end;
      height: 88px;
    }

    .bar-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      height: 100%;
      min-width: 0;
    }

    .bar-value {
      font-size: 0.62rem;
      color: var(--accent-soft);
      min-height: 0.85rem;
      line-height: 1;
    }

    .bar-track {
      flex: 1;
      width: 100%;
      max-width: 1.75rem;
      display: flex;
      align-items: flex-end;
      border-radius: 0.35rem 0.35rem 0 0;
      background: rgba(99, 102, 241, 0.08);
      overflow: hidden;
    }

    .bar-fill {
      width: 100%;
      border-radius: 0.35rem 0.35rem 0 0;
      background: linear-gradient(180deg, var(--graph-gradient-start) 0%, var(--graph-gradient-end) 100%);
      min-height: 0;

      &.empty { background: transparent; }
    }

    .bar-label {
      font-size: 0.62rem;
      color: var(--text-muted);
      text-transform: capitalize;
    }

    .toolbar {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
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

    .filters {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .filter-chip {
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-muted);
      font-size: 0.75rem;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s, background 0.2s;

      &.active {
        border-color: rgba(99, 102, 241, 0.5);
        background: rgba(99, 102, 241, 0.15);
        color: var(--accent-soft);
      }
    }

    .people-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .person-row {
      display: flex;
      align-items: stretch;
      gap: 0.45rem;
    }

    .person-card {
      display: flex;
      gap: 1rem;
      flex: 1;
      min-width: 0;
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

    .quick-actions {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex-shrink: 0;
    }

    .quick-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 2.5rem;
      padding: 0.45rem 0.55rem;
      border-radius: 0.65rem;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font-size: 0.78rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      font: inherit;

      &.wa {
        color: var(--wa);
        border-color: var(--wa-border);
        background: var(--wa-bg);
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
      color: var(--accent-muted);
    }

    .birthday-badge {
      font-size: 0.68rem;
      padding: 0.12rem 0.45rem;
      border-radius: 999px;
      background: var(--birthday-bg);
      border: 1px solid var(--birthday-border);
      color: var(--birthday);
      white-space: nowrap;

      &.imminent {
        border-color: var(--birthday);
        font-weight: 600;
      }
    }

    .meta {
      margin: 0;
      font-size: 0.85rem;
      color: var(--text-muted);

      &.subtle {
        font-size: 0.75rem;
        opacity: 0.85;
      }

      &.freq {
        font-size: 0.78rem;
        color: var(--accent-muted);
      }
    }

    .pref-hint {
      margin: 0;
      font-size: 0.75rem;
      color: var(--accent-muted);
    }

    .pinned-snippet {
      margin: 0;
      font-size: 0.78rem;
      color: var(--accent-muted);
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: center;

      &.compact {
        padding: 2rem 1rem;
      }
    }
  `,
})
export class PeopleListComponent {
  private readonly bonds = inject(BondsService);
  private readonly storage = inject(StorageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly people = this.bonds.peopleWithStatus;
  readonly stats = this.bonds.networkStats;
  readonly contactsByMonth = this.bonds.contactsByMonth;
  readonly upcomingBirthdays = this.bonds.upcomingBirthdays;
  readonly interactionCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const interaction of this.bonds.interactions()) {
      counts.set(interaction.personId, (counts.get(interaction.personId) ?? 0) + 1);
    }
    return counts;
  });
  readonly categoryLabels = CATEGORY_LABELS;
  readonly formatLastContact = formatLastContactLabel;
  readonly formatFrequency = formatFrequencyDeadline;
  readonly formatCountdown = formatBirthdayCountdown;
  readonly preferredHint = formatPreferredContactHint;
  readonly telLink = telHref;
  readonly emailLink = mailtoHref;
  readonly birthdayLabel = (birthday?: string) =>
    birthday ? birthdayBadgeLabel(birthday) : null;
  readonly birthdayImminent = (birthday: string) =>
    isBirthdayImminent(daysUntilBirthday(birthday));

  readonly searchQuery = signal('');
  readonly statusFilter = signal<StatusFilter>('all');
  readonly categoryFilter = signal<CategoryFilter>('all');
  readonly sortBy = signal<SortOption>(this.storage.get<SortOption>(SORT_KEY, 'urgency'));

  readonly availableCategories = computed(() => {
    const categories = new Set(this.people().map((person) => person.category));
    return [...categories].sort((a, b) =>
      this.categoryLabels[a].localeCompare(this.categoryLabels[b], 'es'),
    );
  });

  readonly maxMonthlyContacts = computed(() =>
    Math.max(1, ...this.contactsByMonth().map((month) => month.count)),
  );

  readonly showMonthlyChart = computed(() =>
    this.contactsByMonth().some((month) => month.count > 0),
  );

  readonly statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'attention', label: 'Necesitan atención' },
    { value: 'well', label: 'Al día' },
    { value: 'birthday', label: 'Cumple pronto' },
    { value: 'nocontact', label: 'Sin contacto' },
  ];

  readonly sortOptions: { value: SortOption; label: string }[] = [
    { value: 'urgency', label: 'Por urgencia' },
    { value: 'recent', label: 'Último contacto' },
    { value: 'birthday', label: 'Por cumpleaños' },
    { value: 'name', label: 'Por nombre' },
    { value: 'category', label: 'Por categoría' },
  ];

  constructor() {
    this.route.queryParamMap.subscribe((params) => this.applyQueryFilters(params));
  }

  readonly filteredPeople = computed(() => {
    let list = [...this.people()];

    switch (this.sortBy()) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        break;
      case 'category':
        list.sort(
          (a, b) =>
            this.categoryLabels[a.category].localeCompare(this.categoryLabels[b.category], 'es') ||
            a.name.localeCompare(b.name, 'es'),
        );
        break;
      case 'birthday':
        list.sort((a, b) => {
          const aDays = a.birthday ? daysUntilBirthday(a.birthday) : 999;
          const bDays = b.birthday ? daysUntilBirthday(b.birthday) : 999;
          return aDays - bDays || a.name.localeCompare(b.name, 'es');
        });
        break;
      case 'recent':
        list.sort(
          (a, b) =>
            a.daysSinceContact - b.daysSinceContact || a.name.localeCompare(b.name, 'es'),
        );
        break;
      default:
        list.sort(
          (a, b) =>
            b.attentionRatio - a.attentionRatio || a.name.localeCompare(b.name, 'es'),
        );
    }

    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      list = list.filter((person) => person.name.toLowerCase().includes(query));
    }

    const filter = this.statusFilter();
    if (filter === 'attention') {
      list = list.filter((person) => person.status !== 'well');
    } else if (filter === 'well') {
      list = list.filter((person) => person.status === 'well');
    } else if (filter === 'birthday') {
      list = list.filter(
        (person) => person.birthday && isBirthdaySoon(daysUntilBirthday(person.birthday)),
      );
    } else if (filter === 'nocontact') {
      list = list.filter((person) => !person.phone && !person.email);
    }

    const category = this.categoryFilter();
    if (category !== 'all') {
      list = list.filter((person) => person.category === category);
    }

    return list;
  });

  readonly subtitle = computed(() => {
    const total = this.people().length;
    const shown = this.filteredPeople().length;
    if (total === 0) return '0 en tu red';
    if (shown === total) return `${total} en tu red`;
    return `${shown} de ${total} personas`;
  });

  clearFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    this.categoryFilter.set('all');
    void this.router.navigate(['/personas']);
  }

  toggleStatusFilter(filter: StatusFilter): void {
    this.statusFilter.set(this.statusFilter() === filter ? 'all' : filter);
  }

  private applyQueryFilters(params: ParamMap): void {
    const estado = params.get('estado');
    if (
      estado === 'attention' ||
      estado === 'well' ||
      estado === 'birthday' ||
      estado === 'nocontact'
    ) {
      this.statusFilter.set(estado);
    }

    const categoria = params.get('categoria');
    if (categoria && categoria in CATEGORY_LABELS) {
      this.categoryFilter.set(categoria as PersonCategory);
    }
  }

  setSort(value: SortOption): void {
    this.sortBy.set(value);
    this.storage.set(SORT_KEY, value);
  }

  barHeight(count: number): number {
    if (count === 0) return 0;
    return Math.max(12, Math.round((count / this.maxMonthlyContacts()) * 100));
  }

  openBirthdayWhatsApp(person: PersonWithStatus): void {
    if (!person.phone) return;
    const message = whatsAppMessageForPerson(person);
    window.open(whatsAppHref(person.phone, message), '_blank', 'noopener,noreferrer');
  }

  openWhatsApp(person: PersonWithStatus): void {
    this.openBirthdayWhatsApp(person);
  }

  interactionCount(personId: string): number {
    return this.interactionCounts().get(personId) ?? 0;
  }

  formatInteractionCount(count: number): string {
    if (count === 0) return 'Sin contactos registrados';
    if (count === 1) return '1 contacto registrado';
    return `${count} contactos registrados`;
  }
}
