import {
  type InsightsStationsDto,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { ReadInsightsStationsQuery } from '@outcomes/application/queries/read-insights-stations.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import { runTally } from '@outcomes/domain/services/run-tally';
import { stationReportsOf } from '@outcomes/domain/services/station-reports';
import { endedWithin } from '@outcomes/domain/services/team-history';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsStationsHandler
  implements QueryHandlerPort<ReadInsightsStationsQuery, InsightsStationsDto>
{
  constructor(private readonly histories: TeamHistories) {}

  async execute(
    query: ReadInsightsStationsQuery,
  ): Promise<InsightsStationsDto> {
    try {
      const { period, history, truncated } = await this.histories.of(
        query.teamId,
        query.principal,
        query.period,
      );

      return {
        period: periodOf(period),
        truncated,
        team: runTally(
          endedWithin(history.records, period.current),
          history.deliveries,
        ),
        teamBefore: runTally(
          endedWithin(history.records, period.previous),
          history.deliveries,
        ),
        stations: stationReportsOf(history, period),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
