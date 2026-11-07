import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { OnboardingDto } from '@work/application/dto/onboarding.dto';
import type { TeamWelcomesPort } from '@work/application/ports/team-welcomes.port';
import type { OnboardingQuery } from '@work/application/queries/onboarding.query';
import type { SetupStatus } from '@work/application/services/setup-status.service';
import { shownFor } from '@work/application/services/setup-steps';
import { ChatAccess } from '@work/domain/services/chat-access';
import { mayStartSetup } from '@work/domain/services/setup-list';
import { provisioningOf } from '@work/domain/services/team-provisioning';

export class OnboardingHandler
  implements QueryHandlerPort<OnboardingQuery, OnboardingDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly access: WorkspaceAccessPort,
    private readonly setup: SetupStatus,
    private readonly welcomes: TeamWelcomesPort,
  ) {}

  async execute(query: OnboardingQuery): Promise<OnboardingDto | null> {
    try {
      const team = await this.workspaces.findTeamForMember(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      if (!team) {
        return null;
      }

      const { teamId, workspaceId } = team;
      const provisioning = provisioningOf({
        madeAtSignUp: team.origin === 'sign-up',
        welcomed: await this.welcomes.welcomed(teamId),
      });
      const setup = await this.setup.of(workspaceId, teamId);
      const permissions = await this.access.permissionsIn(
        workspaceId,
        PersonPrincipal.of(UserId.of(query.viewerId)),
      );

      const { chat } = setup;

      return {
        provisioning,
        steps: shownFor(setup.state),
        canSetUp: mayStartSetup(setup.state, setup.hasEgressCapableRunner),
        viewerIsAdmin: permissions?.isAdmin ?? false,
        setupChat: chat && {
          id: ChatAccess.readableBy(
            UserId.of(chat.startedById),
            UserId.of(query.viewerId),
          )
            ? chat.id
            : null,
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
