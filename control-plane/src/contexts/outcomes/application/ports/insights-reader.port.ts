import type { RunListing } from '@outcomes/domain/repositories/run-record.repository';
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
import type { ShippingCounts } from '@outcomes/domain/services/shipping';
import type { TeamCounts } from '@outcomes/domain/services/station-reports';
import type { TeamPullRequest } from '@outcomes/domain/services/team-pull-requests';
import type { ToolCounts } from '@outcomes/domain/services/tool-insights';
import type { CheckVerdict } from '@outcomes/domain/value-objects/check-verdict';
import type { DeliveryState } from '@outcomes/domain/value-objects/delivery-state';
import type { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import type { PersonAct } from '@outcomes/domain/value-objects/next-act.vo';
import type {
  Spend,
  TokenCounts,
} from '@outcomes/domain/value-objects/run-cost.vo';
import type { RunEnding } from '@outcomes/domain/value-objects/run-ending';
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

export interface PullRequestsQuery {
  readonly filter: PullRequestFilter;
  readonly page: number;
  readonly size: number;
}

export interface PullRequestListing extends PullRequestsQuery {
  readonly repositories: readonly string[];
}

export interface PullRequestPage {
  readonly total: number;
  readonly pullRequests: readonly TeamPullRequest[];
}

export interface ListedRun {
  readonly runId: string;
  readonly taskId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly fingerprint: string | null;
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profileKey: string | null;
  readonly repositories: readonly string[];
  readonly openedBy: string | null;
  readonly queuedAt: Date | null;
  readonly startedAt: Date | null;
  readonly endedAt: Date;
  readonly queuedMs: number | null;
  readonly runningMs: number | null;
  readonly ms: number | null;
  readonly cost: Spend | null;
  readonly tokens: TokenCounts | null;
  readonly ending: RunEnding;
  readonly failure: string | null;
  readonly checks: CheckVerdict | null;
  readonly next: { readonly act: PersonAct; readonly at: Date } | null;
  readonly passed: { readonly to: string; readonly at: Date } | null;
  readonly delivery: DeliveryState | null;
}

export interface RunsListed {
  readonly total: number;
  readonly runs: readonly ListedRun[];
}

export interface InsightsReaderPort {
  stationCounts(team: TeamInPeriod): Promise<TeamCounts>;
  overviewCounts(team: TeamInPeriod): Promise<OverviewCounts>;
  costCounts(team: TeamInPeriod): Promise<CostCountsInPeriod>;
  flowCounts(team: TeamInPeriod): Promise<FlowCounts>;
  peopleCounts(team: TeamInPeriod): Promise<PeopleCounts>;
  toolCounts(team: TeamInPeriod): Promise<ToolCounts>;
  memoryCounts(team: TeamInPeriod): Promise<MemoryCounts>;
  setupCounts(
    team: TeamInPeriod,
    filter: SetupFilter,
  ): Promise<SetupComparisonCounts>;
  changeCounts(team: TeamInPeriod): Promise<readonly ChangeCounts[]>;
  pullRequestCounts(
    team: TeamInPeriod,
    repositories: readonly string[],
  ): Promise<PullRequestCounts>;
  pullRequestPage(
    team: TeamInPeriod,
    listing: PullRequestListing,
  ): Promise<PullRequestPage>;
  shippingCounts(
    team: TeamInPeriod,
    repositories: readonly string[],
  ): Promise<ShippingCounts>;
  runPage(listing: RunListing): Promise<RunsListed>;
}
