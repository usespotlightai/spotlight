import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import {
  readOnce,
  reviseReplay,
} from '@replays/application/services/replay-revisions';
import { replayAskedAPerson } from '@replays/domain/aggregates/replay-run-decision.aggregate';
import type { ReplayRunDecisionRepository } from '@replays/domain/repositories/replay-run-decision.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { reviewOf } from '@replays/domain/value-objects/change-checks.vo';
import type { RunResult } from '@replays/domain/value-objects/replay-ending';
import { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReplayRunEnded {
  readonly runId: string;
  readonly outcome: RunResult;
  readonly failure: string | null;
  readonly stopped: boolean;
  readonly askedAPerson: boolean;
  readonly handsOver: boolean;
  readonly next: string | null;
  readonly endedAt: Date;
}

export class RecordReplayRunEnding {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly decisions: ReplayRunDecisionRepository,
    private readonly changes: ChangeReviewPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async ended(event: ReplayRunEnded): Promise<void> {
    const run = RunId.of(event.runId);
    const asked = replayAskedAPerson(event, await this.decisions.find(run));
    const runEnd = RunEnd.of({
      result: event.outcome,
      failure: event.failure,
      stopped: event.stopped,
      asked,
      next: event.next,
      at: event.endedAt,
    });
    const stacks = readOnce(() => this.changes.stacksOf(run));

    await reviseReplay(
      this.replays,
      this.transaction,
      this.clock,
      () => this.replays.ranAs(run),
      async (replay) =>
        replay
          .recordRunEnd(run, runEnd)
          .recordReview(run, ...reviewOf(await stacks()), this.clock.now()),
    );
  }
}
