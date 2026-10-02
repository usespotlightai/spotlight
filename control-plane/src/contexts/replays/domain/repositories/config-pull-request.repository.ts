import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ConfigPullRequestRepository {
  find(id: ConfigPullRequestId): Promise<ConfigPullRequest | null>;

  forCandidate(
    searchId: SearchId,
    candidateId: CandidateId,
  ): Promise<ConfigPullRequest | null>;

  ofSearch(searchId: SearchId): Promise<readonly ConfigPullRequest[]>;

  ofTeam(teamId: TeamId): Promise<readonly ConfigPullRequest[]>;

  due(now: Date): Promise<readonly ConfigPullRequest[]>;

  add(pullRequest: ConfigPullRequest): Promise<ConfigPullRequest>;

  save(pullRequest: ConfigPullRequest): Promise<void>;
}
