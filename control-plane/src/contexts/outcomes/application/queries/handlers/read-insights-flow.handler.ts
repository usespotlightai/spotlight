import {
  flowDtoOf,
  type InsightsFlowDto,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { ReadInsightsFlowQuery } from '@outcomes/application/queries/read-insights-flow.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import { flowOf } from '@outcomes/domain/services/flow';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsFlowHandler
  implements QueryHandlerPort<ReadInsightsFlowQuery, InsightsFlowDto>
{
  constructor(private readonly histories: TeamHistories) {}

  async execute(query: ReadInsightsFlowQuery): Promise<InsightsFlowDto> {
    try {
      const { period, history, truncated } = await this.histories.of(
        query.teamId,
        query.principal,
        query.period,
      );

      return {
        period: periodOf(period),
        truncated,
        flow: flowDtoOf(flowOf(history, period)),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
