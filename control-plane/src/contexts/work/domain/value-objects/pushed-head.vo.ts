import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export class PushedHead {
  private constructor(
    readonly repository: Repository,
    readonly commit: string,
    readonly pushedAt: Date,
  ) {}

  static of(
    repository: Repository,
    commit: string,
    pushedAt: Date,
  ): PushedHead {
    return new PushedHead(repository, commit, pushedAt);
  }

  isIn(repository: Repository): boolean {
    return this.repository.equals(repository);
  }
}
