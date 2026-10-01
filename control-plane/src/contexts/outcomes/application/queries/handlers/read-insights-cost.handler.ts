import {
  type InsightsCostDto,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { ReadInsightsCostQuery } from '@outcomes/application/queries/read-insights-cost.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import { costBreakdownOf } from '@outcomes/domain/services/cost-breakdown';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsCostHandler
  implements QueryHandlerPort<ReadInsightsCostQuery, InsightsCostDto>
{
  constructor(private readonly histories: TeamHistories) {}

  async execute(query: ReadInsightsCostQuery): Promise<InsightsCostDto> {
    try {
      const { period, history, truncated } = await this.histories.of(
        query.teamId,
        query.principal,
        query.period,
      );

      const before = costBreakdownOf(history, period.previous);

      return {
        period: periodOf(period),
        truncated,
        cost: costBreakdownOf(history, period.current),
        spendBefore: before.spend,
        mixedCurrenciesBefore: before.mixedCurrencies,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
