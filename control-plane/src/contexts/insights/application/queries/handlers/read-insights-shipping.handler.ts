import { periodOf } from '@insights/application/dto/insights.dto';
import {
  type InsightsShippingDto,
  shippingDtoOf,
} from '@insights/application/dto/insights-shipping.dto';
import type { ReadInsightsShippingQuery } from '@insights/application/queries/read-insights-shipping.query';
import type { TeamPullRequests } from '@insights/application/services/team-pull-requests.service';
import { shippingFrom } from '@insights/domain/services/shipping';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsShippingHandler
  implements QueryHandlerPort<ReadInsightsShippingQuery, InsightsShippingDto>
{
  constructor(private readonly pullRequests: TeamPullRequests) {}

  async execute(
    query: ReadInsightsShippingQuery,
  ): Promise<InsightsShippingDto> {
    try {
      const { period, counts } = await this.pullRequests.shipping(
        query.teamId,
        query.principal,
        query.period,
      );

      return {
        period: periodOf(period),
        ...shippingDtoOf(shippingFrom(counts)),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
