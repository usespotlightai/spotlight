import type { DeleteReplayRunDecisions } from '@replays/application/services/delete-replay-run-decisions.service';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';

const EVERY_MS = 60 * 60_000;

const ORPHANED_AFTER_MS = 60 * 60_000;

export class PurgeOrphanedReplayRunDecisions implements PendingJobsPort {
  readonly name = 'Purging run decisions of deleted replays';

  #purgedAt: number | null = null;

  constructor(
    private readonly deleting: DeleteReplayRunDecisions,
    private readonly clock: ClockPort,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();

    if (this.#purgedAt !== null && now.getTime() - this.#purgedAt < EVERY_MS) {
      return;
    }

    this.#purgedAt = now.getTime();
    await this.deleting.ofDeletedReplays(
      new Date(now.getTime() - ORPHANED_AFTER_MS),
    );
  }
}
