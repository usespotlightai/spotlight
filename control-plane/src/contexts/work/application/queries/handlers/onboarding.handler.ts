import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  OnboardingDto,
  ProvisioningName,
} from '@work/application/dto/onboarding.dto';
import type { TeamWelcomesPort } from '@work/application/ports/team-welcomes.port';
import type { OnboardingQuery } from '@work/application/queries/onboarding.query';
import { shownFor } from '@work/application/rendering/setup-steps';
import type { SetupStatus } from '@work/application/services/setup-status.service';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { SetupAdmission } from '@work/domain/services/setup-admission';
import {
  type Provisioning,
  provisioningOf,
} from '@work/domain/services/team-provisioning';

const PROVISIONING_NAME: Record<Provisioning, ProvisioningName> = {
  pending: 'pending',
  done: 'done',
};

export class OnboardingHandler
  implements QueryHandlerPort<OnboardingQuery, OnboardingDto | null>
{
  constructor(
    private readonly access: WorkAccess,
    private readonly setup: SetupStatus,
    private readonly welcomes: TeamWelcomesPort,
  ) {}

  async execute(query: OnboardingQuery): Promise<OnboardingDto | null> {
    try {
      const team = await this.access.seenTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      if (!team) {
        return null;
      }

      const { teamId, workspaceId } = team;
      const provisioning = provisioningOf({
        origin: team.origin,
        welcomed: await this.welcomes.welcomed(teamId),
      });
      const setup = await this.setup.of(workspaceId, teamId);
      const viewerIsAdmin = await this.access.isAdminOf(
        workspaceId,
        UserId.of(query.viewerId),
      );

      const { chat } = setup;

      return {
        provisioning: PROVISIONING_NAME[provisioning],
        steps: shownFor(setup.state),
        canSetUp: SetupAdmission.readyIn({
          codeReachable: setup.state.connectedToGitHub,
          egressAvailable: setup.hasEgressCapableRunner,
        }),
        viewerIsAdmin,
        setupChat: chat && {
          id: (await this.access.opensChat(
            { startedBy: UserId.of(chat.startedById), teamId },
            UserId.of(query.viewerId),
          ))
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
