import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';

const MAX_LENGTH = 100;

export class RepositoryName {
  private constructor(readonly value: string) {}

  static of(raw: string): RepositoryName {
    const name = raw.trim();

    if (!name || name.length > MAX_LENGTH) {
      throw InvalidChangeStackError.because(
        `repository name must be at most ${MAX_LENGTH} characters`,
      );
    }

    if (name.includes('/') || name.includes('\\') || name.startsWith('.')) {
      throw InvalidChangeStackError.because(
        `repository ${name} is not one the workspace holds`,
      );
    }

    return new RepositoryName(name);
  }

  equals(other: RepositoryName): boolean {
    return this.value === other.value;
  }
}
