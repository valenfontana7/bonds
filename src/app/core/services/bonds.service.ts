import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Interaction,
  InteractionType,
  Person,
  PersonCategory,
  PersonWithStatus,
} from '../models/person.model';
import { ImportedPersonDraft } from '../models/imported-person.model';
import { RelationshipStatusService } from './relationship-status.service';
import { StorageService } from './storage.service';
import { SyncService } from './sync.service';

const PEOPLE_KEY = 'bonds.people';
const INTERACTIONS_KEY = 'bonds.interactions';
const ONBOARDING_KEY = 'bonds.onboarding.completed';

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
  }): Person {
    const person: Person = {
      id: crypto.randomUUID(),
      name: data.name.trim(),
      photo: data.photo,
      category: data.category,
      desiredFrequencyDays: data.desiredFrequencyDays,
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
        p.id === id ? { ...p, ...data, name: data.name?.trim() ?? p.name } : p,
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

  getInteractionsForPerson(personId: string): Interaction[] {
    return this.interactionsSignal()
      .filter((i) => i.personId === personId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private persistPeople(people: Person[]): void {
    this.peopleSignal.set(people);
    this.storage.set(PEOPLE_KEY, people);
    void this.sync.pushToCloud();
  }

  private persistInteractions(interactions: Interaction[]): void {
    this.interactionsSignal.set(interactions);
    this.storage.set(INTERACTIONS_KEY, interactions);
    void this.sync.pushToCloud();
  }
}
