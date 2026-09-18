import type { InviteDto } from '@identity/application/dto/invite.dto';
import type { InviteReaderPort } from '@identity/application/ports/invite-reader.port';
import type { ListInvitesQuery } from '@identity/application/queries/list-invites.query';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

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
