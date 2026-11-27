import { DuplicateRepositoryError } from '@lines/domain/exceptions/duplicate-repository.error';
import { MixedRunnerImagesError } from '@lines/domain/exceptions/mixed-runner-images.error';
import type { LineRepositoryConfig } from '@lines/domain/value-objects/line-repository-config.vo';
import { distinct } from '@shared-kernel/domain/distinct';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';

export class LineRepositories {
  private constructor(
    readonly entries: readonly LineRepositoryConfig[],
    readonly image: RunnerImage | null,
  ) {}

  static of(entries: readonly LineRepositoryConfig[]): LineRepositories {
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

  equals(other: LineRepositories): boolean {
    return (
      this.entries.length === other.entries.length &&
      this.entries.every((each) =>
        other.entries.some((theirs) => theirs.equals(each)),
      )
    );
  }
}
