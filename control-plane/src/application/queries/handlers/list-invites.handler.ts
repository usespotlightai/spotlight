import type { InviteDto } from '@application/dto/invite.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { InviteReaderPort } from '@application/ports/invite-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ListInvitesQuery } from '@application/queries/list-invites.query';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ListInvitesHandler
  implements QueryHandlerPort<ListInvitesQuery, InviteDto[] | null>
{
  constructor(private readonly invites: InviteReaderPort) {}

  async execute(query: ListInvitesQuery): Promise<InviteDto[] | null> {
    try {
      const open = await this.invites.openForTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      return (
        open?.map((invite) => ({
          id: invite.id,
          email: invite.email,
          invitedBy: invite.invitedBy,
          invitedAt: invite.invitedAt.toISOString(),
          expiresAt: invite.expiresAt.toISOString(),
        })) ?? null
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
