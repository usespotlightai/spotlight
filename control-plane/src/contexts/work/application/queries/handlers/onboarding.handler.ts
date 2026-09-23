import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { OnboardingDto } from '@work/application/dto/onboarding.dto';
import type { OnboardingQuery } from '@work/application/queries/onboarding.query';
import { shownFor } from '@work/application/services/setup-steps';
import type { WorkspaceSetup } from '@work/application/services/workspace-setup.service';

export class OnboardingHandler
  implements QueryHandlerPort<OnboardingQuery, OnboardingDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly setup: WorkspaceSetup,
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

      const state = await this.setup.stateOf(WorkspaceId.of(team.workspaceId));

      return { steps: shownFor(state) };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
