import type { SettleSetup } from '@application/services/settle-setup.service';
import type { WorkspaceConnected } from '@domain/events/workspace-connected.event';

/**
 * When a workspace connects to a host, its teams' setup lists are settled.
 * Nothing is written to any repository here: what a team runs is written down
 * once its lines are set up, so the choices are made first.
 */
export class SettleOnConnection {
  constructor(private readonly settling: SettleSetup) {}

  async onWorkspaceConnected(event: WorkspaceConnected): Promise<void> {
    await this.settling.forWorkspace(event.workspaceId);
  }
}
