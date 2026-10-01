import { periodOf } from '@outcomes/application/dto/insights.dto';
import {
  type InsightsPullRequestListDto,
  insightsPullRequestOf,
} from '@outcomes/application/dto/insights-pull-requests.dto';
import { pageOf, sizeOf } from '@outcomes/application/queries/handlers/paging';
import type { ListInsightsPullRequestsQuery } from '@outcomes/application/queries/list-insights-pull-requests.query';
import type { TeamPullRequests } from '@outcomes/application/services/team-pull-requests.service';
import {
  filteredPullRequests,
  pullRequestFilterOf,
} from '@outcomes/domain/services/pull-request-filter';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListInsightsPullRequestsHandler
  implements
    QueryHandlerPort<ListInsightsPullRequestsQuery, InsightsPullRequestListDto>
{
  constructor(private readonly pullRequests: TeamPullRequests) {}

  async execute(
    query: ListInsightsPullRequestsQuery,
  ): Promise<InsightsPullRequestListDto> {
    try {
      const filter = pullRequestFilterOf(query.filter);
      const { period, pullRequests, truncated } = await this.pullRequests.of(
        query.teamId,
        query.principal,
        query.period,
      );
      const size = sizeOf(query.size);
      const page = pageOf(query.page);
      const listed = filteredPullRequests(pullRequests, filter, period.current);

      return {
        period: periodOf(period),
        truncated,
        total: listed.length,
        page,
        size,
        pullRequests: listed
          .slice((page - 1) * size, page * size)
          .map(insightsPullRequestOf),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
