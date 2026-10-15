import type { ChangeCounts } from '@outcomes/domain/services/before-after';
import type { CostCountsInPeriod } from '@outcomes/domain/services/cost-breakdown';
import type { FlowCounts } from '@outcomes/domain/services/flow';
import type { MemoryCounts } from '@outcomes/domain/services/memory-comparison';
import type { OverviewCounts } from '@outcomes/domain/services/overview-counts';
import type { PeopleCounts } from '@outcomes/domain/services/people-counts';
import type { PullRequestFilter } from '@outcomes/domain/services/pull-request-filter';
import type { PullRequestCounts } from '@outcomes/domain/services/pull-request-insights';
import type { RunSize } from '@outcomes/domain/services/run-size';
import type { SetupComparisonCounts } from '@outcomes/domain/services/setup-comparison';
import type { PipelineCounts } from '@outcomes/domain/services/shipping';
import type { TeamCounts } from '@outcomes/domain/services/station-reports';
import type { TeamPullRequest } from '@outcomes/domain/services/team-pull-requests';
import type { ToolCounts } from '@outcomes/domain/services/tool-insights';
import type { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const INSIGHTS_READER = Symbol('OUTCOMES_INSIGHTS_READER');

export interface TeamInPeriod {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly period: InsightsPeriod;
}

export interface SetupFilter {
  readonly stationId: string | null;
  readonly size: RunSize | null;
}

export interface PullRequestReach {
  readonly repositories: readonly string[];
  readonly from: Date;
  readonly most: number;
}

export interface PullRequestsAsked {
  readonly filter: PullRequestFilter;
  readonly page: number;
  readonly size: number;
}

export interface PullRequestListing extends PullRequestsAsked {
  readonly repositories: readonly string[];
}

export interface PullRequestPage {
  readonly total: number;
  readonly pullRequests: readonly TeamPullRequest[];
}

export interface InsightsReaderPort {
  stationCounts(team: TeamInPeriod): Promise<TeamCounts>;
  overviewCounts(team: TeamInPeriod): Promise<OverviewCounts>;
  costCounts(team: TeamInPeriod): Promise<CostCountsInPeriod>;
  flowCounts(team: TeamInPeriod): Promise<FlowCounts>;
  peopleCounts(team: TeamInPeriod): Promise<PeopleCounts>;
  pipelineCounts(
    team: TeamInPeriod,
    taskIds: readonly string[],
  ): Promise<PipelineCounts>;
  toolCounts(team: TeamInPeriod): Promise<ToolCounts>;
  memoryCounts(team: TeamInPeriod): Promise<MemoryCounts>;
  setupCounts(
    team: TeamInPeriod,
    filter: SetupFilter,
  ): Promise<SetupComparisonCounts>;
  changeCounts(team: TeamInPeriod): Promise<readonly ChangeCounts[]>;
  pullRequests(
    team: TeamInPeriod,
    reach: PullRequestReach,
  ): Promise<readonly TeamPullRequest[]>;
  pullRequestCounts(
    team: TeamInPeriod,
    repositories: readonly string[],
  ): Promise<PullRequestCounts>;
  pullRequestPage(
    team: TeamInPeriod,
    listing: PullRequestListing,
  ): Promise<PullRequestPage>;
}
