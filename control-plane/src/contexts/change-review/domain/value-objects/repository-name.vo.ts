import { InvalidRepositoryNameError } from '@change-review/domain/exceptions/invalid-repository-name.error';

const MAX_LENGTH = 100;

export class RepositoryName {
  private constructor(readonly value: string) {}

  static of(raw: string): RepositoryName {
    const name = raw.trim();

    if (!name || name.length > MAX_LENGTH) {
      throw new InvalidRepositoryNameError(
        `must not be empty and must be at most ${MAX_LENGTH} characters`,
      );
    }

    if (name.includes('/') || name.includes('\\') || name.startsWith('.')) {
      throw new InvalidRepositoryNameError(
        `${name} is not a repository of the workspace`,
      );
    }

    return new RepositoryName(name);
  }

  equals(other: RepositoryName): boolean {
    return this.value === other.value;
  }
}
