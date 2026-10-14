import { Injectable } from '@nestjs/common';
import type {
  InsightsReaderPort,
  TeamInPeriod,
} from '@outcomes/application/ports/insights-reader.port';
import type { OverviewCounts } from '@outcomes/domain/services/overview-counts';
import type { TeamCounts } from '@outcomes/domain/services/station-reports';
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
}
