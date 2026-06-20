import { PersonCategory } from './person.model';

export interface ImportedPersonDraft {
  name: string;
  category: PersonCategory;
  desiredFrequencyDays: number;
  daysSinceLastContact: number | null;
  note?: string;
}

export interface AiImportResponse {
  people: ImportedPersonDraft[];
  aiAvailable: boolean;
}

export interface AiStatusResponse {
  redisReady: boolean;
  geminiReady: boolean;
  geminiModel: string;
}
