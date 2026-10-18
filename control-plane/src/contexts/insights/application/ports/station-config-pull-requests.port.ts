import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface StationConfigPullRequest {
  readonly configPullRequestId: string;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly stationId: string;
  readonly fingerprint: string;
  readonly url: PullRequestUrl;
  readonly openedAt: Date;
}

export interface ConfigPullRequestStation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly stationId: string;
}

export interface StationConfigPullRequestsPort {
  note(pullRequest: StationConfigPullRequest): Promise<void>;

  newestFor(
    station: ConfigPullRequestStation,
    fingerprints: readonly string[],
  ): Promise<ReadonlyMap<string, PullRequestUrl>>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
