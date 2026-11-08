import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import { reviseReplay } from '@replays/application/services/replay-revisions';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import {
  ChangeChecks,
  reviewOf,
} from '@replays/domain/value-objects/change-checks.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
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

  async reviewed(runId: string): Promise<void> {
    const run = RunId.of(runId);

    await reviseReplay(
      this.replays,
      this.transaction,
      () => this.replays.ranAs(run),
      async (replay) =>
        replay.recordReview(
          run,
          ...reviewOf(await this.changes.stacksOf(run)),
          this.clock.now(),
        ),
    );
  }

  async rechecked(runId: string): Promise<void> {
    const run = RunId.of(runId);

    await reviseReplay(
      this.replays,
      this.transaction,
      () => this.replays.ranAs(run),
      async (replay) =>
        replay.recheck(
          run,
          ChangeChecks.of(await this.changes.rechecksOf(run)),
        ),
    );
  }

  async recheckUnavailable(replayId: ReplayId, run: RunId): Promise<void> {
    await reviseReplay(
      this.replays,
      this.transaction,
      () => this.replays.find(replayId),
      (replay) => replay.recheck(run, ChangeChecks.of([])),
    );
  }
}
