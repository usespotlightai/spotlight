import { InviteToWorkspaceCommand } from '@identity/application/commands/invite-to-workspace.command';
import type { InviteOutcomeDto } from '@identity/application/dto/invite.dto';
import type { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import { Invitees } from '@identity/domain/value-objects/invitees.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface WorkspaceInvitation {
  readonly slug: string;
  readonly emails: readonly string[];
  readonly role: string;
  readonly teamIds: readonly string[];
  readonly viewerId: string;
}

export class WorkspaceInviting {
  constructor(
    private readonly administration: WorkspaceAdministration,
    private readonly inviteToWorkspace: CommandHandlerPort<
      InviteToWorkspaceCommand,
      InviteOutcomeDto | null
    >,
  ) {}

  async invite(
    invitation: WorkspaceInvitation,
  ): Promise<readonly InviteOutcomeDto[] | null> {
    try {
      const invitees = Invitees.of(invitation.emails);
      const administered = await this.administration.administeredBy(
        invitation.slug,
        PersonPrincipal.of(UserId.of(invitation.viewerId)),
      );

      if (!administered) {
        return null;
      }

      const outcomes: InviteOutcomeDto[] = [];

      for (const email of invitees.addresses) {
        const outcome = await this.inviteToWorkspace.execute(
          new InviteToWorkspaceCommand(
            invitation.slug,
            email.value,
            invitation.role,
            invitation.teamIds,
            invitation.viewerId,
          ),
        );

        if (!outcome) {
          return null;
        }

        outcomes.push(outcome);
      }

      return outcomes;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
