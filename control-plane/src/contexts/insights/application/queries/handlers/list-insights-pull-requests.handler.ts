import {
  type InsightsPullRequestListDto,
  insightsPullRequestOf,
} from '@insights/application/dto/insights-pull-requests.dto';
import { periodOf } from '@insights/application/dto/insights.dto';
import type { ListInsightsPullRequestsQuery } from '@insights/application/queries/list-insights-pull-requests.query';
import { pullRequestFilterInputOf } from '@insights/application/queries/pull-request-filter-query';
import type { TeamPullRequests } from '@insights/application/services/team-pull-requests.service';
import { pullRequestFilterOf } from '@insights/domain/services/pull-request-filter';
import {
  listingPageOf,
  listingSizeOf,
} from '@insights/domain/value-objects/listing.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListInsightsPullRequestsHandler implements QueryHandlerPort<
  ListInsightsPullRequestsQuery,
  InsightsPullRequestListDto
> {
  constructor(private readonly pullRequests: TeamPullRequests) {}

  async execute(
    query: ListInsightsPullRequestsQuery,
  ): Promise<InsightsPullRequestListDto> {
    try {
      const filter = pullRequestFilterOf(
        pullRequestFilterInputOf(query.filter),
      );
      const size = listingSizeOf(query.size);
      const page = listingPageOf(query.page);
      const { period, total, pullRequests } = await this.pullRequests.page(
        query.teamId,
        query.principal,
        query.period,
        { filter, page, size },
      );

      return {
        period: periodOf(period),
        total,
        page,
        size,
        pullRequests: pullRequests.map(insightsPullRequestOf),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
