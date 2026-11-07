import type {
  TeamOriginName,
  WorkspaceDetail,
  WorkspaceListing,
  WorkspaceProfile,
  WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import type { WorkspaceRecordsPort } from '@identity/application/ports/workspace-records.port';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { TeamAccess } from '@identity/domain/services/team-access';
import { Permissions } from '@identity/domain/value-objects/permissions.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceReader implements WorkspaceReaderPort {
  constructor(
    private readonly records: WorkspaceRecordsPort,
    private readonly workspaces: WorkspaceRepository,
    private readonly teams: TeamRepository,
  ) {}

  async listForMember(userId: UserId): Promise<WorkspaceListing[]> {
    return (await this.records.listingsOf(userId)).filter(
      (each) => Permissions.ofRole(WorkspaceRole.of(each.role)).reads,
    );
  }

  idForSlug(slug: string): Promise<string | null> {
    return this.records.idForSlug(slug);
  }

  slugOf(workspaceId: string): Promise<string | null> {
    return this.records.slugOf(workspaceId);
  }

  profileOf(workspaceId: string): Promise<WorkspaceProfile | null> {
    return this.records.profileOf(workspaceId);
  }

  async isOpen(workspaceId: string): Promise<boolean> {
    return (await this.records.slugOf(workspaceId)) !== null;
  }

  identifyTeam(
    slug: string,
    teamKey: string,
  ): Promise<{ workspaceId: string; teamId: string } | null> {
    return this.records.identifyTeam(slug, teamKey);
  }

  async findTeamForMember(
    teamId: string,
    userId: UserId,
  ): Promise<{
    workspaceId: string;
    teamId: string;
    teamKey: string;
    slug: string;
    origin: TeamOriginName;
  } | null> {
    const team = await this.teams.find(TeamId.of(teamId));
    const workspace = team
      ? await this.workspaces.find(team.workspaceId)
      : null;

    return team &&
      workspace &&
      TeamAccess.permissionsInWorkspaceOf(
        team,
        workspace,
        PersonPrincipal.of(userId),
      ).reads
      ? {
          workspaceId: workspace.id.value,
          teamId: team.id.value,
          teamKey: team.key.value,
          slug: workspace.slug.value,
          origin: team.origin,
        }
      : null;
  }

  async findForMember(
    slug: string,
    userId: UserId,
  ): Promise<WorkspaceDetail | null> {
    const id = await this.records.idForSlug(slug);
    const workspace = id
      ? await this.workspaces.find(WorkspaceId.of(id))
      : null;
    const role = workspace?.roleOf(userId);

    if (
      !workspace ||
      !role ||
      !workspace.permissionsFor(PersonPrincipal.of(userId)).reads
    ) {
      return null;
    }

    return {
      id: workspace.id.value,
      name: workspace.name.value,
      slug: workspace.slug.value,
      role: role.value,
      teams: await this.records.teamsIn(workspace.id),
      setupStatus: workspace.setupStatus,
    };
  }
}
