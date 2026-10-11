import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { OnboardingDto } from '@work/application/dto/onboarding.dto';
import type { OnboardingQuery } from '@work/application/queries/onboarding.query';
import type { SetupStanding } from '@work/application/services/setup-standing.service';
import { shownFor } from '@work/application/services/setup-steps';

export class OnboardingHandler
  implements QueryHandlerPort<OnboardingQuery, OnboardingDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly setup: SetupStanding,
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

      const setup = await this.setup.of(
        WorkspaceId.of(team.workspaceId),
        TeamId.of(query.teamId),
      );

      const { chat } = setup;

      return {
        steps: shownFor(setup.state),
        canSetUp: setup.state.connectedToGitHub && setup.hostsSandboxes,
        setupChat: chat && {
          id: chat.startedById === query.viewerId ? chat.id : null,
          pullRequest: chat.pullRequest,
          startedBy: chat.startedBy,
        },
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
