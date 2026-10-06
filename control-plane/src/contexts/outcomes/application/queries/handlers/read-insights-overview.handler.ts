import {
  configMarkerDtoOf,
  headlineDtoOf,
  type InsightsOverviewDto,
  namedOf,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { PeoplePort } from '@outcomes/application/ports/people.port';
import type { ReadInsightsOverviewQuery } from '@outcomes/application/queries/read-insights-overview.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import {
  configMarkersOf,
  dailyOutputOf,
  outputCurrencyOf,
} from '@outcomes/domain/services/daily-output';
import { headlineOf } from '@outcomes/domain/services/headline';
import { stationsWorthImproving } from '@outcomes/domain/services/station-ranking';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsOverviewHandler
  implements QueryHandlerPort<ReadInsightsOverviewQuery, InsightsOverviewDto>
{
  constructor(
    private readonly histories: TeamHistories,
    private readonly people: PeoplePort,
  ) {}

  async execute(
    query: ReadInsightsOverviewQuery,
  ): Promise<InsightsOverviewDto> {
    try {
      const held = await this.histories.of(
        query.teamId,
        query.principal,
        query.period,
      );
      const { period, history, truncated } = held;
      const headline = headlineOf(history, period.current);
      const before = headlineOf(history, period.previous);
      const ids = [...headline.peopleIds, ...before.peopleIds];
      const output = dailyOutputOf(history, period);
      const currency = outputCurrencyOf(output);

      return {
        period: periodOf(period),
        truncated,
        headline: headlineDtoOf(headline),
        before: headlineDtoOf(before),
        output,
        outputCurrency: currency.currency,
        outputMixedCurrencies: currency.mixedCurrencies,
        configChanges: configMarkersOf(
          history,
          period,
          await this.histories.carriedOn(held),
        ).map(configMarkerDtoOf),
        worthImproving: stationsWorthImproving(history, period),
        people: namedOf(ids, await this.people.namesOf(ids)),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
