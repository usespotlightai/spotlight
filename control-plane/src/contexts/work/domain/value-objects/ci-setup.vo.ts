import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export type CiVariables = 'written' | 'not-permitted';

export class CiSetup {
  private constructor(
    readonly defaultBranch: string,
    readonly defaultBranchProtected: boolean,
    readonly pullRequestsTrustId: string,
    readonly defaultBranchTrustId: string,
    readonly variables: CiVariables,
  ) {}

  static of(input: {
    defaultBranch: string;
    defaultBranchProtected: boolean;
    pullRequestsTrustId: string;
    defaultBranchTrustId: string;
    variables: CiVariables;
  }): CiSetup {
    if (
      input.defaultBranch.trim() === '' ||
      input.pullRequestsTrustId === '' ||
      input.defaultBranchTrustId === ''
    ) {
      throw new InconsistentStateError(
        'CI setup',
        'names no default branch or no trust',
      );
    }

    return new CiSetup(
      input.defaultBranch,
      input.defaultBranchProtected,
      input.pullRequestsTrustId,
      input.defaultBranchTrustId,
      input.variables,
    );
  }

  equals(other: CiSetup): boolean {
    return (
      this.defaultBranch === other.defaultBranch &&
      this.defaultBranchProtected === other.defaultBranchProtected &&
      this.pullRequestsTrustId === other.pullRequestsTrustId &&
      this.defaultBranchTrustId === other.defaultBranchTrustId &&
      this.variables === other.variables
    );
  }
}
