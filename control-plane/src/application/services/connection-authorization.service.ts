import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export class ConnectionAuthorization {
  constructor(
    private readonly teams: WorkspaceReaderPort,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  async connectableBy(
    teamId: string,
    viewerId: string,
  ): Promise<Workspace | null> {
    const member = await this.memberOf(teamId, viewerId);

    return member?.workspace.mayBeConnectedBy(member.by)
      ? member.workspace
      : null;
  }

  async memberOf(
    teamId: string,
    viewerId: string,
  ): Promise<{ workspace: Workspace; by: UserId } | null> {
    const by = UserId.of(viewerId);
    const team = await this.teams.findTeamForMember(teamId, by);

    if (!team) {
      return null;
    }

    const workspace = await this.workspaces.findBySlug(
      WorkspaceSlug.of(team.slug),
    );

    return workspace ? { workspace, by } : null;
  }
}
