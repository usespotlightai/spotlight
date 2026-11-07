import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { ConfigPullRequestState } from '@replays/domain/value-objects/config-pull-request-state';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface GitHubPullRequestKey {
  readonly gitHubId: number | null;
  readonly repository: string;
  readonly number: number;
}

export interface ConfigPullRequestRepository {
  find(id: ConfigPullRequestId): Promise<ConfigPullRequest | null>;

  forCandidate(
    searchId: SearchId,
    candidateId: CandidateId,
  ): Promise<ConfigPullRequest | null>;

  ofSearch(searchId: SearchId): Promise<readonly ConfigPullRequest[]>;

  findMany(
    ids: readonly ConfigPullRequestId[],
  ): Promise<readonly ConfigPullRequest[]>;

  ofTeam(teamId: TeamId): Promise<readonly ConfigPullRequest[]>;

  openAtStation(stationId: StationId): Promise<boolean>;

  fromGitHub(
    workspaceId: WorkspaceId,
    pullRequest: GitHubPullRequestKey,
  ): Promise<ConfigPullRequest | null>;

  openedOnLine(lineId: LineId): Promise<readonly ConfigPullRequest[]>;

  dueForCheck(
    checkedBefore: Date,
    limit: number,
  ): Promise<readonly ConfigPullRequest[]>;

  due(
    state: Extract<ConfigPullRequestState, 'opening' | 'closing'>,
    now: Date,
  ): Promise<readonly ConfigPullRequest[]>;

  add(pullRequest: ConfigPullRequest): Promise<void>;

  save(pullRequest: ConfigPullRequest): Promise<void>;
}
