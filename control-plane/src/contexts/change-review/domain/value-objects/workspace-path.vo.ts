import { InvalidFilePathError } from '@change-review/domain/exceptions/invalid-file-path.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export class WorkspacePath {
  private constructor(readonly value: string) {}

  static of(raw: string): WorkspacePath {
    const value = raw.trim().replace(/^\/+/, '');

    if (!value) {
      throw new InvalidFilePathError('must not be empty');
    }

    return new WorkspacePath(value);
  }

  static inRepository(repository: Repository, relative: string): WorkspacePath {
    const parts = relative
      .trim()
      .split('/')
      .filter((part) => part && part !== '.');

    if (parts.length === 0 || parts.includes('..')) {
      throw new InvalidFilePathError(
        `must be inside the repository, not ${relative.trim() || 'nothing'}`,
      );
    }

    return new WorkspacePath([repository.name, ...parts].join('/'));
  }

  withinRepository(repository: Repository): string {
    const [checkout, ...within] = this.value.split('/');

    return checkout === repository.name && within.length > 0
      ? within.join('/')
      : this.value;
  }

  covers(path: string): boolean {
    return path === this.value || path.startsWith(`${this.value}/`);
  }

  equals(other: WorkspacePath): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
