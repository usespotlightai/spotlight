import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RecordReplayVerdict {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  judged(run: RunId, verdict: JudgeVerdict, spent: ModelSpent): Promise<void> {
    return this.changing(run, (replay, now) =>
      replay.recordVerdict(run, verdict, spent, now),
    );
  }

  failed(run: RunId, failure: string, spent: ModelSpent): Promise<void> {
    return this.changing(run, (replay, now) =>
      replay.recordJudgingFailure(run, failure, spent, now),
    );
  }

  rejudged(
    run: RunId,
    verdict: JudgeVerdict,
    spent: ModelSpent,
  ): Promise<void> {
    return this.changing(run, (replay) =>
      replay.recordRejudgment(run, verdict, spent),
    );
  }

  rejudgingFailed(
    run: RunId,
    failure: string,
    spent: ModelSpent | null,
  ): Promise<void> {
    return this.changing(run, (replay) =>
      replay.recordRejudgingFailure(run, failure, spent),
    );
  }

  private changing(
    run: RunId,
    change: (replay: Replay, now: Date) => Replay,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const replay = await this.replays.ranAs(run);

      if (!replay) {
        return;
      }

      const changed = change(replay, this.clock.now());

      if (changed !== replay) {
        await this.replays.save(changed);
      }
    });
  }
}
