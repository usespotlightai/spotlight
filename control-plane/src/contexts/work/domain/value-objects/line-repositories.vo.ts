import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';

export interface LineRepository {
  readonly repository: Repository;
  readonly setup: string | null;
}

export class LineRepositories {
  private constructor(
    readonly entries: readonly LineRepository[],
    readonly image: RunnerImage | null,
  ) {}

  static of(
    entries: readonly LineRepository[],
    image: RunnerImage | null,
  ): LineRepositories {
    return new LineRepositories([...entries], image);
  }

  static none(): LineRepositories {
    return new LineRepositories([], null);
  }

  get all(): readonly Repository[] {
    return this.entries.map((each) => each.repository);
  }

  get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  setupOf(repository: Repository): string | null {
    return (
      this.entries.find((each) => each.repository.equals(repository))?.setup ??
      null
    );
  }

  names(repository: Repository): boolean {
    return this.all.some((each) => each.equals(repository));
  }

  named(name: string): Repository | null {
    return this.all.find((each) => each.name === name) ?? null;
  }

  opening(name: string | null): Repository {
    if (name) {
      const named = this.named(name);

      if (!named) {
        throw new NoRepositoryError(`Line has no repository named ${name}.`);
      }

      return named;
    }

    const [only] = this.all;

    if (only && this.entries.length === 1) {
      return only;
    }

    throw new NoRepositoryError(
      this.isEmpty
        ? undefined
        : 'Line has several repositories. Please name one.',
    );
  }
}
