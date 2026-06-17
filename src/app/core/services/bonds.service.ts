import { Injectable, computed, signal } from '@angular/core';
import {
  Interaction,
  InteractionType,
  Person,
  PersonCategory,
  PersonWithStatus,
} from '../models/person.model';
import { RelationshipStatusService } from './relationship-status.service';
import { StorageService } from './storage.service';

const PEOPLE_KEY = 'bonds.people';
const INTERACTIONS_KEY = 'bonds.interactions';

@Injectable({ providedIn: 'root' })
export class BondsService {
  private readonly peopleSignal = signal<Person[]>([]);
  private readonly interactionsSignal = signal<Interaction[]>([]);

  readonly people = this.peopleSignal.asReadonly();
  readonly interactions = this.interactionsSignal.asReadonly();

  readonly peopleWithStatus = computed<PersonWithStatus[]>(() =>
    this.statusService.enrichAll(
      this.peopleSignal(),
      this.interactionsSignal(),
    ),
  );

  readonly needsAttention = computed(() =>
    this.peopleWithStatus()
      .filter((p) => p.status !== 'well')
      .sort((a, b) => b.attentionRatio - a.attentionRatio),
  );

  readonly weekConnections = computed(() =>
    this.needsAttention().slice(0, 7),
  );

  constructor(
    private readonly storage: StorageService,
    private readonly statusService: RelationshipStatusService,
  ) {
    this.peopleSignal.set(this.storage.get<Person[]>(PEOPLE_KEY, []));
    this.interactionsSignal.set(
      this.storage.get<Interaction[]>(INTERACTIONS_KEY, []),
    );
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
    this.persistInteractions(
      this.interactionsSignal().filter((i) => i.personId !== id),
    );
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

  seedDemoData(): void {
    if (this.peopleSignal().length > 0) return;

    const demo: Array<{
      name: string;
      category: PersonCategory;
      desiredFrequencyDays: number;
      daysAgo: number;
      type: InteractionType;
    }> = [
      { name: 'Mamá', category: 'familia', desiredFrequencyDays: 7, daysAgo: 5, type: 'llamada' },
      { name: 'Papá', category: 'familia', desiredFrequencyDays: 10, daysAgo: 8, type: 'mensaje' },
      { name: 'Abuela', category: 'familia', desiredFrequencyDays: 14, daysAgo: 15, type: 'llamada' },
      { name: 'Sofía', category: 'amigos', desiredFrequencyDays: 21, daysAgo: 12, type: 'salida' },
      { name: 'Juan', category: 'amigos', desiredFrequencyDays: 30, daysAgo: 74, type: 'mensaje' },
      { name: 'Pablo', category: 'amigos', desiredFrequencyDays: 21, daysAgo: 18, type: 'videollamada' },
      { name: 'Martín', category: 'trabajo', desiredFrequencyDays: 14, daysAgo: 3, type: 'mensaje' },
    ];

    const people: Person[] = [];
    const interactions: Interaction[] = [];
    const now = new Date();

    for (const item of demo) {
      const person: Person = {
        id: crypto.randomUUID(),
        name: item.name,
        category: item.category,
        desiredFrequencyDays: item.desiredFrequencyDays,
        createdAt: new Date(now.getTime() - 180 * 86_400_000).toISOString(),
      };
      people.push(person);

      const interactionDate = new Date(now);
      interactionDate.setDate(interactionDate.getDate() - item.daysAgo);
      interactions.push({
        id: crypto.randomUUID(),
        personId: person.id,
        type: item.type,
        date: interactionDate.toISOString(),
      });
    }

    this.persistPeople(people);
    this.persistInteractions(interactions);
  }

  private persistPeople(people: Person[]): void {
    this.peopleSignal.set(people);
    this.storage.set(PEOPLE_KEY, people);
  }

  private persistInteractions(interactions: Interaction[]): void {
    this.interactionsSignal.set(interactions);
    this.storage.set(INTERACTIONS_KEY, interactions);
  }
}
