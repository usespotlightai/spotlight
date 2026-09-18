import type { GitHubAppPort } from '@github/application/ports/github-app.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  KnownIntegrationDto,
  OnboardingDto,
} from '@work/application/dto/onboarding.dto';
import type { DeliveryAddressesPort } from '@work/application/ports/delivery-addresses.port';
import type { LineSetUpReaderPort } from '@work/application/ports/line-set-up-reader.port';
import type { StarterIntegrationsPort } from '@work/application/ports/starter-integrations.port';
import type { OnboardingQuery } from '@work/application/queries/onboarding.query';
import { shownFor } from '@work/application/services/setup-steps';
import {
  asSetupState,
  type TeamSetup,
} from '@work/application/services/team-setup.service';

export class OnboardingHandler
  implements QueryHandlerPort<OnboardingQuery, OnboardingDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly setup: TeamSetup,
    private readonly app: GitHubAppPort,
    private readonly lines: LineSetUpReaderPort,
    private readonly starters: StarterIntegrationsPort,
    private readonly addresses: DeliveryAddressesPort,
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

      const [facts, installUrl, lines] = await Promise.all([
        this.setup.factsFor(
          WorkspaceId.of(team.workspaceId),
          TeamId.of(team.teamId),
        ),
        this.app.installUrl(),
        this.lines.ofTeam(TeamId.of(team.teamId)),
      ]);

      const repositoryOwner = facts.connectedToGitHub
        ? await this.app.owner(WorkspaceId.of(team.workspaceId))
        : null;

      return {
        steps: shownFor(asSetupState(facts), {
          slug: team.slug,
          teamId: team.teamId,
        }),
        installUrl,
        connectedToGitHub: facts.connectedToGitHub,
        configRepository: facts.configRepository,
        repositoryOwner,
        lines,
        integrations: this.starters.all().map(
          (each): KnownIntegrationDto => ({
            source: each.source,
            name: each.name,
            summary: each.summary,
            secrets: this.starters
              .secretsFor(each.source)
              .map((name) => name.value),
            deliverTo: this.addresses.of(team.slug, team.teamKey, each.source),
          }),
        ),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
