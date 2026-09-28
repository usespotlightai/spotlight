import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

const MOST_BODY = 1_000;

export class MemoryBody {
  private readonly kind = 'memory-body';

  private constructor(readonly value: string) {}

  static of(raw: string): MemoryBody {
    const body = raw.trim();

    if (!body || body.length > MOST_BODY) {
      throw new InvalidMemoryError(
        `says what is remembered in at most ${MOST_BODY} characters`,
      );
    }

    return new MemoryBody(body);
  }

  get length(): number {
    return this.value.length;
  }

  equals(other: MemoryBody): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
