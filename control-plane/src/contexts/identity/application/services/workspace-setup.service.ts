import type { TeamCreated } from '@identity/domain/events/team-created.event';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';

export const MARK_WORKSPACE_SET_UP = 'identity.mark-workspace-set-up';

export class WorkspaceSetup {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async firstTeamCreated(created: TeamCreated): Promise<void> {
    if (created.origin !== 'sign-up') {
      return;
    }

    const found = await this.workspaces.find(created.workspaceId);
    const setUp = found?.firstTeamCreated();

    if (found && setUp && setUp !== found) {
      await this.workspaces.save(setUp);
    }
  }
}
