import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/**
 * Named by its source first, so two hosts raising the same idea raise two
 * words and never quietly the same one.
 */
const SHAPE = /^[a-z0-9]+(\.[a-z0-9][a-z0-9_-]*)+$/;

/**
 * Something that happened outside Spotlight, in Spotlight's words. Which
 * words there are is not written here: a source declares what it raises, and
 * a station can only be set to wait for one somebody actually says.
 */
export class Happening {
  private constructor(readonly value: string) {}

  static of(raw: string): Happening {
    const trimmed = raw.trim();

    if (!SHAPE.test(trimmed)) {
      throw new InvalidIdentifierError(
        'happening',
        'is its source and its name, as in github.pull_request.merged',
      );
    }

    return new Happening(trimmed);
  }

  /** Which source raises it, which is the part before the first stop. */
  get source(): string {
    return this.value.slice(0, this.value.indexOf('.'));
  }

  equals(other: Happening): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Whether the world is saying a thing began or that it is over. A merge only
 * ever happens; an alert fires and later clears.
 */
export type HappeningState = 'raised' | 'resolved';

/**
 * What a source says happened: which word it is, how to tell it in a note,
 * and whether it is a person speaking rather than the world reporting itself.
 */
export interface Word {
  readonly happening: Happening;
  readonly told: string;
  /** A merge or a broken build tells itself. Only words answer what was asked. */
  readonly spoken: boolean;
  readonly state: HappeningState;
}
