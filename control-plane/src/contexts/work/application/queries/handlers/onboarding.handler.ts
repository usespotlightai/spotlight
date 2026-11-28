import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  OnboardingDto,
  ProvisioningName,
  SetupPermissionName,
  SetupRefusalName,
} from '@work/application/dto/onboarding.dto';
import type { TeamWelcomesPort } from '@work/application/ports/team-welcomes.port';
import type { OnboardingQuery } from '@work/application/queries/onboarding.query';
import { shownFor } from '@work/application/rendering/setup-steps';
import type { SetupStatus } from '@work/application/services/setup-status.service';
import type { WorkAccess } from '@work/application/services/work-access.service';
import {
  SetupAdmission,
  type SetupRefusal,
} from '@work/domain/services/setup-admission';
import {
  type Provisioning,
  provisioningOf,
} from '@work/domain/services/team-provisioning';
import type { AppGrant } from '@work/domain/value-objects/app-grants.vo';

const PROVISIONING_NAME: Record<Provisioning, ProvisioningName> = {
  pending: 'pending',
  done: 'done',
};

const SETUP_REFUSAL_NAME: Record<SetupRefusal, SetupRefusalName> = {
  'needs-an-admin': 'needs-an-admin',
  'code-unreachable': 'code-unreachable',
  'needs-egress': 'needs-egress',
};

const SETUP_PERMISSION_NAME: Record<AppGrant, SetupPermissionName> = {
  workflows: 'workflows',
  variables: 'variables',
};

export class OnboardingHandler implements QueryHandlerPort<
  OnboardingQuery,
  OnboardingDto | null
> {
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
      const readiness = {
        codeReachable: setup.state.connectedToGitHub,
        egressAvailable: setup.hasEgressCapableRunner,
      };
      const refusal = SetupAdmission.refusalOf({
        ...readiness,
        requesterIsAdmin: viewerIsAdmin,
      });

      return {
        provisioning: PROVISIONING_NAME[provisioning],
        steps: shownFor(setup.state, setup.runners),
        canSetUp: SetupAdmission.readyIn(readiness),
        setupRefusal: refusal && SETUP_REFUSAL_NAME[refusal],
        missingPermissions: setup.grants
          .missingForSetup()
          .map((each) => SETUP_PERMISSION_NAME[each]),
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
