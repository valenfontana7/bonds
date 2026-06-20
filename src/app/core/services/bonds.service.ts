import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Interaction,
  InteractionType,
  Person,
  PersonCategory,
  PreferredContact,
  PersonWithStatus,
  formatMonthShort,
  getMonthKey,
  daysUntilBirthday,
} from '../models/person.model';
import { ImportedPersonDraft } from '../models/imported-person.model';
import { RelationshipStatusService } from './relationship-status.service';
import { StorageService } from './storage.service';
import { SyncService } from './sync.service';

const PEOPLE_KEY = 'bonds.people';
const INTERACTIONS_KEY = 'bonds.interactions';
const ONBOARDING_KEY = 'bonds.onboarding.completed';

export interface BondsBackup {
  version: 1;
  exportedAt: string;
  people: Person[];
  interactions: Interaction[];
}

export type ImportBackupMode = 'merge' | 'replace';

export interface ImportBackupResult {
  peopleAdded: number;
  interactionsAdded: number;
}

function isPerson(value: unknown): value is Person {
  if (!value || typeof value !== 'object') return false;
  const person = value as Person;
  return (
    typeof person.id === 'string' &&
    typeof person.name === 'string' &&
    typeof person.category === 'string' &&
    typeof person.desiredFrequencyDays === 'number' &&
    typeof person.createdAt === 'string'
  );
}

function isInteraction(value: unknown): value is Interaction {
  if (!value || typeof value !== 'object') return false;
  const interaction = value as Interaction;
  return (
    typeof interaction.id === 'string' &&
    typeof interaction.personId === 'string' &&
    typeof interaction.type === 'string' &&
    typeof interaction.date === 'string'
  );
}

export function parseBondsBackup(data: unknown): BondsBackup {
  if (!data || typeof data !== 'object') {
    throw new Error('Archivo inválido.');
  }

  const backup = data as Partial<BondsBackup>;
  if (!Array.isArray(backup.people) || !Array.isArray(backup.interactions)) {
    throw new Error('El archivo no tiene el formato de Bonds.');
  }

  if (!backup.people.every(isPerson) || !backup.interactions.every(isInteraction)) {
    throw new Error('El archivo contiene datos incompletos o corruptos.');
  }

  return {
    version: 1,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : new Date().toISOString(),
    people: backup.people,
    interactions: backup.interactions,
  };
}

@Injectable({ providedIn: 'root' })
export class BondsService {
  private readonly storage = inject(StorageService);
  private readonly statusService = inject(RelationshipStatusService);
  private readonly sync = inject(SyncService);

  private readonly peopleSignal = signal<Person[]>([]);
  private readonly interactionsSignal = signal<Interaction[]>([]);

  readonly people = this.peopleSignal.asReadonly();
  readonly interactions = this.interactionsSignal.asReadonly();

  readonly peopleWithStatus = computed<PersonWithStatus[]>(() =>
    this.statusService.enrichAll(this.peopleSignal(), this.interactionsSignal()),
  );

  readonly needsAttention = computed(() =>
    this.peopleWithStatus()
      .filter((p) => p.status !== 'well')
      .sort((a, b) => b.attentionRatio - a.attentionRatio),
  );

  readonly weekConnections = computed(() => this.needsAttention().slice(0, 7));

  readonly contactsByMonth = computed(() => {
    const counts = new Map<string, number>();
    for (const interaction of this.interactionsSignal()) {
      const key = getMonthKey(interaction.date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const months: { key: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = getMonthKey(date.toISOString());
      months.push({
        key,
        label: formatMonthShort(key),
        count: counts.get(key) ?? 0,
      });
    }
    return months;
  });

  readonly upcomingBirthdays = computed(() =>
    this.peopleWithStatus()
      .filter((person) => person.birthday)
      .map((person) => ({
        person,
        daysUntil: daysUntilBirthday(person.birthday!),
      }))
      .filter((entry) => entry.daysUntil <= 14)
      .sort((a, b) => a.daysUntil - b.daysUntil || a.person.name.localeCompare(b.person.name, 'es')),
  );

  readonly networkStats = computed(() => {
    const people = this.peopleSignal();
    const interactions = this.interactionsSignal();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const contactsThisMonth = interactions.filter(
      (interaction) => new Date(interaction.date) >= monthStart,
    ).length;

    const contactsLast7Days = interactions.filter(
      (interaction) => new Date(interaction.date) >= weekStart,
    ).length;

    const needsAttention = this.needsAttention();
    const mostNeglected = needsAttention.length
      ? [...needsAttention].sort((a, b) => b.daysSinceContact - a.daysSinceContact)[0]
      : null;

    return {
      totalPeople: people.length,
      totalInteractions: interactions.length,
      contactsThisMonth,
      contactsLast7Days,
      upcomingBirthdaysCount: this.upcomingBirthdays().length,
      needsAttention: needsAttention.length,
      wellCount: this.peopleWithStatus().filter((person) => person.status === 'well').length,
      noContactCount: people.filter((person) => !person.phone && !person.email).length,
      mostNeglected: mostNeglected
        ? {
            id: mostNeglected.id,
            name: mostNeglected.name.split(/\s+/)[0] || mostNeglected.name,
            days: mostNeglected.daysSinceContact,
          }
        : null,
    };
  });

  constructor() {
    this.reloadFromStorage();
  }

  isOnboardingComplete(): boolean {
    return this.storage.get<boolean>(ONBOARDING_KEY, false) || this.peopleSignal().length > 0;
  }

  markOnboardingComplete(): void {
    this.storage.set(ONBOARDING_KEY, true);
  }

  reloadFromStorage(): void {
    this.peopleSignal.set(this.storage.get<Person[]>(PEOPLE_KEY, []));
    this.interactionsSignal.set(this.storage.get<Interaction[]>(INTERACTIONS_KEY, []));
  }

  importFromDrafts(drafts: ImportedPersonDraft[]): Person[] {
    const people = [...this.peopleSignal()];
    const interactions = [...this.interactionsSignal()];
    const now = new Date();
    const created: Person[] = [];

    for (const draft of drafts) {
      const person: Person = {
        id: crypto.randomUUID(),
        name: draft.name.trim(),
        category: draft.category,
        desiredFrequencyDays: draft.desiredFrequencyDays,
        createdAt: now.toISOString(),
      };
      people.push(person);
      created.push(person);

      if (draft.daysSinceLastContact != null) {
        const date = new Date(now);
        date.setDate(date.getDate() - draft.daysSinceLastContact);
        interactions.push({
          id: crypto.randomUUID(),
          personId: person.id,
          type: 'mensaje',
          date: date.toISOString(),
          note: draft.note,
        });
      }
    }

    this.persistPeople(people);
    this.persistInteractions(interactions);
    this.markOnboardingComplete();
    return created;
  }

  addPerson(data: {
    name: string;
    photo?: string;
    category: PersonCategory;
    desiredFrequencyDays: number;
    birthday?: string;
    pinnedNote?: string;
    phone?: string;
    email?: string;
    preferredContact?: PreferredContact;
  }): Person {
    const person: Person = {
      id: crypto.randomUUID(),
      name: data.name.trim(),
      photo: data.photo,
      category: data.category,
      desiredFrequencyDays: data.desiredFrequencyDays,
      birthday: data.birthday,
      pinnedNote: data.pinnedNote?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      preferredContact: data.preferredContact,
      createdAt: new Date().toISOString(),
    };
    this.persistPeople([...this.peopleSignal(), person]);
    if (this.peopleSignal().length === 1) {
      this.markOnboardingComplete();
    }
    return person;
  }

  updatePerson(id: string, data: Partial<Omit<Person, 'id' | 'createdAt'>>): void {
    this.persistPeople(
      this.peopleSignal().map((p) =>
        p.id === id
          ? {
              ...p,
              ...data,
              name: data.name?.trim() ?? p.name,
              pinnedNote:
                data.pinnedNote !== undefined
                  ? data.pinnedNote.trim() || undefined
                  : p.pinnedNote,
              phone: data.phone !== undefined ? data.phone.trim() || undefined : p.phone,
              email: data.email !== undefined ? data.email.trim() || undefined : p.email,
            }
          : p,
      ),
    );
  }

  deletePerson(id: string): void {
    this.persistPeople(this.peopleSignal().filter((p) => p.id !== id));
    this.persistInteractions(this.interactionsSignal().filter((i) => i.personId !== id));
  }

  getPerson(id: string): PersonWithStatus | undefined {
    return this.peopleWithStatus().find((p) => p.id === id);
  }

  logInteraction(
    personId: string,
    type: InteractionType,
    date?: string,
    note?: string,
  ): Interaction {
    const interaction: Interaction = {
      id: crypto.randomUUID(),
      personId,
      type,
      date: date ?? new Date().toISOString(),
      note: note?.trim() || undefined,
    };
    this.persistInteractions([...this.interactionsSignal(), interaction]);
    return interaction;
  }

  removeInteraction(interactionId: string): void {
    this.persistInteractions(
      this.interactionsSignal().filter((interaction) => interaction.id !== interactionId),
    );
  }

  updateInteraction(
    interactionId: string,
    data: Partial<Pick<Interaction, 'note' | 'type' | 'date'>>,
  ): void {
    this.persistInteractions(
      this.interactionsSignal().map((interaction) => {
        if (interaction.id !== interactionId) return interaction;
        return {
          ...interaction,
          ...data,
          note: data.note !== undefined ? data.note.trim() || undefined : interaction.note,
        };
      }),
    );
  }

  getInteractionsForPerson(personId: string): Interaction[] {
    return this.interactionsSignal()
      .filter((i) => i.personId === personId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  exportBackup(): BondsBackup {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      people: this.peopleSignal(),
      interactions: this.interactionsSignal(),
    };
  }

  importBackup(backup: BondsBackup, mode: ImportBackupMode): ImportBackupResult {
    if (mode === 'replace') {
      this.persistPeople(backup.people);
      this.persistInteractions(backup.interactions);
      if (backup.people.length > 0) {
        this.markOnboardingComplete();
      }
      return {
        peopleAdded: backup.people.length,
        interactionsAdded: backup.interactions.length,
      };
    }

    const peopleById = new Map(this.peopleSignal().map((person) => [person.id, person]));
    let peopleAdded = 0;
    for (const person of backup.people) {
      if (peopleById.has(person.id)) continue;
      peopleById.set(person.id, person);
      peopleAdded += 1;
    }

    const mergedPeople = [...peopleById.values()];
    const peopleIds = new Set(mergedPeople.map((person) => person.id));
    const interactionsById = new Map(
      this.interactionsSignal().map((interaction) => [interaction.id, interaction]),
    );
    let interactionsAdded = 0;

    for (const interaction of backup.interactions) {
      if (!peopleIds.has(interaction.personId) || interactionsById.has(interaction.id)) {
        continue;
      }
      interactionsById.set(interaction.id, interaction);
      interactionsAdded += 1;
    }

    this.persistPeople(mergedPeople);
    this.persistInteractions([...interactionsById.values()]);
    if (mergedPeople.length > 0) {
      this.markOnboardingComplete();
    }

    return { peopleAdded, interactionsAdded };
  }

  private persistPeople(people: Person[]): void {
    this.peopleSignal.set(people);
    this.storage.set(PEOPLE_KEY, people);
    this.sync.schedulePush();
  }

  private persistInteractions(interactions: Interaction[]): void {
    this.interactionsSignal.set(interactions);
    this.storage.set(INTERACTIONS_KEY, interactions);
    this.sync.schedulePush();
  }
}
