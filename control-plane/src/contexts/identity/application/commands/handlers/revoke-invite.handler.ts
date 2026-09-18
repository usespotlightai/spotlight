import type { RevokeInviteCommand } from '@identity/application/commands/revoke-invite.command';
import type { TeamAdministration } from '@identity/application/services/team-administration.service';
import type { InviteRepository } from '@identity/domain/repositories/invite.repository';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class RevokeInviteHandler
  implements CommandHandlerPort<RevokeInviteCommand, boolean>
{
  constructor(
    private readonly authorization: TeamAdministration,
    private readonly invites: InviteRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RevokeInviteCommand): Promise<boolean> {
    try {
      if (
        !(await this.authorization.administeredBy(
          command.teamId,
          command.viewerId,
        ))
      ) {
        return false;
      }

      const invite = await this.invites.find(InviteId.of(command.inviteId));

      if (!invite?.teamId.equals(TeamId.of(command.teamId))) {
        return false;
      }

      const revoked = invite.revoked(this.clock.now());

      await this.invites.save(revoked);

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
