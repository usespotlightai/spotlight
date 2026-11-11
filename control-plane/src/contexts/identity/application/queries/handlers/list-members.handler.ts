import type { MemberDto } from '@identity/application/dto/member.dto';
import type { MemberReaderPort } from '@identity/application/ports/member-reader.port';
import type { ListMembersQuery } from '@identity/application/queries/list-members.query';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { TeamAccess } from '@identity/domain/services/team-access';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListMembersHandler implements QueryHandlerPort<
  ListMembersQuery,
  MemberDto[] | null
> {
  constructor(
    private readonly teams: TeamRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly members: MemberReaderPort,
  ) {}

  async execute(query: ListMembersQuery): Promise<MemberDto[] | null> {
    try {
      const viewer = UserId.of(query.viewerId);
      const team = await this.teams.find(TeamId.of(query.teamId));
      const workspace = team
        ? await this.workspaces.find(team.workspaceId)
        : null;

      if (
        !team ||
        !workspace ||
        !TeamAccess.permissionsInWorkspaceOf(
          team,
          workspace,
          PersonPrincipal.of(viewer),
        ).reads
      ) {
        return null;
      }

      const roster = await this.members.listForTeam(team.id, workspace.id);

      return roster.map((member) => ({
        id: member.id,
        name: member.name,
        image: member.image,
        role: member.role,
        assignableRoles: workspace
          .assignableRolesFor(UserId.of(member.id), viewer)
          .map((role) => role.value),
      }));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
