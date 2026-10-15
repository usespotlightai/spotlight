import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import type {
  TeamHistories,
  TeamScope,
} from '@outcomes/application/services/team-histories.service';
import type { TeamPullRequest } from '@outcomes/domain/services/team-pull-requests';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const MOST_PULL_REQUESTS = 20_000;

export interface TeamPullRequestsInPeriod extends TeamScope {
  readonly repositories: readonly string[];
  readonly pullRequests: readonly TeamPullRequest[];
  readonly truncated: boolean;
}

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
    const scope = await this.histories.scope(teamId, principal, period);
    const repositories = await this.work.teamRepositories(
      scope.clearance.teamId.value,
    );
    const found = await this.reader.pullRequests(
      {
        workspaceId: scope.clearance.workspaceId,
        teamId: scope.clearance.teamId,
        period: scope.period,
      },
      {
        repositories,
        from:
          reach === 'previous'
            ? scope.period.previous.from
            : scope.period.current.from,
        most: MOST_PULL_REQUESTS + 1,
      },
    );
    const truncated = found.length > MOST_PULL_REQUESTS;

    return {
      ...scope,
      repositories,
      truncated,
      pullRequests: truncated ? found.slice(0, MOST_PULL_REQUESTS) : found,
    };
  }
}
