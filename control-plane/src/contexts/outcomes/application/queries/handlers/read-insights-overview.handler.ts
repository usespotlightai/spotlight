import {
  dayOutputDtoOf,
  headlineDtoOf,
  type InsightsOverviewDto,
  namedOf,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { PeoplePort } from '@outcomes/application/ports/people.port';
import type { ReadInsightsOverviewQuery } from '@outcomes/application/queries/read-insights-overview.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import {
  dailyOutputFrom,
  outputCurrencyOf,
} from '@outcomes/domain/services/daily-output';
import {
  headlineChangesOf,
  headlineFrom,
} from '@outcomes/domain/services/headline';
import { stationsWorthImprovingFrom } from '@outcomes/domain/services/station-ranking';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsOverviewHandler
  implements QueryHandlerPort<ReadInsightsOverviewQuery, InsightsOverviewDto>
{
  constructor(
    private readonly histories: TeamHistories,
    private readonly reader: InsightsReaderPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(
    query: ReadInsightsOverviewQuery,
  ): Promise<InsightsOverviewDto> {
    try {
      const { clearance, period } = await this.histories.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const counts = await this.reader.overviewCounts({
        workspaceId: clearance.workspaceId,
        teamId: clearance.teamId,
        period,
      });
      const headline = headlineFrom(
        counts.current,
        counts.resolved,
        period.current,
      );
      const ids = headline.peopleIds;
      const output = dailyOutputFrom(
        counts.spending,
        counts.resolved,
        period,
        counts.markers,
      );
      const currency = outputCurrencyOf(output);

      return {
        period: periodOf(period),
        truncated: false,
        headline: headlineDtoOf(headline),
        changes: headlineChangesOf(
          headline,
          headlineFrom(counts.previous, counts.resolved, period.previous),
        ),
        output: output.map(dayOutputDtoOf),
        outputCurrency: currency.currency,
        outputMixedCurrencies: currency.mixedCurrencies,
        worthImproving: stationsWorthImprovingFrom(
          counts.stations,
          counts.failingBefore,
        ),
        people: namedOf(ids, await this.people.namesOf(ids)),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
