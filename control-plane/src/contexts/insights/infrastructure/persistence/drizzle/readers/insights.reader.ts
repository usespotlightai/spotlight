import type {
  AgentConfigFilter,
  InsightsReaderPort,
  PullRequestListing,
  PullRequestPage,
  RunsListed,
  TeamInPeriod,
} from '@insights/application/ports/insights-reader.port';
import type { RunListing } from '@insights/domain/repositories/run-record.repository';
import type { AgentConfigComparisonCounts } from '@insights/domain/services/agent-config-comparison';
import type { ChangeCounts } from '@insights/domain/services/before-after';
import type { CostCountsInPeriod } from '@insights/domain/services/cost-breakdown';
import type { FlowCounts } from '@insights/domain/services/flow';
import type { MemoryCounts } from '@insights/domain/services/memory-comparison';
import type { OverviewCounts } from '@insights/domain/services/overview-counts';
import type { PeopleCounts } from '@insights/domain/services/people-counts';
import type { PullRequestCounts } from '@insights/domain/services/pull-request-insights';
import type { ShippingCounts } from '@insights/domain/services/shipping';
import type { TeamCounts } from '@insights/domain/services/station-reports';
import type { ToolCounts } from '@insights/domain/services/tool-insights';
import { agentConfigCountsIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/agent-config-counts.sql';
import { changeCountsIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/change-counts.sql';
import { costCountsIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/cost-counts.sql';
import { flowCountsIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/flow-counts.sql';
import { memoryCountsIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/memory-counts.sql';
import { overviewCountsIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/overview-counts.sql';
import { peopleCountsIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/people-counts.sql';
import { pullRequestCountsIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/pull-request-counts.sql';
import { pullRequestPageIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/pull-request-page.sql';
import { runPageIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/run-page.sql';
import { shippingCountsIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/shipping-counts.sql';
import { stationCountsIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/station-counts.sql';
import { toolCountsIn } from '@insights/infrastructure/persistence/drizzle/readers/insights/tool-counts.sql';
import { Injectable } from '@nestjs/common';
import { DrizzleReading } from '@platform/persistence/drizzle/drizzle.reading';

@Injectable()
export class DrizzleInsightsReader implements InsightsReaderPort {
  constructor(private readonly reading: DrizzleReading) {}

  stationCounts(team: TeamInPeriod): Promise<TeamCounts> {
    return this.reading.read((db) => stationCountsIn(db, team));
  }

  overviewCounts(team: TeamInPeriod): Promise<OverviewCounts> {
    return this.reading.read((db) => overviewCountsIn(db, team));
  }

  costCounts(team: TeamInPeriod): Promise<CostCountsInPeriod> {
    return this.reading.read((db) => costCountsIn(db, team));
  }

  flowCounts(team: TeamInPeriod): Promise<FlowCounts> {
    return this.reading.read((db) => flowCountsIn(db, team));
  }

  peopleCounts(team: TeamInPeriod): Promise<PeopleCounts> {
    return this.reading.read((db) => peopleCountsIn(db, team));
  }

  toolCounts(team: TeamInPeriod): Promise<ToolCounts> {
    return this.reading.read((db) => toolCountsIn(db, team));
  }

  memoryCounts(team: TeamInPeriod): Promise<MemoryCounts> {
    return this.reading.read((db) => memoryCountsIn(db, team));
  }

  agentConfigCounts(
    team: TeamInPeriod,
    filter: AgentConfigFilter,
  ): Promise<AgentConfigComparisonCounts> {
    return this.reading.read((db) => agentConfigCountsIn(db, team, filter));
  }

  changeCounts(team: TeamInPeriod): Promise<readonly ChangeCounts[]> {
    return this.reading.read((db) => changeCountsIn(db, team));
  }

  pullRequestCounts(
    team: TeamInPeriod,
    repositories: readonly string[],
  ): Promise<PullRequestCounts> {
    return this.reading.read((db) =>
      pullRequestCountsIn(db, team, repositories),
    );
  }

  pullRequestPage(
    team: TeamInPeriod,
    listing: PullRequestListing,
  ): Promise<PullRequestPage> {
    return this.reading.read((db) => pullRequestPageIn(db, team, listing));
  }

  shippingCounts(
    team: TeamInPeriod,
    repositories: readonly string[],
  ): Promise<ShippingCounts> {
    return this.reading.read((db) => shippingCountsIn(db, team, repositories));
  }

  runPage(listing: RunListing): Promise<RunsListed> {
    return this.reading.read((db) => runPageIn(db, listing));
  }
}
