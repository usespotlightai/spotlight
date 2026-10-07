import { periodOf } from '@outcomes/application/dto/insights.dto';
import {
  type InsightsShippingDto,
  shippingDtoOf,
} from '@outcomes/application/dto/insights-shipping.dto';
import type { ReadInsightsShippingQuery } from '@outcomes/application/queries/read-insights-shipping.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import type { TeamPullRequests } from '@outcomes/application/services/team-pull-requests.service';
import { shippingOf } from '@outcomes/domain/services/shipping';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsShippingHandler
  implements QueryHandlerPort<ReadInsightsShippingQuery, InsightsShippingDto>
{
  constructor(
    private readonly pullRequests: TeamPullRequests,
    private readonly histories: TeamHistories,
  ) {}

  async execute(
    query: ReadInsightsShippingQuery,
  ): Promise<InsightsShippingDto> {
    try {
      const made = await this.pullRequests.of(
        query.teamId,
        query.principal,
        query.period,
        'previous',
      );
      const { history, truncated } = await this.histories.of(
        query.teamId,
        query.principal,
        query.period,
      );

      return {
        period: periodOf(made.period),
        truncated: made.truncated || truncated,
        ...shippingDtoOf(shippingOf(made.pullRequests, history, made.period)),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
