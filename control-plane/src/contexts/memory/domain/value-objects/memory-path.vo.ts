import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

const MAX_PATH = 500;

export class MemoryPath {
  private readonly kind = 'memory-path';

  private constructor(readonly value: string) {}

  static of(raw: string): MemoryPath {
    const parts = raw
      .trim()
      .replaceAll('\\', '/')
      .split('/')
      .filter((each) => each !== '' && each !== '.');
    const value = parts.join('/');

    if (!value || value.length > MAX_PATH || parts.includes('..')) {
      throw new InvalidMemoryError(
        `path must be at most ${MAX_PATH} characters`,
      );
    }

    return new MemoryPath(value);
  }

  covers(other: MemoryPath): boolean {
    return (
      other.value === this.value || other.value.startsWith(`${this.value}/`)
    );
  }

  equals(other: MemoryPath): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
