import type {
  InsightsReaderPort,
  PullRequestPage,
  PullRequestsAsked,
  TeamInPeriod,
} from '@outcomes/application/ports/insights-reader.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import type {
  TeamScope,
  TeamScopes,
} from '@outcomes/application/services/team-scopes.service';
import type { PullRequestCounts } from '@outcomes/domain/services/pull-request-insights';
import type { ShippingCounts } from '@outcomes/domain/services/shipping';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

interface TeamRepositories extends TeamScope {
  readonly repositories: readonly string[];
}

export interface TeamPullRequestCounts extends TeamRepositories {
  readonly counts: PullRequestCounts;
}

export type TeamPullRequestPage = TeamScope & PullRequestPage;

export interface TeamShippingCounts extends TeamScope {
  readonly counts: ShippingCounts;
}

const teamOf = (scope: TeamScope): TeamInPeriod => ({
  workspaceId: scope.access.workspaceId,
  teamId: scope.access.teamId,
  period: scope.period,
});

export class TeamPullRequests {
  constructor(
    private readonly scopes: TeamScopes,
    private readonly work: WorkPort,
    private readonly reader: InsightsReaderPort,
  ) {}

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

  async shipping(
    teamId: string,
    principal: Principal,
    period: string,
  ): Promise<TeamShippingCounts> {
    const scope = await this.scoped(teamId, principal, period);

    return {
      ...scope,
      counts: await this.reader.shippingCounts(
        teamOf(scope),
        scope.repositories,
      ),
    };
  }

  private async scoped(
    teamId: string,
    principal: Principal,
    period: string,
  ): Promise<TeamRepositories> {
    const scope = await this.scopes.scope(teamId, principal, period);

    return {
      ...scope,
      repositories: await this.work.teamRepositories(scope.access.teamId.value),
    };
  }
}
