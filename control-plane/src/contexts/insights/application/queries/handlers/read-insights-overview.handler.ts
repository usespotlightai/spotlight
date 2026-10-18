import {
  dayOutputDtoOf,
  headlineDtoOf,
  type InsightsOverviewDto,
  namedOf,
  periodOf,
} from '@insights/application/dto/insights.dto';
import type { InsightsReaderPort } from '@insights/application/ports/insights-reader.port';
import type { PeoplePort } from '@insights/application/ports/people.port';
import type { ReadInsightsOverviewQuery } from '@insights/application/queries/read-insights-overview.query';
import type { TeamScopes } from '@insights/application/services/team-scopes.service';
import {
  dailyOutputFrom,
  outputCurrencyOf,
} from '@insights/domain/services/daily-output';
import {
  headlineDeltasOf,
  headlineFrom,
} from '@insights/domain/services/headline';
import { stationsWorthImprovingFrom } from '@insights/domain/services/station-ranking';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsOverviewHandler
  implements QueryHandlerPort<ReadInsightsOverviewQuery, InsightsOverviewDto>
{
  constructor(
    private readonly scopes: TeamScopes,
    private readonly reader: InsightsReaderPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(
    query: ReadInsightsOverviewQuery,
  ): Promise<InsightsOverviewDto> {
    try {
      const { access, period } = await this.scopes.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const counts = await this.reader.overviewCounts({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
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
        headline: headlineDtoOf(headline),
        changes: headlineDeltasOf(
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
      rethrowAsApplicationError(error);
    }
  }
}
