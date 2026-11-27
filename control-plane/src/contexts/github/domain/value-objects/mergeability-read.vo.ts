import type { PullRequestState } from '@github/domain/value-objects/pull-request-state.vo';

// What GitHub said about whether a pull request merges into its base. GitHub says null while it still computes it.
export class MergeabilityRead {
  private constructor(
    readonly state: PullRequestState,
    readonly mergeable: boolean | null,
    readonly branch: string | null,
    readonly base: string,
  ) {}

  static of(input: {
    state: PullRequestState;
    mergeable: boolean | null;
    branch: string | null;
    base: string;
  }): MergeabilityRead {
    return new MergeabilityRead(
      input.state,
      input.mergeable,
      input.branch,
      input.base,
    );
  }

  // Only an open pull request can conflict, so the mergeability of a closed one is not waited for.
  get pending(): boolean {
    return this.state === 'open' && this.mergeable === null;
  }
}
