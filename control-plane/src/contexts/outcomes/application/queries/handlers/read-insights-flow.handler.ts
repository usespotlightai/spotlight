import {
  flowDtoOf,
  type InsightsFlowDto,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { ReadInsightsFlowQuery } from '@outcomes/application/queries/read-insights-flow.query';
import type { TeamScopes } from '@outcomes/application/services/team-scopes.service';
import { flowFrom } from '@outcomes/domain/services/flow';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsFlowHandler
  implements QueryHandlerPort<ReadInsightsFlowQuery, InsightsFlowDto>
{
  constructor(
    private readonly histories: TeamScopes,
    private readonly reader: InsightsReaderPort,
  ) {}

  async execute(query: ReadInsightsFlowQuery): Promise<InsightsFlowDto> {
    try {
      const { clearance, period } = await this.histories.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const counts = await this.reader.flowCounts({
        workspaceId: clearance.workspaceId,
        teamId: clearance.teamId,
        period,
      });

      return {
        period: periodOf(period),
        flow: flowDtoOf(flowFrom(counts, period)),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
