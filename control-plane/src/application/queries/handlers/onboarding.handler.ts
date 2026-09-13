import type {
  KnownIntegrationDto,
  OnboardingDto,
} from '@application/dto/onboarding.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { DeliveryAddressesPort } from '@application/ports/delivery-addresses.port';
import type { GitHubAppPort } from '@application/ports/github-app.port';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { StarterIntegrationsPort } from '@application/ports/starter-integrations.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { OnboardingQuery } from '@application/queries/onboarding.query';
import { shownFor } from '@application/services/setup-steps';
import { starterSecrets } from '@application/services/starter-secrets';
import {
  asSetupState,
  type TeamSetup,
} from '@application/services/team-setup.service';
import type { LineRepository } from '@domain/repositories/line.repository';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class OnboardingHandler
  implements QueryHandlerPort<OnboardingQuery, OnboardingDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly setup: TeamSetup,
    private readonly app: GitHubAppPort,
    private readonly lines: LineRepository,
    private readonly starters: StarterIntegrationsPort,
    private readonly integrations: IntegrationReaderPort,
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

      const repositoryOwner = facts.installation
        ? await this.app.owner(facts.installation)
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
        lines: lines.map((line) => ({
          key: line.key.value,
          name: line.name.value,
          harness: line.worked[0]?.harness?.value ?? null,
          model: line.worked[0]?.model?.value ?? null,
          effort: line.worked[0]?.effort?.value ?? null,
          repositories: line.repositories.all.map((each) => each.value),
        })),
        integrations: this.starters.all().map(
          (each): KnownIntegrationDto => ({
            source: each.source,
            name: each.name,
            summary: each.summary,
            secrets: starterSecrets(
              this.starters,
              this.integrations,
              each.source,
            ).map((name) => name.value),
            deliverTo: this.addresses.of(team.slug, team.teamKey, each.source),
          }),
        ),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
