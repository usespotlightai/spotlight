import type { PullRequestRecordRepository } from '@insights/domain/repositories/pull-request-record.repository';
import { tombstonesExpiredBefore } from '@insights/domain/services/pull-request-tombstone';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

const PURGE_BATCH = 500;

const EVERY_MS = 60 * 60_000;

export class PurgeExpiredTombstones implements PendingJobsPort {
  readonly name = 'Purging expired tombstones';

  #purgedAt: number | null = null;

  constructor(
    private readonly records: PullRequestRecordRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();

    if (this.#purgedAt !== null && now.getTime() - this.#purgedAt < EVERY_MS) {
      return;
    }

    this.#purgedAt = now.getTime();
    const expiredBefore = tombstonesExpiredBefore(now);

    for (;;) {
      const expired = (
        await this.records.tombstonesBefore(expiredBefore, PURGE_BATCH)
      ).filter((each) => each.tombstoneExpiredBefore(expiredBefore));

      for (const record of expired) {
        await this.transaction.inTransaction(() =>
          this.records.remove(record.erased()),
        );
      }

      if (expired.length < PURGE_BATCH) {
        break;
      }
    }
  }
}
