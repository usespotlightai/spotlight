import { DuplicateRepositoryError } from '@domain/exceptions/duplicate-repository.error';
import { NoRepositoryError } from '@domain/exceptions/no-repository.error';
import type { Repository } from '@domain/value-objects/repository.vo';

export class LineRepositories {
  private constructor(private readonly repositories: readonly Repository[]) {}

  static of(repositories: readonly Repository[]): LineRepositories {
    const names = new Set<string>();

    for (const repository of repositories) {
      if (names.has(repository.name)) {
        throw new DuplicateRepositoryError(repository.name);
      }
      names.add(repository.name);
    }

    return new LineRepositories(repositories);
  }

  static none(): LineRepositories {
    return new LineRepositories([]);
  }

  get all(): readonly Repository[] {
    return this.repositories;
  }

  get isEmpty(): boolean {
    return this.repositories.length === 0;
  }

  named(name: string): Repository | null {
    return this.repositories.find((each) => each.name === name) ?? null;
  }

  opening(name: string | null): Repository {
    if (name) {
      const named = this.named(name);

      if (!named) {
        throw new NoRepositoryError(
          `This line works no repository named "${name}"`,
        );
      }

      return named;
    }

    const [only] = this.repositories;

    if (only && this.repositories.length === 1) {
      return only;
    }

    throw new NoRepositoryError(
      this.isEmpty
        ? undefined
        : 'This line works several repositories, so name which one',
    );
  }
}
