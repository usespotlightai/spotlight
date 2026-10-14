import { Injectable } from '@nestjs/common';
import type {
  InsightsReaderPort,
  TeamInPeriod,
} from '@outcomes/application/ports/insights-reader.port';
import type { CostCountsInPeriod } from '@outcomes/domain/services/cost-breakdown';
import type { FlowCounts } from '@outcomes/domain/services/flow';
import type { MemoryCounts } from '@outcomes/domain/services/memory-comparison';
import type { OverviewCounts } from '@outcomes/domain/services/overview-counts';
import type { PeopleCounts } from '@outcomes/domain/services/people-counts';
import type { PipelineCounts } from '@outcomes/domain/services/shipping';
import type { TeamCounts } from '@outcomes/domain/services/station-reports';
import type { ToolCounts } from '@outcomes/domain/services/tool-insights';
import { costCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/cost-counts.sql';
import { flowCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/flow-counts.sql';
import { memoryCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/memory-counts.sql';
import { overviewCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/overview-counts.sql';
import { peopleCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/people-counts.sql';
import { pipelineCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/pipeline-counts.sql';
import { stationCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/station-counts.sql';
import { toolCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/tool-counts.sql';
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

  pipelineCounts(
    team: TeamInPeriod,
    taskIds: readonly string[],
  ): Promise<PipelineCounts> {
    return this.reading.read((db) => pipelineCountsIn(db, team, taskIds));
  }

  toolCounts(team: TeamInPeriod): Promise<ToolCounts> {
    return this.reading.read((db) => toolCountsIn(db, team));
  }

  memoryCounts(team: TeamInPeriod): Promise<MemoryCounts> {
    return this.reading.read((db) => memoryCountsIn(db, team));
  }
}
