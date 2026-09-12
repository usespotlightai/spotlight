import type { RevokeInviteCommand } from '@application/commands/revoke-invite.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import type { InviteRepository } from '@domain/repositories/invite.repository';
import { InviteId } from '@domain/value-objects/invite-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';

export class RevokeInviteHandler
  implements CommandHandlerPort<RevokeInviteCommand, boolean>
{
  constructor(
    private readonly authorization: ConnectionAuthorization,
    private readonly invites: InviteRepository,
    private readonly clock: ClockPort,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(command: RevokeInviteCommand): Promise<boolean> {
    try {
      if (
        !(await this.authorization.connectableBy(
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
      await this.events.dispatch(revoked.pullEvents());

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
