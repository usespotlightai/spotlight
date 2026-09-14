import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

const SHAPE = /^[a-z0-9]+(\.[a-z0-9][a-z0-9_-]*)+$/;

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

export type HappeningState = 'raised' | 'resolved';

export interface Word {
  readonly happening: Happening;
  readonly told: string;
  readonly spoken: boolean;
  readonly state: HappeningState;
}
