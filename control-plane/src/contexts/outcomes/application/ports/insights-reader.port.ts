import type { CostCountsInPeriod } from '@outcomes/domain/services/cost-breakdown';
import type { FlowCounts } from '@outcomes/domain/services/flow';
import type { MemoryCounts } from '@outcomes/domain/services/memory-comparison';
import type { OverviewCounts } from '@outcomes/domain/services/overview-counts';
import type { PeopleCounts } from '@outcomes/domain/services/people-counts';
import type { RunSize } from '@outcomes/domain/services/run-size';
import type { SetupComparisonCounts } from '@outcomes/domain/services/setup-comparison';
import type { PipelineCounts } from '@outcomes/domain/services/shipping';
import type { TeamCounts } from '@outcomes/domain/services/station-reports';
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
}
