import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import { tombstonesExpiredBefore } from '@outcomes/domain/services/pull-request-tombstone';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';

const DROPPED_AT_ONCE = 500;

const EVERY_MS = 60 * 60_000;

export class DropExpiredTombstones implements PendingJobsPort {
  readonly name = 'Dropping what GitHub forgot long ago';

  #droppedAt: number | null = null;

  constructor(
    private readonly forgotten: ForgottenPort,
    private readonly clock: ClockPort,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();

    if (
      this.#droppedAt !== null &&
      now.getTime() - this.#droppedAt < EVERY_MS
    ) {
      return;
    }

    this.#droppedAt = now.getTime();
    const before = tombstonesExpiredBefore(now);

    while (
      (await this.forgotten.dropTombstonesBefore(before, DROPPED_AT_ONCE)) ===
      DROPPED_AT_ONCE
    ) {}
  }
}
