import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';

const MOST_LENGTH = 100;

export class RepositoryName {
  private constructor(readonly value: string) {}

  static of(raw: string): RepositoryName {
    const name = raw.trim();

    if (!name || name.length > MOST_LENGTH) {
      throw InvalidChangeStackError.because(
        `names a repository of at most ${MOST_LENGTH} characters`,
      );
    }

    if (name.includes('/') || name.includes('\\') || name.startsWith('.')) {
      throw InvalidChangeStackError.because(
        `names ${name}, which is not a repository as the workspace holds it`,
      );
    }

    return new RepositoryName(name);
  }

  equals(other: RepositoryName): boolean {
    return this.value === other.value;
  }
}
