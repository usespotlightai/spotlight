import type {
  KnownToolDto,
  OnboardingDto,
} from '@application/dto/onboarding.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { GitHubAppPort } from '@application/ports/github-app.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { OnboardingQuery } from '@application/queries/onboarding.query';
import { shownFor } from '@application/services/setup-steps';
import {
  asSetupState,
  type TeamSetup,
} from '@application/services/team-setup.service';
import { KNOWN_TOOLS } from '@domain/services/known-tools';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/**
 * What a team still has to do. Each step is something a person does
 * somewhere else, so they are asked about rather than assumed.
 */
export class OnboardingHandler
  implements QueryHandlerPort<OnboardingQuery, OnboardingDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly setup: TeamSetup,
    private readonly app: GitHubAppPort,
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

      const [facts, installUrl] = await Promise.all([
        this.setup.factsFor(
          WorkspaceId.of(team.workspaceId),
          TeamId.of(team.teamId),
        ),
        this.app.installUrl(),
      ]);

      return {
        steps: shownFor(asSetupState(facts), {
          slug: team.slug,
          teamId: team.teamId,
        }),
        installUrl,
        connectedToGitHub: facts.connectedToGitHub,
        configRepository: facts.configRepository,
        tools: KNOWN_TOOLS.map(
          (each): KnownToolDto => ({
            source: each.source.value,
            name: each.name,
            summary: each.summary,
            secretCalled: each.secretCalled,
            chosen: facts.listening.includes(each.source.value),
          }),
        ),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
