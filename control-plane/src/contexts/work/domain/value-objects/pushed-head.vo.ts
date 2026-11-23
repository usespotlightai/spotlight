import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { CommitSha } from '@work/domain/value-objects/commit-sha.vo';

export class PushedHead {
  private constructor(
    readonly repository: Repository,
    readonly commit: CommitSha,
    readonly pushedAt: Date,
    readonly holdsOthersCommits: boolean,
  ) {}

  static of(
    repository: Repository,
    commit: CommitSha,
    pushedAt: Date,
    holdsOthersCommits: boolean,
  ): PushedHead {
    return new PushedHead(repository, commit, pushedAt, holdsOthersCommits);
  }

  mayBeReplacedFrom(commit: CommitSha): boolean {
    return !this.holdsOthersCommits && this.commit.equals(commit);
  }

  isIn(repository: Repository): boolean {
    return this.repository.equals(repository);
  }
}
