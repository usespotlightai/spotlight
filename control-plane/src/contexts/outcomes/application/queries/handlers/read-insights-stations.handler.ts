import {
  type InsightsStationsDto,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { ReadInsightsStationsQuery } from '@outcomes/application/queries/read-insights-stations.query';
import type { TeamScopes } from '@outcomes/application/services/team-scopes.service';
import { tallyCountedOf } from '@outcomes/domain/services/run-tally';
import {
  stationReportsFrom,
  teamReportFrom,
} from '@outcomes/domain/services/station-reports';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsStationsHandler
  implements QueryHandlerPort<ReadInsightsStationsQuery, InsightsStationsDto>
{
  constructor(
    private readonly histories: TeamScopes,
    private readonly reader: InsightsReaderPort,
  ) {}

  async execute(
    query: ReadInsightsStationsQuery,
  ): Promise<InsightsStationsDto> {
    try {
      const { clearance, period } = await this.histories.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const counts = await this.reader.stationCounts({
        workspaceId: clearance.workspaceId,
        teamId: clearance.teamId,
        period,
      });
      const team = teamReportFrom(counts, period);

      return {
        period: periodOf(period),
        team: team.tally,
        teamChanges: team.changes,
        teamSeen: team.seen,
        teamCounted: tallyCountedOf(team.tally),
        teamTrend: team.trend,
        stations: stationReportsFrom(counts, period),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
