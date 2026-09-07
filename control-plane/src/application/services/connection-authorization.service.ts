import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

/**
 * Who may reach into what a team tells Spotlight about itself: an owner or an
 * admin. A connection, a secret, the repository a team reads its configuration
 * from, the team's own name — each stands in for a session at a door the whole
 * world can knock at, so who may change one is who may connect a host. The rule
 * is the workspace's (`mayBeConnectedBy`); this only finds the workspace a team
 * belongs to and asks it, the same way wherever the question comes up.
 */
export class ConnectionAuthorization {
  constructor(
    private readonly teams: WorkspaceReaderPort,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  /**
   * The workspace a team belongs to, where this person may connect its hosts;
   * null where they may not, or where there is no such team for them. Callers
   * that only need the gate read it as truthy; those that go on to change the
   * workspace are handed the aggregate rather than loading it a second time.
   */
  async connectableBy(
    teamId: string,
    viewerId: string,
  ): Promise<Workspace | null> {
    const by = UserId.of(viewerId);
    const team = await this.teams.findTeamForMember(teamId, by);

    if (!team) {
      return null;
    }

    const workspace = await this.workspaces.findBySlug(
      WorkspaceSlug.of(team.slug),
    );

    return workspace?.mayBeConnectedBy(by) ? workspace : null;
  }
}
