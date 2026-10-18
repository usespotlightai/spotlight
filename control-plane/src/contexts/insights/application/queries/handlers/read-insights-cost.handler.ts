import {
  type InsightsCostDto,
  periodOf,
} from '@insights/application/dto/insights.dto';
import type { InsightsReaderPort } from '@insights/application/ports/insights-reader.port';
import type { ReadInsightsCostQuery } from '@insights/application/queries/read-insights-cost.query';
import type { TeamScopes } from '@insights/application/services/team-scopes.service';
import { costBreakdownFrom } from '@insights/domain/services/cost-breakdown';
import { spendDeltaOf } from '@insights/domain/value-objects/delta.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsCostHandler
  implements QueryHandlerPort<ReadInsightsCostQuery, InsightsCostDto>
{
  constructor(
    private readonly scopes: TeamScopes,
    private readonly reader: InsightsReaderPort,
  ) {}

  async execute(query: ReadInsightsCostQuery): Promise<InsightsCostDto> {
    try {
      const { access, period } = await this.scopes.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const counts = await this.reader.costCounts({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
        period,
      });
      const cost = costBreakdownFrom(counts.current);

      return {
        period: periodOf(period),
        cost,
        spendChange: spendDeltaOf(cost.spend, counts.spendBefore, 'neither'),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
