import type { ViewableWorkspacesPort } from '@identity/application/ports/viewable-workspaces.port';
import type {
  TeamMembership,
  WorkspaceAccessPort,
  WorkspaceMembership,
} from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const membershipIn = (
  workspace: Workspace,
  viewer: UserId,
): WorkspaceMembership => ({
  workspaceId: workspace.id,
  slug: workspace.slug.value,
  viewer,
  administers: workspace.administeredBy(viewer),
});

export class WorkspaceAccess implements WorkspaceAccessPort {
  constructor(
    private readonly visibility: ViewableWorkspacesPort,
    private readonly members: WorkspaceReaderPort,
    private readonly workspaces: WorkspaceRepository,
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
    const workspace = await this.workspaces.findBySlug(WorkspaceSlug.of(slug));

    return workspace?.holds(viewer) ? membershipIn(workspace, viewer) : null;
  }

  async inWorkspaceWithId(
    workspaceId: WorkspaceId,
    viewer: UserId,
  ): Promise<WorkspaceMembership | null> {
    const workspace = await this.workspaces.find(workspaceId);

    return workspace?.holds(viewer) ? membershipIn(workspace, viewer) : null;
  }

  async onTeam(teamId: string, viewer: UserId): Promise<TeamMembership | null> {
    const member = await this.members.findTeamForMember(teamId, viewer);

    if (!member) {
      return null;
    }

    const workspace = await this.workspaces.findBySlug(
      WorkspaceSlug.of(member.slug),
    );

    return workspace
      ? { ...membershipIn(workspace, viewer), teamId: TeamId.of(member.teamId) }
      : null;
  }
}
