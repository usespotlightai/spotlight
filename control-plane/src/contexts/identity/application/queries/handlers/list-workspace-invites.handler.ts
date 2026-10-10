import type { WorkspaceInviteDto } from '@identity/application/dto/invite.dto';
import type { InviteReaderPort } from '@identity/application/ports/invite-reader.port';
import type { ListWorkspaceInvitesQuery } from '@identity/application/queries/list-workspace-invites.query';
import type { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListWorkspaceInvitesHandler
  implements
    QueryHandlerPort<ListWorkspaceInvitesQuery, WorkspaceInviteDto[] | null>
{
  constructor(
    private readonly administration: WorkspaceAdministration,
    private readonly invites: InviteReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    query: ListWorkspaceInvitesQuery,
  ): Promise<WorkspaceInviteDto[] | null> {
    try {
      const administered = await this.administration.administeredBy(
        query.slug,
        query.viewerId,
      );

      if (!administered) {
        return null;
      }

      const open = await this.invites.openInWorkspace(
        administered.workspace.id,
        this.clock.now(),
      );

      return open.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        teams: invite.teams,
        invitedBy: invite.invitedBy,
        invitedAt: invite.invitedAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
      }));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
