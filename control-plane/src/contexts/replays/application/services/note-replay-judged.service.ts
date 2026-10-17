import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayRejudgingRefused } from '@replays/domain/events/replay-rejudging-refused.event';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import {
  type CitedReason,
  JudgeVerdict,
} from '@replays/domain/value-objects/judge-verdict.vo';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReplayRunJudged {
  readonly runId: string;
  readonly scale: string;
  readonly value: number;
  readonly marks: readonly boolean[] | null;
  readonly claims: readonly string[];
  readonly passShare: number;
  readonly model: string;
  readonly referenced: boolean;
  readonly reasons: readonly CitedReason[];
  readonly spent: ModelSpent;
}

export class NoteReplayJudged {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  judged(event: ReplayRunJudged): Promise<void> {
    const verdict = JudgeVerdict.of(event);

    return this.changing(event.runId, (replay, run, now) =>
      replay.recordVerdict(run, verdict, event.spent, now),
    );
  }

  failed(runId: string, failure: string, spent: ModelSpent): Promise<void> {
    return this.changing(runId, (replay, run, now) =>
      replay.recordJudgingFailure(run, failure, spent, now),
    );
  }

  rejudged(event: ReplayRunJudged): Promise<void> {
    const verdict = JudgeVerdict.of(event);

    return this.changing(event.runId, (replay, run) =>
      replay.recordRejudgment(run, verdict, event.spent),
    );
  }

  rejudgingFailed(
    runId: string,
    failure: string,
    spent: ModelSpent,
  ): Promise<void> {
    return this.changing(runId, (replay, run) =>
      replay.recordRejudgingFailure(run, failure, spent),
    );
  }

  rejudgingRefused(event: ReplayRejudgingRefused): Promise<void> {
    return this.changing(event.run.value, (replay, run) =>
      replay.recordRejudgingFailure(run, event.why, null),
    );
  }

  private changing(
    runId: string,
    change: (replay: Replay, run: RunId, now: Date) => Replay,
  ): Promise<void> {
    const run = RunId.of(runId);

    return this.transaction.inTransaction(async () => {
      const replay = await this.replays.ranAs(run);

      if (!replay) {
        return;
      }

      const changed = change(replay, run, this.clock.now());

      if (changed !== replay) {
        await this.replays.save(changed);
      }
    });
  }
}
