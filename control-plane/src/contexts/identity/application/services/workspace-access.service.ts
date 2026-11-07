import type {
  TeamPermissions,
  TeamWorkspaceMembership,
  WorkspaceAccessPort,
  WorkspaceMembership,
  WorkspacePermissions,
} from '@identity/application/ports/workspace-access.port';
import type { WorkspaceRolesPort } from '@identity/application/ports/workspace-roles.port';
import type { Team } from '@identity/domain/aggregates/team.aggregate';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { TeamAccess } from '@identity/domain/services/team-access';
import { Permissions } from '@identity/domain/value-objects/permissions.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import {
  PersonPrincipal,
  type Principal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const published = (
  workspace: Workspace,
  permissions: Permissions,
): WorkspacePermissions | null =>
  permissions.reads
    ? {
        workspaceId: workspace.id,
        slug: workspace.slug.value,
        plans: permissions.plans,
        configures: permissions.configures,
        scopes: new Set(permissions.allowedScopes.map((scope) => scope.value)),
        isAdmin: permissions.isAdmin,
      }
    : null;

const permissionsIn = (
  workspace: Workspace | null,
  principal: Principal,
): WorkspacePermissions | null =>
  workspace ? published(workspace, workspace.permissionsFor(principal)) : null;

const membershipOf = (
  permissions: WorkspacePermissions,
  viewer: UserId,
): WorkspaceMembership => ({
  workspaceId: permissions.workspaceId,
  slug: permissions.slug,
  viewer,
  isAdmin: permissions.isAdmin,
});

export class WorkspaceAccess implements WorkspaceAccessPort {
  constructor(
    private readonly roles: WorkspaceRolesPort,
    private readonly workspaces: WorkspaceRepository,
    private readonly teams: TeamRepository,
  ) {}

  async viewableBy(
    viewer: UserId,
    workspaces: readonly WorkspaceId[],
  ): Promise<ReadonlySet<string>> {
    const roles = await this.roles.rolesOf(viewer, workspaces);

    return new Set(
      [...roles]
        .filter(([, role]) => Permissions.ofRole(WorkspaceRole.of(role)).reads)
        .map(([workspaceId]) => workspaceId),
    );
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

  async inWorkspaceOfTeam(
    teamId: TeamId,
    viewer: UserId,
  ): Promise<TeamWorkspaceMembership | null> {
    const permissions = await this.permissionsInWorkspaceOfTeam(
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

  async permissionsInSlug(
    slug: string,
    principal: Principal,
  ): Promise<WorkspacePermissions | null> {
    return permissionsIn(
      await this.workspaces.findBySlug(WorkspaceSlug.of(slug)),
      principal,
    );
  }

  async permissionsInWorkspaceOfTeam(
    teamId: TeamId,
    principal: Principal,
  ): Promise<TeamPermissions | null> {
    return this.grantedOnTeam(teamId, (team, workspace) =>
      published(
        workspace,
        TeamAccess.permissionsInWorkspaceOf(team, workspace, principal),
      ),
    );
  }

  async permissionsAsTeamReader(
    teamId: TeamId,
    principal: Principal,
  ): Promise<TeamPermissions | null> {
    return this.grantedOnTeam(teamId, (team, workspace) =>
      TeamAccess.readsTeam(team, workspace, principal)
        ? published(workspace, workspace.permissionsFor(principal))
        : null,
    );
  }

  mayPlan(principal: Principal): boolean {
    return Permissions.global(principal).plans;
  }

  private async grantedOnTeam(
    teamId: TeamId,
    granted: (team: Team, workspace: Workspace) => WorkspacePermissions | null,
  ): Promise<TeamPermissions | null> {
    const team = await this.teams.find(teamId);
    const workspace = team
      ? await this.workspaces.find(team.workspaceId)
      : null;
    const permissions = team && workspace ? granted(team, workspace) : null;

    return team && permissions ? { ...permissions, teamId: team.id } : null;
  }
}
