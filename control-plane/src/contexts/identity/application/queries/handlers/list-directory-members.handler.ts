import type { WorkspaceMemberDto } from '@identity/application/dto/member.dto';
import type { MemberReaderPort } from '@identity/application/ports/member-reader.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { ListDirectoryMembersQuery } from '@identity/application/queries/list-directory-members.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type DirectoryMember = Pick<
  WorkspaceMemberDto,
  'id' | 'email' | 'name' | 'role' | 'joinedAt'
>;

export class ListDirectoryMembersHandler implements QueryHandlerPort<
  ListDirectoryMembersQuery,
  DirectoryMember[] | null
> {
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly members: MemberReaderPort,
  ) {}

  async execute(
    query: ListDirectoryMembersQuery,
  ): Promise<DirectoryMember[] | null> {
    try {
      const workspaceId = WorkspaceId.of(query.workspaceId);

      if (!(await this.workspaces.isOpen(workspaceId))) {
        return null;
      }

      const everyone = await this.members.listForWorkspace(workspaceId);

      return everyone.map((member) => ({
        id: member.id,
        email: member.email,
        name: member.name,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
      }));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
