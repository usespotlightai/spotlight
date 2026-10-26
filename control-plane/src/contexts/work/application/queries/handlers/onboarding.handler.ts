import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { OnboardingDto } from '@work/application/dto/onboarding.dto';
import type { TeamProvisioningPort } from '@work/application/ports/team-provisioning.port';
import type { OnboardingQuery } from '@work/application/queries/onboarding.query';
import type { SetupStatus } from '@work/application/services/setup-status.service';
import { shownFor } from '@work/application/services/setup-steps';

export class OnboardingHandler
  implements QueryHandlerPort<OnboardingQuery, OnboardingDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly access: WorkspaceAccessPort,
    private readonly setup: SetupStatus,
    private readonly provisioning: TeamProvisioningPort,
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

      const teamId = TeamId.of(query.teamId);
      const workspaceId = WorkspaceId.of(team.workspaceId);
      const provisioning = await this.provisioning.of(teamId);
      const setup = await this.setup.of(workspaceId, teamId);
      const permissions = await this.access.permissionsIn(
        workspaceId,
        PersonPrincipal.of(UserId.of(query.viewerId)),
      );

      const { chat } = setup;

      return {
        provisioning,
        steps: shownFor(setup.state),
        canSetUp: setup.state.connectedToGitHub && setup.hasEgressCapableRunner,
        viewerIsAdmin: permissions?.isAdmin ?? false,
        setupChat: chat && {
          id: chat.startedById === query.viewerId ? chat.id : null,
          repository: chat.repository,
          pullRequest: chat.pullRequest,
          ci: chat.ci,
          startedBy: chat.startedBy,
        },
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
