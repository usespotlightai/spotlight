import type {
  QueuedWorkPort,
  WaitingWork,
} from '@runners/application/ports/queued-work.port';
import type { QueuedPlacementsPort } from '@runs/application/ports/queued-placements.port';
import { poolCouldTake } from '@runs/domain/services/pool-fit';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// Answers Runners which work waits that a runner with some labels could take.
export class RunsQueuedWork implements QueuedWorkPort {
  constructor(private readonly queued: QueuedPlacementsPort) {}

  async waitingIn(workspaceId: WorkspaceId, now: Date): Promise<WaitingWork> {
    const placements = await this.queued.unclaimedIn(workspaceId, now);

    return {
      couldBeTakenWith: (labels) => {
        const offer = RunnerOffer.of(labels);

        return placements.some((each) => poolCouldTake(each, offer));
      },
    };
  }
}
