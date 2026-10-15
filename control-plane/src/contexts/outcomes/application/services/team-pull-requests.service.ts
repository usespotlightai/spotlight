import type {
  InsightsReaderPort,
  PullRequestPage,
  PullRequestsAsked,
  TeamInPeriod,
} from '@outcomes/application/ports/insights-reader.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import type {
  TeamHistories,
  TeamScope,
} from '@outcomes/application/services/team-histories.service';
import type { PullRequestCounts } from '@outcomes/domain/services/pull-request-insights';
import type { TeamPullRequest } from '@outcomes/domain/services/team-pull-requests';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const MOST_PULL_REQUESTS = 20_000;

interface TeamRepositories extends TeamScope {
  readonly repositories: readonly string[];
}

export interface TeamPullRequestsInPeriod extends TeamRepositories {
  readonly pullRequests: readonly TeamPullRequest[];
  readonly truncated: boolean;
}

export interface TeamPullRequestCounts extends TeamRepositories {
  readonly counts: PullRequestCounts;
}

export type TeamPullRequestPage = TeamScope & PullRequestPage;

const teamOf = (scope: TeamScope): TeamInPeriod => ({
  workspaceId: scope.clearance.workspaceId,
  teamId: scope.clearance.teamId,
  period: scope.period,
});

export class TeamPullRequests {
  constructor(
    private readonly histories: TeamHistories,
    private readonly work: WorkPort,
    private readonly reader: InsightsReaderPort,
  ) {}

  async of(
    teamId: string,
    principal: Principal,
    period: string,
    reach: 'current' | 'previous' = 'current',
  ): Promise<TeamPullRequestsInPeriod> {
    const scope = await this.scoped(teamId, principal, period);
    const found = await this.reader.pullRequests(teamOf(scope), {
      repositories: scope.repositories,
      from:
        reach === 'previous'
          ? scope.period.previous.from
          : scope.period.current.from,
      most: MOST_PULL_REQUESTS + 1,
    });
    const truncated = found.length > MOST_PULL_REQUESTS;

    return {
      ...scope,
      truncated,
      pullRequests: truncated ? found.slice(0, MOST_PULL_REQUESTS) : found,
    };
  }

  async counts(
    teamId: string,
    principal: Principal,
    period: string,
  ): Promise<TeamPullRequestCounts> {
    const scope = await this.scoped(teamId, principal, period);

    return {
      ...scope,
      counts: await this.reader.pullRequestCounts(
        teamOf(scope),
        scope.repositories,
      ),
    };
  }

  async page(
    teamId: string,
    principal: Principal,
    period: string,
    asked: PullRequestsAsked,
  ): Promise<TeamPullRequestPage> {
    const scope = await this.scoped(teamId, principal, period);

    return {
      ...scope,
      ...(await this.reader.pullRequestPage(teamOf(scope), {
        repositories: scope.repositories,
        ...asked,
      })),
    };
  }

  private async scoped(
    teamId: string,
    principal: Principal,
    period: string,
  ): Promise<TeamRepositories> {
    const scope = await this.histories.scope(teamId, principal, period);

    return {
      ...scope,
      repositories: await this.work.teamRepositories(
        scope.clearance.teamId.value,
      ),
    };
  }
}
