import { distinct } from '@shared-kernel/domain/services/distinct';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { DuplicateRepositoryError } from '@work/domain/exceptions/duplicate-repository.error';
import { MixedRunnerImagesError } from '@work/domain/exceptions/mixed-runner-images.error';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import type { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import type { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';

export class LineRepositories {
  private constructor(
    readonly entries: readonly WorkedRepository[],
    readonly image: RunnerImage | null,
  ) {}

  static of(entries: readonly WorkedRepository[]): LineRepositories {
    const names = new Set<string>();

    for (const { repository } of entries) {
      if (names.has(repository.name)) {
        throw new DuplicateRepositoryError(repository.name);
      }
      names.add(repository.name);
    }

    const images = distinct(
      entries.flatMap((each) => (each.image ? [each.image] : [])),
    );

    if (images.length > 1) {
      throw new MixedRunnerImagesError(images.map((each) => each.value));
    }

    return new LineRepositories(entries, images[0] ?? null);
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

  setupOf(repository: Repository): RepositorySetup | null {
    return (
      this.entries.find((each) => each.repository.equals(repository))?.setup ??
      null
    );
  }

  equals(other: LineRepositories): boolean {
    return (
      this.entries.length === other.entries.length &&
      this.entries.every((each) =>
        other.entries.some((theirs) => theirs.equals(each)),
      )
    );
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
