import { sameOrBothNone } from '@shared-kernel/domain/services/same-or-both-none';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';

export class LineRepositoryConfig {
  private constructor(
    readonly repository: Repository,
    readonly image: RunnerImage | null,
    readonly setup: RepositorySetup | null,
  ) {}

  static of(
    repository: Repository,
    config: { image?: RunnerImage | null; setup?: RepositorySetup | null } = {},
  ): LineRepositoryConfig {
    return new LineRepositoryConfig(
      repository,
      config.image ?? null,
      config.setup ?? null,
    );
  }

  equals(other: LineRepositoryConfig): boolean {
    return (
      this.repository.equals(other.repository) &&
      sameOrBothNone(this.image, other.image) &&
      sameOrBothNone(this.setup, other.setup)
    );
  }
}
