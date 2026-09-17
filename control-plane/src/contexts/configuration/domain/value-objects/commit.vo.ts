import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

const SHAPE = /^[0-9a-f]{7,64}$/;

export class Commit {
  private readonly kind = 'commit';

  private constructor(readonly value: string) {}

  static of(raw: string): Commit {
    const named = raw.trim().toLowerCase();

    if (!SHAPE.test(named)) {
      throw new InvalidIdentifierError(
        'commit',
        'is the hexadecimal name a host gives one',
      );
    }

    return new Commit(named);
  }

  get short(): string {
    return this.value.slice(0, 7);
  }

  equals(other: Commit): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
