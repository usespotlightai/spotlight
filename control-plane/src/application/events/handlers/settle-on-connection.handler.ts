import type { SettleSetup } from '@application/services/settle-setup.service';
import type { WorkspaceConnected } from '@domain/events/workspace-connected.event';

export class SettleOnConnection {
  constructor(private readonly settling: SettleSetup) {}

  async onWorkspaceConnected(event: WorkspaceConnected): Promise<void> {
    await this.settling.forWorkspace(event.workspaceId);
  }
}
