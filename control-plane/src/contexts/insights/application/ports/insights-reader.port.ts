import type {
  RunListing,
  TeamWindow,
} from '@insights/domain/repositories/run-record.repository';
import type { AgentConfigComparisonCounts } from '@insights/domain/services/agent-config-comparison';
import type { ChangeCounts } from '@insights/domain/services/before-after';
import type { CostCountsInPeriod } from '@insights/domain/services/cost-breakdown';
import type { FlowCounts } from '@insights/domain/services/flow';
import type { MemoryCounts } from '@insights/domain/services/memory-comparison';
import type { OverviewCounts } from '@insights/domain/services/overview-counts';
import type { PeopleCounts } from '@insights/domain/services/people-counts';
import type { PullRequestFilter } from '@insights/domain/services/pull-request-filter';
import type { PullRequestCounts } from '@insights/domain/services/pull-request-insights';
import type { RunSize } from '@insights/domain/services/run-size';
import type { ShippingCounts } from '@insights/domain/services/shipping';
import type { TeamCounts } from '@insights/domain/services/station-reports';
import type { TeamPullRequest } from '@insights/domain/services/team-pull-requests';
import type { ToolCounts } from '@insights/domain/services/tool-insights';
import type { CheckVerdict } from '@insights/domain/value-objects/check-verdict';
import type { HumanActionKind } from '@insights/domain/value-objects/human-action.vo';
import type { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type {
  Money,
  TokenCounts,
} from '@insights/domain/value-objects/run-usage.vo';
import type { TaskPullRequestState } from '@insights/domain/value-objects/task-pull-request-state';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const INSIGHTS_READER = Symbol('INSIGHTS_READER');

export interface TeamInPeriod {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly period: InsightsPeriod;
}

export interface AgentConfigFilter {
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
  readonly cost: Money | null;
  readonly tokens: TokenCounts | null;
  readonly errors: number | null;
  readonly ending: RunEnding;
  readonly failure: string | null;
  readonly checks: CheckVerdict | null;
  readonly firstHumanAction: {
    readonly kind: HumanActionKind;
    readonly at: Date;
  } | null;
  readonly passed: { readonly to: string; readonly at: Date } | null;
  readonly pullRequestState: TaskPullRequestState | null;
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
  agentConfigCounts(
    team: TeamInPeriod,
    filter: AgentConfigFilter,
  ): Promise<AgentConfigComparisonCounts>;
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
  runsPerTask(
    window: TeamWindow,
    taskIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>>;
}
