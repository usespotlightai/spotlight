import type { CostCountsInPeriod } from '@outcomes/domain/services/cost-breakdown';
import type { OverviewCounts } from '@outcomes/domain/services/overview-counts';
import type { TeamCounts } from '@outcomes/domain/services/station-reports';
import type { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const INSIGHTS_READER = Symbol('OUTCOMES_INSIGHTS_READER');

export interface TeamInPeriod {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly period: InsightsPeriod;
}

export interface InsightsReaderPort {
  stationCounts(team: TeamInPeriod): Promise<TeamCounts>;
  overviewCounts(team: TeamInPeriod): Promise<OverviewCounts>;
  costCounts(team: TeamInPeriod): Promise<CostCountsInPeriod>;
}
