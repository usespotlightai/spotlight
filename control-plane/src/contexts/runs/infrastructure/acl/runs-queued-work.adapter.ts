import type { QueuedWorkPort } from '@runners/application/ports/queued-work.port';
import type { QueuedPlacementsPort } from '@runs/application/ports/queued-placements.port';
import { poolCouldTake } from '@runs/domain/services/pool-fit';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// Answers Runners whether work waits that a runner with some labels could take.
export class RunsQueuedWork implements QueuedWorkPort {
  constructor(private readonly queued: QueuedPlacementsPort) {}

  async waitsFor(
    workspaceId: WorkspaceId,
    labels: readonly string[],
    now: Date,
  ): Promise<boolean> {
    const offer = RunnerOffer.of(labels);

    return (await this.queued.unclaimedIn(workspaceId, now)).some((each) =>
      poolCouldTake(each, offer),
    );
  }
}
