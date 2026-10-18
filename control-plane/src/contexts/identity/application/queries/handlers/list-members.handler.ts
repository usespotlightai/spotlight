import type { MemberDto } from '@identity/application/dto/member.dto';
import type { MemberReaderPort } from '@identity/application/ports/member-reader.port';
import type { ListMembersQuery } from '@identity/application/queries/list-members.query';
import { assignableRoles } from '@identity/domain/services/role-assignment';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

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

      const callerRole = WorkspaceRole.of(roster.viewer);

      return roster.members.map((member) => {
        const memberRole = WorkspaceRole.of(member.role);

        const assignable = assignableRoles({
          callerRole,
          memberRole,
          isLastOwner: memberRole.isOwner && roster.owners === 1,
          isSelf: member.id === query.viewerId,
        });

        return {
          id: member.id,
          name: member.name,
          image: member.image,
          role: member.role,
          assignableRoles: assignable.map((role) => role.value),
        };
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
