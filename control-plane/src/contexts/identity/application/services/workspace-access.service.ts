import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { ViewableWorkspacesPort } from '@identity/application/ports/viewable-workspaces.port';
import type {
  TeamMembership,
  TeamPermissions,
  WorkspaceAccessPort,
  WorkspaceMembership,
  WorkspacePermissions,
} from '@identity/application/ports/workspace-access.port';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { TeamAccess } from '@identity/domain/services/team-access';
import { Permissions } from '@identity/domain/value-objects/permissions.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import {
  PersonPrincipal,
  type Principal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const permissionsIn = (
  workspace: Workspace | null,
  principal: Principal,
): WorkspacePermissions | null => {
  const permissions = workspace?.permissionsFor(principal);

  return workspace && permissions?.reads
    ? {
        workspaceId: workspace.id,
        slug: workspace.slug.value,
        configures: permissions.configures,
        managesSecrets: permissions.managesSecrets,
        managesRunners: permissions.managesRunners,
        managesTokenTrusts: permissions.managesTokenTrusts,
        administers: permissions.administers,
      }
    : null;
};

const membershipOf = (
  permissions: WorkspacePermissions,
  viewer: UserId,
): WorkspaceMembership => ({
  workspaceId: permissions.workspaceId,
  slug: permissions.slug,
  viewer,
  administers: permissions.administers,
});

export class WorkspaceAccess implements WorkspaceAccessPort {
  constructor(
    private readonly visibility: ViewableWorkspacesPort,
    private readonly workspaces: WorkspaceRepository,
    private readonly resources: IdentityResourcesPort,
    private readonly teams: TeamRepository,
  ) {}

  viewableBy(
    viewer: UserId,
    workspaces: readonly WorkspaceId[],
  ): Promise<ReadonlySet<string>> {
    return this.visibility.viewableBy(viewer, workspaces);
  }

  async mayView(viewer: UserId, workspaceId: WorkspaceId): Promise<boolean> {
    return (await this.viewableBy(viewer, [workspaceId])).has(
      workspaceId.value,
    );
  }

  async inWorkspace(
    slug: string,
    viewer: UserId,
  ): Promise<WorkspaceMembership | null> {
    const permissions = permissionsIn(
      await this.workspaces.findBySlug(WorkspaceSlug.of(slug)),
      PersonPrincipal.of(viewer),
    );

    return permissions ? membershipOf(permissions, viewer) : null;
  }

  async onTeam(teamId: string, viewer: UserId): Promise<TeamMembership | null> {
    const permissions = await this.permissionsOnTeam(
      teamId,
      PersonPrincipal.of(viewer),
    );

    return permissions
      ? { ...membershipOf(permissions, viewer), teamId: permissions.teamId }
      : null;
  }

  async permissionsIn(
    workspaceId: WorkspaceId,
    principal: Principal,
  ): Promise<WorkspacePermissions | null> {
    return permissionsIn(await this.workspaces.find(workspaceId), principal);
  }

  async permissionsOnTeam(
    teamId: string,
    principal: Principal,
  ): Promise<TeamPermissions | null> {
    const team = await this.resources.teamWithId(TeamId.of(teamId));
    const permissions = team
      ? await this.permissionsIn(team.workspaceId, principal)
      : null;

    return team && permissions ? { ...permissions, teamId: team.id } : null;
  }

  async permissionsAsTeamReader(
    teamId: string,
    principal: Principal,
  ): Promise<TeamPermissions | null> {
    const team = await this.teams.find(TeamId.of(teamId));
    const workspace = team
      ? await this.workspaces.find(team.workspaceId)
      : null;

    const permissions =
      team && workspace && TeamAccess.admits(team, workspace, principal)
        ? permissionsIn(workspace, principal)
        : null;

    return team && permissions ? { ...permissions, teamId: team.id } : null;
  }

  mayPlan(principal: Principal): boolean {
    return Permissions.beyondWorkspaces(principal).plans;
  }
}
