import { DuplicateRepositoryError } from '@domain/exceptions/duplicate-repository.error';
import { NoRepositoryError } from '@domain/exceptions/no-repository.error';
import type { Repository } from '@domain/value-objects/repository.vo';

/**
 * The repositories a line works in, held together so what is true of them
 * together is true here rather than wherever they happen to be read.
 *
 * A name is the directory a repository is cloned into and the key it is
 * reached by, so two of one name would collide: that cannot be constructed.
 */
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

  /**
   * Which repository a pull request opens against. The agent names one where
   * the line works several; where it works exactly one, that is the only
   * answer and naming it is not asked of the agent; where it works none, there
   * is nothing to open.
   */
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
