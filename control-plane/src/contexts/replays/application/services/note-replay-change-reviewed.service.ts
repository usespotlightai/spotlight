import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { reviewOf } from '@replays/domain/value-objects/change-checks.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class NoteReplayChangeReviewed {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly changes: ChangeReviewPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  reviewed(runId: string): Promise<void> {
    const run = RunId.of(runId);

    return this.transaction.run(async () => {
      const replay = await this.replays.ranAs(run);

      if (!replay) {
        return;
      }

      const reviewed = replay.reviewed(
        run,
        ...reviewOf(await this.changes.stacksOf(run)),
        this.clock.now(),
      );

      if (reviewed !== replay) {
        await this.replays.save(reviewed);
      }
    });
  }
}
