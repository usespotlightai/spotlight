import {
  type InsightsCostDto,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { ReadInsightsCostQuery } from '@outcomes/application/queries/read-insights-cost.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import { costBreakdownOf } from '@outcomes/domain/services/cost-breakdown';
import { spendChangeOf } from '@outcomes/domain/value-objects/change.vo';
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
      const cost = costBreakdownOf(history, period.current);
      const before = costBreakdownOf(history, period.previous);

      return {
        period: periodOf(period),
        truncated,
        cost,
        spendChange: spendChangeOf(cost.spend, before.spend, 'neither'),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
