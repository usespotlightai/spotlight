import { sameOrBothNone } from '@shared-kernel/domain/services/same-or-both-none';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';

export class WorkedRepository {
  private constructor(
    readonly repository: Repository,
    readonly image: RunnerImage | null,
    readonly setup: RepositorySetup | null,
  ) {}

  static of(
    repository: Repository,
    worked: { image?: RunnerImage | null; setup?: RepositorySetup | null } = {},
  ): WorkedRepository {
    return new WorkedRepository(
      repository,
      worked.image ?? null,
      worked.setup ?? null,
    );
  }

  equals(other: WorkedRepository): boolean {
    return (
      this.repository.equals(other.repository) &&
      sameOrBothNone(this.image, other.image) &&
      sameOrBothNone(this.setup, other.setup)
    );
  }
}
