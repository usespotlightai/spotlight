import { InvalidRepositoryError } from '@shared-kernel/domain/exceptions/invalid-repository.error';

const SEPARATOR = '/';
const MAX_LENGTH = 100;
const SHAPE = /^[A-Za-z0-9._-]+$/;

export class Repository {
  private constructor(
    readonly owner: string,
    readonly name: string,
  ) {}

  static of(raw: string): Repository {
    const parts = raw.trim().split(SEPARATOR);

    if (parts.length !== 2) {
      throw new InvalidRepositoryError('must be named owner/name');
    }

    const [owner, name] = parts as [string, string];

    for (const part of [owner, name]) {
      if (part.length === 0 || part.length > MAX_LENGTH) {
        throw new InvalidRepositoryError(
          `owner and name must each be at most ${MAX_LENGTH} characters`,
        );
      }
      if (!SHAPE.test(part) || part === '.' || part === '..') {
        throw new InvalidRepositoryError(
          'may only contain letters, numbers, dots, dashes and underscores',
        );
      }
    }

    return new Repository(owner, name.replace(/\.git$/, ''));
  }

  get value(): string {
    return `${this.owner}${SEPARATOR}${this.name}`;
  }

  equals(other: Repository): boolean {
    return this.value === other.value;
  }
}
