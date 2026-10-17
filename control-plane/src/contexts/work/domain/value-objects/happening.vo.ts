import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isDottedName } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class Happening {
  private constructor(readonly value: string) {}

  static of(raw: string): Happening {
    const trimmed = raw.trim();

    if (!isDottedName(trimmed)) {
      throw new InvalidIdentifierError(
        'happening',
        'must be an integration and a name, as in github.pull_request.merged',
      );
    }

    return new Happening(trimmed);
  }

  get integration(): string {
    return this.value.slice(0, this.value.indexOf('.'));
  }

  equals(other: Happening): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

type HappeningState = 'raised' | 'resolved';

export interface HappeningPayload {
  readonly happening: Happening;
  readonly summary: string;
  readonly answers: boolean;
  readonly state: HappeningState;
}
