import { InvalidRepositoryError } from '@shared-kernel/domain/exceptions/invalid-repository.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

const MAX_LENGTH = 100;

const SHAPE = /^[A-Za-z0-9._-]+$/;

export class RepositoryName {
  private constructor(readonly value: string) {}

  static of(raw: string): RepositoryName {
    const named = RepositoryName.parsed(raw);

    if (!named) {
      throw new InvalidRepositoryError(
        `name "${raw}" must be 1 to ${MAX_LENGTH} letters, numbers, dots, dashes or underscores`,
      );
    }

    return named;
  }

  static parsed(raw: string): RepositoryName | null {
    const name = raw.trim().replace(/\.git$/, '');

    return name.length > 0 &&
      name.length <= MAX_LENGTH &&
      SHAPE.test(name) &&
      name !== '.' &&
      name !== '..'
      ? new RepositoryName(name)
      : null;
  }

  names(repository: Repository): boolean {
    return repository.name === this.value;
  }

  equals(other: RepositoryName): boolean {
    return this.value === other.value;
  }
}
