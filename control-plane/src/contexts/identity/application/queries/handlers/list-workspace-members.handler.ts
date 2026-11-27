import type { WorkspaceMemberDto } from '@identity/application/dto/member.dto';
import type { MemberReaderPort } from '@identity/application/ports/member-reader.port';
import type { ListWorkspaceMembersQuery } from '@identity/application/queries/list-workspace-members.query';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListWorkspaceMembersHandler implements QueryHandlerPort<
  ListWorkspaceMembersQuery,
  WorkspaceMemberDto[] | null
> {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: MemberReaderPort,
  ) {}

  async execute(
    query: ListWorkspaceMembersQuery,
  ): Promise<WorkspaceMemberDto[] | null> {
    try {
      const viewer = UserId.of(query.viewerId);
      const workspace = await this.workspaces.findBySlug(
        WorkspaceSlug.of(query.slug),
      );

      if (workspace?.hasMember(viewer) !== true) {
        return null;
      }

      const everyone = await this.members.listForWorkspace(workspace.id);

      return everyone.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        image: member.image,
        role: member.role,
        teams: member.teams,
        joinedAt: member.joinedAt.toISOString(),
        suspendedAt: member.suspendedAt?.toISOString() ?? null,
        assignableRoles: workspace
          .assignableRolesFor(UserId.of(member.id), viewer)
          .map((role) => role.value),
        mayBeSuspended: workspace.mayBeSuspended(UserId.of(member.id), viewer),
        mayBeUnsuspended: workspace.mayBeUnsuspended(
          UserId.of(member.id),
          viewer,
        ),
        mayLeave: member.id === viewer.value && workspace.mayLeave(viewer),
      }));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
