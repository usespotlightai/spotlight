import type { DirectoryMemberDto } from '@identity/application/dto/directory-member.dto';
import type { MemberReaderPort } from '@identity/application/ports/member-reader.port';
import type { WorkspaceDirectoryPort } from '@identity/application/ports/workspace-directory.port';
import type { ListDirectoryMembersQuery } from '@identity/application/queries/list-directory-members.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListDirectoryMembersHandler implements QueryHandlerPort<
  ListDirectoryMembersQuery,
  DirectoryMemberDto[] | null
> {
  constructor(
    private readonly directory: WorkspaceDirectoryPort,
    private readonly members: MemberReaderPort,
  ) {}

  async execute(
    query: ListDirectoryMembersQuery,
  ): Promise<DirectoryMemberDto[] | null> {
    try {
      const workspaceId = WorkspaceId.of(query.workspaceId);

      if (!(await this.directory.find(workspaceId))) {
        return null;
      }

      const everyone = await this.members.listForWorkspace(workspaceId);

      return everyone.map((member) => ({
        userId: member.id,
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
