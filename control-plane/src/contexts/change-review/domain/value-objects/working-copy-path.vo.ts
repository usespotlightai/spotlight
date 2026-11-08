import { InvalidFilePathError } from '@change-review/domain/exceptions/invalid-file-path.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export class WorkingCopyPath {
  private constructor(readonly value: string) {}

  static of(raw: string): WorkingCopyPath {
    const value = raw.trim().replace(/^\/+/, '');

    if (!value) {
      throw new InvalidFilePathError('must not be empty');
    }

    return new WorkingCopyPath(value);
  }

  static inRepository(
    repository: Repository,
    relative: string,
  ): WorkingCopyPath {
    const parts = relative
      .trim()
      .split('/')
      .filter((part) => part && part !== '.');

    if (parts.length === 0 || parts.includes('..')) {
      throw new InvalidFilePathError(
        `must be inside the repository, not ${relative.trim() || 'nothing'}`,
      );
    }

    return new WorkingCopyPath([repository.name, ...parts].join('/'));
  }

  isWithin(repository: Repository): boolean {
    const [checkout, ...within] = this.value.split('/');

    return (
      within.length > 0 &&
      checkout?.toLowerCase() === repository.name.toLowerCase()
    );
  }

  withinRepository(repository: Repository): string {
    return this.isWithin(repository)
      ? this.value.split('/').slice(1).join('/')
      : this.value;
  }

  covers(path: string): boolean {
    return path === this.value || path.startsWith(`${this.value}/`);
  }

  equals(other: WorkingCopyPath): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
