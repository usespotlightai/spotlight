import type { UserId } from '@domain/value-objects/user-id.vo';

export interface PersonSummary {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

export const PERSON_READER = Symbol('PERSON_READER');

export interface PersonReaderPort {
  find(id: UserId): Promise<PersonSummary | null>;
}
