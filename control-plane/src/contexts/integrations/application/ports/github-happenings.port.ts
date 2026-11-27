import type { Happened } from '@work/application/contracts/happenings.contract';

export const GITHUB_HAPPENINGS = Symbol('GITHUB_HAPPENINGS');

export interface ConflictedPullRequest {
  readonly pullRequest: string;
  readonly branch: string | null;
  readonly base: string;
}

export interface GitHubHappeningsPort {
  conflicted(conflict: ConflictedPullRequest): readonly Happened[];
}
