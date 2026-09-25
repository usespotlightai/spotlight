import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { ViewableWorkspacesPort } from '@identity/application/ports/viewable-workspaces.port';
import type {
  TeamClearance,
  TeamMembership,
  WorkspaceAccessPort,
  WorkspaceClearance,
  WorkspaceMembership,
} from '@identity/application/ports/workspace-access.port';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { Clearance } from '@identity/domain/value-objects/clearance.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import {
  PersonPrincipal,
  type Principal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const clearanceIn = (
  workspace: Workspace | null,
  principal: Principal,
): WorkspaceClearance | null => {
  const cleared = workspace?.clearanceFor(principal);

  return workspace && cleared?.reads
    ? {
        workspaceId: workspace.id,
        slug: workspace.slug.value,
        configures: cleared.configures,
        managesSecrets: cleared.managesSecrets,
        managesRunners: cleared.managesRunners,
        managesTokenTrusts: cleared.managesTokenTrusts,
        administers: cleared.administers,
      }
    : null;
};

const membershipOf = (
  cleared: WorkspaceClearance,
  viewer: UserId,
): WorkspaceMembership => ({
  workspaceId: cleared.workspaceId,
  slug: cleared.slug,
  viewer,
  administers: cleared.administers,
});

export class WorkspaceAccess implements WorkspaceAccessPort {
  constructor(
    private readonly visibility: ViewableWorkspacesPort,
    private readonly workspaces: WorkspaceRepository,
    private readonly resources: IdentityResourcesPort,
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
    const cleared = clearanceIn(
      await this.workspaces.findBySlug(WorkspaceSlug.of(slug)),
      PersonPrincipal.of(viewer),
    );

    return cleared ? membershipOf(cleared, viewer) : null;
  }

  async onTeam(teamId: string, viewer: UserId): Promise<TeamMembership | null> {
    const cleared = await this.clearanceOnTeam(
      teamId,
      PersonPrincipal.of(viewer),
    );

    return cleared
      ? { ...membershipOf(cleared, viewer), teamId: cleared.teamId }
      : null;
  }

  async clearanceIn(
    workspaceId: WorkspaceId,
    principal: Principal,
  ): Promise<WorkspaceClearance | null> {
    return clearanceIn(await this.workspaces.find(workspaceId), principal);
  }

  async clearanceOnTeam(
    teamId: string,
    principal: Principal,
  ): Promise<TeamClearance | null> {
    const team = await this.resources.teamWithId(TeamId.of(teamId));
    const cleared = team
      ? await this.clearanceIn(team.workspaceId, principal)
      : null;

    return team && cleared ? { ...cleared, teamId: team.id } : null;
  }

  mayPlan(principal: Principal): boolean {
    return Clearance.beyondWorkspaces(principal).plans;
  }
}
