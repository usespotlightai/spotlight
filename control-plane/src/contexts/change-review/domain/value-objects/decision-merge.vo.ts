import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export class DecisionMerge {
  private constructor(
    readonly repository: Repository,
    readonly commit: CommitSha,
    readonly at: Date,
  ) {}

  static of(input: {
    repository: Repository;
    commit: string;
    at: Date;
  }): DecisionMerge {
    const commit = CommitSha.parsed(input.commit);

    if (!commit) {
      throw new InvalidDecisionError(
        'merge must be a full 40-character commit hash',
      );
    }

    return new DecisionMerge(input.repository, commit, input.at);
  }

  static rehydrate(input: {
    repository: Repository;
    commit: string;
    at: Date;
  }): DecisionMerge {
    const commit = CommitSha.parsed(input.commit);

    if (!commit) {
      throw new InconsistentStateError(
        'decision set',
        `was merged at ${input.commit}, which is not a commit hash`,
      );
    }

    return new DecisionMerge(input.repository, commit, input.at);
  }
}
