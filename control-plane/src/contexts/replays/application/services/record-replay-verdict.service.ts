import { reviseReplay } from '@replays/application/services/replay-revisions';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { Unjudged } from '@replays/domain/value-objects/entry-judging.vo';
import type { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import {
  type JudgingAttempt,
  judgingPurposeOf,
} from '@replays/domain/value-objects/judging-attempt';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RecordReplayVerdict {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  changeJudged(
    attempt: JudgingAttempt,
    run: RunId,
    verdict: JudgeVerdict,
  ): Promise<void> {
    return judgingPurposeOf(attempt) === 'original'
      ? this.judged(run, verdict)
      : this.rejudged(run, verdict);
  }

  changeJudgingFailed(
    attempt: JudgingAttempt,
    run: RunId,
    failure: Unjudged,
  ): Promise<void> {
    return judgingPurposeOf(attempt) === 'original'
      ? this.failed(run, failure)
      : this.rejudgingFailed(run, failure);
  }

  judged(run: RunId, verdict: JudgeVerdict): Promise<void> {
    return this.changing(run, (replay, now) =>
      replay.recordVerdict(run, verdict, now),
    );
  }

  failed(run: RunId, failure: Unjudged): Promise<void> {
    return this.changing(run, (replay, now) =>
      replay.recordJudgingFailure(
        run,
        failure,
        now,
        ChangeActor.spotlight(replay.workspaceId),
      ),
    );
  }

  rejudged(run: RunId, verdict: JudgeVerdict): Promise<void> {
    return this.changing(run, (replay) =>
      replay.recordRejudgment(run, verdict),
    );
  }

  rejudgingFailed(run: RunId, failure: Unjudged): Promise<void> {
    return this.changing(run, (replay) =>
      replay.recordRejudgingFailure(run, failure),
    );
  }

  private async changing(
    run: RunId,
    change: (replay: Replay, now: Date) => Replay,
  ): Promise<void> {
    await reviseReplay(
      this.replays,
      this.transaction,
      this.clock,
      () => this.replays.ranAs(run),
      (replay) => change(replay, this.clock.now()),
    );
  }
}
