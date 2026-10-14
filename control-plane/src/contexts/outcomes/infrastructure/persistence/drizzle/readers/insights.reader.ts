import { Injectable } from '@nestjs/common';
import type {
  InsightsReaderPort,
  TeamInPeriod,
} from '@outcomes/application/ports/insights-reader.port';
import type { CostCountsInPeriod } from '@outcomes/domain/services/cost-breakdown';
import type { FlowCounts } from '@outcomes/domain/services/flow';
import type { OverviewCounts } from '@outcomes/domain/services/overview-counts';
import type { TeamCounts } from '@outcomes/domain/services/station-reports';
import { costCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/cost-counts.sql';
import { flowCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/flow-counts.sql';
import { overviewCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/overview-counts.sql';
import { stationCountsIn } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/station-counts.sql';
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
}
