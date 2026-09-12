import type { MemberDto } from '@application/dto/member.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { MemberReaderPort } from '@application/ports/member-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ListMembersQuery } from '@application/queries/list-members.query';
import { rolesGivable } from '@domain/services/role-giving';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';

export class ListMembersHandler
  implements QueryHandlerPort<ListMembersQuery, MemberDto[] | null>
{
  constructor(private readonly members: MemberReaderPort) {}

  async execute(query: ListMembersQuery): Promise<MemberDto[] | null> {
    try {
      const roster = await this.members.listForTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      if (!roster) {
        return null;
      }

      const mine = WorkspaceRole.of(roster.viewer);

      return roster.members.map((member) => {
        const theirs = WorkspaceRole.of(member.role);

        const mayBeSetTo = rolesGivable({
          mine,
          theirs,
          lastOwner: theirs.isOwner && roster.owners === 1,
          isSelf: member.id === query.viewerId,
        });

        return {
          id: member.id,
          name: member.name,
          image: member.image,
          role: member.role,
          mayBeSetTo: mayBeSetTo.map((role) => role.value),
        };
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
