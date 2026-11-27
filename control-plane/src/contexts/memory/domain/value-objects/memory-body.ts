import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

const MAX_BODY = 1_000;

export class MemoryBody {
  private readonly kind = 'memory-body';

  private constructor(readonly value: string) {}

  static of(raw: string): MemoryBody {
    const body = raw.trim();

    if (!body || body.length > MAX_BODY) {
      throw new InvalidMemoryError(`must be at most ${MAX_BODY} characters`);
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
