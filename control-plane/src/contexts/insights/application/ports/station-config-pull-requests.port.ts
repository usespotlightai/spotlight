import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const STATION_CONFIG_PULL_REQUESTS = Symbol(
  'INSIGHTS_STATION_CONFIG_PULL_REQUESTS',
);

export interface ConfigPullRequestStation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly stationId: string;
}

export interface StationConfigPullRequestsPort {
  newestFor(
    station: ConfigPullRequestStation,
    fingerprints: readonly string[],
  ): Promise<ReadonlyMap<string, PullRequestUrl>>;
}
