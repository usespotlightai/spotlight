import { periodOf } from '@insights/application/dto/insights.dto';
import {
  type InsightsPullRequestsDto,
  pullRequestInsightsDtoOf,
} from '@insights/application/dto/insights-pull-requests.dto';
import type { ReadInsightsPullRequestsQuery } from '@insights/application/queries/read-insights-pull-requests.query';
import type { TeamPullRequests } from '@insights/application/services/team-pull-requests.service';
import { pullRequestInsightsFrom } from '@insights/domain/services/pull-request-insights';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
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
      const { period, repositories, counts } = await this.pullRequests.counts(
        query.teamId,
        query.principal,
        query.period,
      );

      return {
        period: periodOf(period),
        total: counts.covered,
        repositories,
        ...pullRequestInsightsDtoOf(
          pullRequestInsightsFrom(counts, repositories, period.current),
        ),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
