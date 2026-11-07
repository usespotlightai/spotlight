import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { InboxScope } from '@work/application/ports/inbox-reader.port';

export class WorkAccess {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly teams: TeamDirectoryPort,
  ) {}

  async inboxOf(slug: string, viewer: UserId): Promise<InboxScope | null> {
    const workspaceId = await this.workspaces.idForSlug(slug);

    if (!workspaceId || !(await this.access.mayView(viewer, workspaceId))) {
      return null;
    }

    const teams = await Promise.all(
      (await this.teams.inWorkspace(workspaceId)).map(async ({ id }) => ({
        id: id.value,
        seen: (await this.access.inWorkspaceOfTeam(id, viewer)) !== null,
        read:
          (await this.access.permissionsAsTeamReader(
            id,
            PersonPrincipal.of(viewer),
          )) !== null,
      })),
    );

    return {
      workspaceId: workspaceId.value,
      viewer,
      teamsSeen: new Set(
        teams.filter((each) => each.seen).map((each) => each.id),
      ),
      teamsRead: new Set(
        teams.filter((each) => each.read).map((each) => each.id),
      ),
    };
  }

  async seesTeam(teamId: TeamId, viewer: UserId): Promise<boolean> {
    const team = await this.teams.find(teamId);

    return team !== null && this.access.mayView(viewer, team.workspaceId);
  }
}
