import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type { ReplayRecheckUnavailable } from '@replays/domain/events/replay-recheck-unavailable.event';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import {
  ChangeChecks,
  reviewOf,
} from '@replays/domain/value-objects/change-checks.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RecordReplayChangeReview {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly changes: ChangeReviewPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  reviewed(runId: string): Promise<void> {
    const run = RunId.of(runId);

    return this.transaction.inTransaction(async () => {
      const replay = await this.replays.ranAs(run);

      if (!replay) {
        return;
      }

      const reviewed = replay.recordReview(
        run,
        ...reviewOf(await this.changes.stacksOf(run)),
        this.clock.now(),
      );

      if (reviewed !== replay) {
        await this.replays.save(reviewed);
      }
    });
  }

  rechecked(runId: string): Promise<void> {
    const run = RunId.of(runId);

    return this.transaction.inTransaction(async () => {
      const replay = await this.replays.ranAs(run);

      if (!replay) {
        return;
      }

      const rechecked = replay.recheck(
        run,
        ChangeChecks.of(await this.changes.rechecksOf(run)),
      );

      if (rechecked !== replay) {
        await this.replays.save(rechecked);
      }
    });
  }

  recheckUnavailable(event: ReplayRecheckUnavailable): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const replay = await this.replays.find(event.replayId);
      const unchecked = replay?.recheck(event.run, ChangeChecks.of([]));

      if (replay && unchecked && unchecked !== replay) {
        await this.replays.save(unchecked);
      }
    });
  }
}
