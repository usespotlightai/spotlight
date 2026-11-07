import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  TeamOriginName,
  WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { InboxScope } from '@work/application/ports/inbox-reader.port';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';

export interface SeenTeam {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly teamKey: string;
  readonly slug: string;
  readonly origin: TeamOriginName;
}

export class WorkAccess {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly teams: TeamDirectoryPort,
  ) {}

  seenTeam(teamId: TeamId, viewer: UserId): Promise<SeenTeam | null> {
    return this.workspaces.findTeamForMember(teamId, viewer);
  }

  async seesTeam(teamId: TeamId, viewer: UserId): Promise<boolean> {
    return (await this.seenTeam(teamId, viewer)) !== null;
  }

  async readsTeam(teamId: TeamId, viewer: UserId): Promise<boolean> {
    return (
      (await this.access.permissionsAsTeamReader(
        teamId,
        PersonPrincipal.of(viewer),
      )) !== null
    );
  }

  async standingOn(teamId: TeamId, viewer: UserId): Promise<TeamStanding> {
    const readsTeam = await this.readsTeam(teamId, viewer);

    return TeamStanding.of({
      readsTeam,
      seesTeam: readsTeam || (await this.seesTeam(teamId, viewer)),
    });
  }

  async isAdminOf(workspaceId: WorkspaceId, viewer: UserId): Promise<boolean> {
    const permissions = await this.access.permissionsIn(
      workspaceId,
      PersonPrincipal.of(viewer),
    );

    return permissions?.isAdmin ?? false;
  }

  async membersOf(teamId: TeamId): Promise<TeamMembers | null> {
    const team = await this.teams.find(teamId);

    return team ? TeamMembers.of(team.members) : null;
  }

  async inboxOf(slug: string, viewer: UserId): Promise<InboxScope | null> {
    const workspaceId = await this.workspaces.idForSlug(slug);

    if (!workspaceId || !(await this.access.mayView(viewer, workspaceId))) {
      return null;
    }

    const teams = await Promise.all(
      (await this.teams.inWorkspace(workspaceId)).map(async ({ id }) => ({
        id: id.value,
        seen: await this.seesTeam(id, viewer),
        read: await this.readsTeam(id, viewer),
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
}
