import type { Concerns } from '@domain/value-objects/concerns.vo';
import type { Happening } from '@domain/value-objects/happening.vo';
import type { Said } from '@domain/value-objects/said.vo';

export const REPOSITORY_EVENTS = Symbol('REPOSITORY_EVENTS');

export interface Happened {
  readonly happening: Happening;
  readonly concerns: Concerns;
  /** What was said, where anything was: the note the station works from. */
  readonly said: Said | null;
  readonly ourOwn: boolean;
}

/** Where the host's language is read into Spotlight's. */
export interface RepositoryEventsPort {
  read(event: string | undefined, payload: unknown): Happened | null;
}
