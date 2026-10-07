import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const COMMIT = /^[0-9a-f]{7,64}$/;

export class PlannedReference {
  private constructor(
    readonly commit: string | null,
    readonly pullRequest: number | null,
  ) {}

  static of(input: {
    commit?: string | null;
    pullRequest?: number | null;
  }): PlannedReference {
    const commit = input.commit?.trim().toLowerCase() || null;
    const pullRequest = input.pullRequest ?? null;

    if (commit !== null && !COMMIT.test(commit)) {
      throw new InvalidCandidateError(
        'commit must be a hex sha of 7 to 64 characters',
      );
    }
    if (
      pullRequest !== null &&
      (!Number.isInteger(pullRequest) || pullRequest < 1)
    ) {
      throw new InvalidCandidateError('pull request must be a number');
    }

    return new PlannedReference(commit, pullRequest);
  }

  get label(): string | null {
    if (this.pullRequest !== null) {
      return `PR #${this.pullRequest}`;
    }

    return this.commit?.slice(0, 7) ?? null;
  }

  equals(other: PlannedReference): boolean {
    return (
      this.commit === other.commit && this.pullRequest === other.pullRequest
    );
  }
}
