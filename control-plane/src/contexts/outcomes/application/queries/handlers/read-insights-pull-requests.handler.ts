import { periodOf } from '@outcomes/application/dto/insights.dto';
import {
  type InsightsPullRequestsDto,
  pullRequestInsightsDtoOf,
} from '@outcomes/application/dto/insights-pull-requests.dto';
import type { ReadInsightsPullRequestsQuery } from '@outcomes/application/queries/read-insights-pull-requests.query';
import type { TeamPullRequests } from '@outcomes/application/services/team-pull-requests.service';
import { pullRequestInsightsOf } from '@outcomes/domain/services/pull-request-insights';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsPullRequestsHandler
  implements
    QueryHandlerPort<ReadInsightsPullRequestsQuery, InsightsPullRequestsDto>
{
  constructor(private readonly pullRequests: TeamPullRequests) {}

  async execute(
    query: ReadInsightsPullRequestsQuery,
  ): Promise<InsightsPullRequestsDto> {
    try {
      const { period, repositories, pullRequests, truncated } =
        await this.pullRequests.of(query.teamId, query.principal, query.period);

      return {
        period: periodOf(period),
        truncated,
        total: pullRequests.length,
        repositories,
        ...pullRequestInsightsDtoOf(
          pullRequestInsightsOf(pullRequests, repositories, period.current),
        ),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
