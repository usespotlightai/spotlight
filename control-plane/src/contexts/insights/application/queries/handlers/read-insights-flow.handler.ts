import {
  flowDtoOf,
  type InsightsFlowDto,
  periodOf,
} from '@insights/application/dto/insights.dto';
import type { InsightsReaderPort } from '@insights/application/ports/insights-reader.port';
import type { ReadInsightsFlowQuery } from '@insights/application/queries/read-insights-flow.query';
import type { TeamScopes } from '@insights/application/services/team-scopes.service';
import { flowFrom } from '@insights/domain/services/flow';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsFlowHandler
  implements QueryHandlerPort<ReadInsightsFlowQuery, InsightsFlowDto>
{
  constructor(
    private readonly scopes: TeamScopes,
    private readonly reader: InsightsReaderPort,
  ) {}

  async execute(query: ReadInsightsFlowQuery): Promise<InsightsFlowDto> {
    try {
      const { access, period } = await this.scopes.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const counts = await this.reader.flowCounts({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
        period,
      });

      return {
        period: periodOf(period),
        flow: flowDtoOf(flowFrom(counts, period)),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
