import type { QueuedWorkPort } from '@runners/application/ports/queued-work.port';
import type { QueuedPlacementsPort } from '@runs/application/ports/queued-placements.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// Answers Runners whether work waits for a runner in a workspace.
export class RunsQueuedWork implements QueuedWorkPort {
  constructor(private readonly queued: QueuedPlacementsPort) {}

  async waitsIn(workspaceId: WorkspaceId, now: Date): Promise<boolean> {
    return (await this.queued.unclaimedIn(workspaceId, now)).length > 0;
  }
}
