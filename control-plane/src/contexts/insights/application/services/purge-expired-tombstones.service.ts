import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import { tombstonesExpiredBefore } from '@insights/domain/services/pull-request-tombstone';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';

const PURGE_BATCH = 500;

const EVERY_MS = 60 * 60_000;

export class PurgeExpiredTombstones implements PendingJobsPort {
  readonly name = 'Purging expired tombstones';

  #purgedAt: number | null = null;

  constructor(
    private readonly deletions: DeletionsPort,
    private readonly clock: ClockPort,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();

    if (this.#purgedAt !== null && now.getTime() - this.#purgedAt < EVERY_MS) {
      return;
    }

    this.#purgedAt = now.getTime();
    const before = tombstonesExpiredBefore(now);

    while (
      (await this.deletions.purgeTombstonesBefore(before, PURGE_BATCH)) ===
      PURGE_BATCH
    ) {}
  }
}
