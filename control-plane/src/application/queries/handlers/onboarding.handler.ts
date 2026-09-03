import type {
  KnownToolDto,
  OnboardingDto,
} from '@application/dto/onboarding.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunnerReaderPort } from '@application/ports/runner-reader.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { OnboardingQuery } from '@application/queries/onboarding.query';
import { INTEGRATIONS_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { KNOWN_TOOLS } from '@domain/services/known-tools';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/**
 * What a team still has to do before any of this does anything.
 *
 * Each of these is something a person goes and does somewhere else — starts a
 * runner, installs an App, merges a pull request — so they are asked about
 * rather than assumed, and shown together rather than found out one at a time.
 */
export class OnboardingHandler
  implements QueryHandlerPort<OnboardingQuery, OnboardingDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly connections: WorkspaceConnections,
    private readonly configurations: TeamConfigurationRepository,
    private readonly integrations: IntegrationReaderPort,
    private readonly runners: RunnerReaderPort,
  ) {}

  async execute(query: OnboardingQuery): Promise<OnboardingDto | null> {
    try {
      const team = await this.workspaces.findTeamForMember(
        query.teamId,
        UserId.of(query.viewerId),
      );

      if (!team) {
        return null;
      }

      const workspaceId = WorkspaceId.of(team.workspaceId);

      const [connection, applied, runners] = await Promise.all([
        this.connections.connectionTo(workspaceId, GitHubInstallation.SOURCE),
        this.configurations.findFor(TeamId.of(team.teamId)),
        this.runners.listAll(),
      ]);

      const listening = applied
        ? this.integrations
            .read(applied.under(INTEGRATIONS_UNDER))
            .integrations.map((each) => each.source.value)
        : [];

      return {
        hasRunner: runners.length > 0,
        connectedToGitHub: connection !== null,
        hasConfiguration: applied !== null,
        tools: KNOWN_TOOLS.map(
          (each): KnownToolDto => ({
            source: each.source.value,
            name: each.name,
            summary: each.summary,
            secretCalled: each.secretCalled,
            chosen: listening.includes(each.source.value),
          }),
        ),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
