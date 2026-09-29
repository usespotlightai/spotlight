import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { SetupState } from '@work/domain/services/setup-list';

export class WorkspaceSetup {
  constructor(
    private readonly connections: WorkspaceConnectionsPort,
    private readonly runners: RunnerReaderPort,
  ) {}

  async stateOf(workspaceId: WorkspaceId): Promise<SetupState> {
    const [connectedToGitHub, hasHarness] = await Promise.all([
      this.connections.isConnected(workspaceId),
      this.runners.readyToRun(workspaceId),
    ]);

    return { connectedToGitHub, hasHarness };
  }
}
