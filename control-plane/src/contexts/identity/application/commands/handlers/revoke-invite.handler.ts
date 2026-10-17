import type { RevokeInviteCommand } from '@identity/application/commands/revoke-invite.command';
import type { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class RevokeInviteHandler
  implements CommandHandlerPort<RevokeInviteCommand, boolean>
{
  constructor(
    private readonly administration: WorkspaceAdministration,
    private readonly invites: WorkspaceInviteRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RevokeInviteCommand): Promise<boolean> {
    try {
      const administered = await this.administration.administeredBy(
        command.slug,
        command.viewerId,
      );

      if (!administered) {
        return false;
      }

      const invite = await this.invites.find(InviteId.of(command.inviteId));

      if (!invite?.workspaceId.equals(administered.workspace.id)) {
        return false;
      }

      const revoked = invite.revoke(administered.by, this.clock.now());

      if (revoked !== invite) {
        await this.invites.save(revoked);
      }

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
