import { Injectable } from '@angular/core';
import {
  ConnectionStatus,
  Interaction,
  Person,
  PersonWithStatus,
  STATUS_LABELS,
} from '../models/person.model';

@Injectable({ providedIn: 'root' })
export class RelationshipStatusService {
  daysSince(dateIso: string): number {
    const then = new Date(dateIso);
    const now = new Date();
    then.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
  }

  getLastInteraction(
    personId: string,
    interactions: Interaction[],
  ): Interaction | undefined {
    return interactions
      .filter((i) => i.personId === personId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }

  getStatus(daysSinceContact: number, desiredDays: number): ConnectionStatus {
    if (desiredDays <= 0) return 'well';
    const ratio = daysSinceContact / desiredDays;
    if (ratio <= 1) return 'well';
    if (ratio <= 1.5) return 'soon';
    if (ratio <= 2) return 'reconnect';
    return 'attention';
  }

  enrichPerson(person: Person, interactions: Interaction[]): PersonWithStatus {
    const lastInteraction = this.getLastInteraction(person.id, interactions);
    const daysSinceContact = lastInteraction
      ? this.daysSince(lastInteraction.date)
      : this.daysSince(person.createdAt);
    const status = this.getStatus(daysSinceContact, person.desiredFrequencyDays);
    const attentionRatio =
      person.desiredFrequencyDays > 0
        ? daysSinceContact / person.desiredFrequencyDays
        : 0;

    return {
      ...person,
      lastInteraction,
      daysSinceContact,
      status,
      statusLabel: STATUS_LABELS[status],
      attentionRatio,
    };
  }

  enrichAll(people: Person[], interactions: Interaction[]): PersonWithStatus[] {
    return people.map((p) => this.enrichPerson(p, interactions));
  }
}
