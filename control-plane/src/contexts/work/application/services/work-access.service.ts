import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  WorkspaceAccessPort,
  WorkspaceTeamAccess,
} from '@identity/application/ports/workspace-access.port';
import type {
  TeamOriginName,
  WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { InboxScope } from '@work/application/ports/inbox-reader.port';
import { ChatAccess } from '@work/domain/services/chat-access';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';

export interface SeenTeam {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly teamKey: string;
  readonly slug: string;
  readonly origin: TeamOriginName;
}

const inboxScopeOf = (
  access: WorkspaceTeamAccess,
  viewer: UserId,
): InboxScope => ({
  workspaceId: access.workspaceId.value,
  viewer,
  teamsSeen: new Set(
    access.teams.filter((each) => each.sees).map((each) => each.teamId.value),
  ),
  teamsActedOn: new Set(
    access.teams.filter((each) => each.actsOn).map((each) => each.teamId.value),
  ),
});

export class WorkAccess {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly teams: TeamDirectoryPort,
  ) {}

  seenTeam(teamId: TeamId, viewer: UserId): Promise<SeenTeam | null> {
    return this.workspaces.findTeamForViewer(teamId, viewer);
  }

  async seesTeam(teamId: TeamId, viewer: UserId): Promise<boolean> {
    return (await this.seenTeam(teamId, viewer)) !== null;
  }

  async actsOnTeam(teamId: TeamId, viewer: UserId): Promise<boolean> {
    return (
      (await this.access.permissionsAsTeamMember(
        teamId,
        PersonPrincipal.of(viewer),
      )) !== null
    );
  }

  async standingOn(teamId: TeamId, viewer: UserId): Promise<TeamStanding> {
    const actsOnTeam = await this.actsOnTeam(teamId, viewer);

    return TeamStanding.of({
      actsOnTeam,
      seesTeam: actsOnTeam || (await this.seesTeam(teamId, viewer)),
    });
  }

  seesWorkspace(workspaceId: WorkspaceId, viewer: UserId): Promise<boolean> {
    return this.access.mayView(viewer, workspaceId);
  }

  async seesWorkspaceOfTeam(teamId: TeamId, viewer: UserId): Promise<boolean> {
    const team = await this.teams.find(teamId);

    return team !== null && this.seesWorkspace(team.workspaceId, viewer);
  }

  async memberWorkspaceAt(
    slug: string,
    viewer: UserId,
  ): Promise<WorkspaceId | null> {
    return (await this.access.inWorkspace(slug, viewer))?.workspaceId ?? null;
  }

  async opensChat(
    chat: { readonly startedBy: UserId; readonly teamId: TeamId },
    viewer: UserId,
  ): Promise<boolean> {
    return ChatAccess.opensTo(
      chat.startedBy,
      viewer,
      await this.standingOn(chat.teamId, viewer),
    );
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

  async inboxesIn(workspaceId: WorkspaceId): Promise<InboxScope[]> {
    return (await this.access.teamAccessOfMembers(workspaceId)).map((each) =>
      inboxScopeOf(each, each.viewer),
    );
  }

  async inboxOf(slug: string, viewer: UserId): Promise<InboxScope | null> {
    const access = await this.access.teamAccessIn(slug, viewer);

    return access ? inboxScopeOf(access, viewer) : null;
  }
}
