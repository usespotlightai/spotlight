import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

const SHA = /^[0-9a-f]{40}$/;

export class DecisionMerge {
  private constructor(
    readonly repository: Repository,
    readonly commit: string,
    readonly at: Date,
  ) {}

  static of(input: {
    repository: Repository;
    commit: string;
    at: Date;
  }): DecisionMerge {
    const commit = input.commit.trim().toLowerCase();

    if (!SHA.test(commit)) {
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
    return new DecisionMerge(input.repository, input.commit, input.at);
  }
}
