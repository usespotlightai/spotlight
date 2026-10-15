import {
  type InsightsCostDto,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { ReadInsightsCostQuery } from '@outcomes/application/queries/read-insights-cost.query';
import type { TeamScopes } from '@outcomes/application/services/team-scopes.service';
import { costBreakdownFrom } from '@outcomes/domain/services/cost-breakdown';
import { spendChangeOf } from '@outcomes/domain/value-objects/change.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsCostHandler
  implements QueryHandlerPort<ReadInsightsCostQuery, InsightsCostDto>
{
  constructor(
    private readonly histories: TeamScopes,
    private readonly reader: InsightsReaderPort,
  ) {}

  async execute(query: ReadInsightsCostQuery): Promise<InsightsCostDto> {
    try {
      const { clearance, period } = await this.histories.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const counts = await this.reader.costCounts({
        workspaceId: clearance.workspaceId,
        teamId: clearance.teamId,
        period,
      });
      const cost = costBreakdownFrom(counts.current);

      return {
        period: periodOf(period),
        cost,
        spendChange: spendChangeOf(cost.spend, counts.spendBefore, 'neither'),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
