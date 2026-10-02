import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { reviewOf } from '@replays/domain/value-objects/change-checks.vo';
import type { RunOutcome } from '@replays/domain/value-objects/replay-ending';
import { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReplayRunEnded {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly failure: string | null;
  readonly stopped: boolean;
  readonly asked: boolean;
  readonly next: string | null;
}

export class NoteReplayEnded {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly changes: ChangeReviewPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  ended(event: ReplayRunEnded): Promise<void> {
    const run = RunId.of(event.runId);

    return this.transaction.run(async () => {
      const replay = await this.replays.ranAs(run);

      if (!replay) {
        return;
      }

      const now = this.clock.now();
      const ended = replay
        .ended(
          run,
          RunEnd.of({
            outcome: event.outcome,
            failure: event.failure,
            stopped: event.stopped,
            asked: event.asked,
            next: event.next,
            at: now,
          }),
        )
        .reviewed(run, ...reviewOf(await this.changes.stacksOf(run)), now);

      if (ended !== replay) {
        await this.replays.save(ended);
      }
    });
  }
}
