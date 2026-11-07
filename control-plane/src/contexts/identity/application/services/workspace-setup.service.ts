import type { TeamCreated } from '@identity/domain/events/team-created.event';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';

export const MARK_WORKSPACE_SET_UP = 'identity.mark-workspace-set-up';

export class WorkspaceSetup {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async teamCreated(created: TeamCreated): Promise<void> {
    const found = await this.workspaces.find(created.workspaceId);
    const setUp = found?.teamCreated(created.origin);

    if (found && setUp && setUp !== found) {
      await this.workspaces.save(setUp);
    }
  }
}
