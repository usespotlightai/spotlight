import type { JudgeClaimsPullRequest } from '@replays/domain/aggregates/judge-claims-pull-request.aggregate';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface JudgeClaimsPullRequestRepository {
  add(pullRequest: JudgeClaimsPullRequest): Promise<void>;

  save(pullRequest: JudgeClaimsPullRequest): Promise<void>;

  find(revisionId: string): Promise<JudgeClaimsPullRequest | null>;

  ofTeam(teamId: TeamId): Promise<readonly JudgeClaimsPullRequest[]>;

  nextDueJob(now: Date): Promise<JudgeClaimsPullRequest | null>;
}
