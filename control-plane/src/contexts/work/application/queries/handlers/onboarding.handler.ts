import type { GitHubAppPort } from '@github/application/ports/github-app.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { OnboardingDto } from '@work/application/dto/onboarding.dto';
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
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
