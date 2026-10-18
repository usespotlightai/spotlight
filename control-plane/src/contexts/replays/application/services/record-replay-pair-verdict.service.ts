import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayPairingFailed } from '@replays/domain/events/replay-pairing-failed.event';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { PairVerdict } from '@replays/domain/value-objects/entry-pairing.vo';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReplayRunPaired {
  readonly runId: string;
  readonly otherRunId: string;
  readonly winner: string;
  readonly model: string;
  readonly passes: readonly {
    readonly runShownFirst: boolean;
    readonly winner: string;
    readonly reasons: readonly {
      readonly text: string;
      readonly runHunks: readonly string[];
      readonly otherHunks: readonly string[];
    }[];
  }[];
  readonly spent: ModelSpent;
}

export class RecordReplayPairVerdict {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly transaction: TransactionPort,
  ) {}

  paired(event: ReplayRunPaired): Promise<void> {
    const verdict = PairVerdict.fromWinner(event);
    const other = RunId.of(event.otherRunId);

    return this.changing(event.runId, (replay, run) =>
      replay.pair(run, other, verdict, event.spent),
    );
  }

  failed(
    runId: string,
    otherRunId: string,
    failure: string,
    spent: ModelSpent,
  ): Promise<void> {
    const other = RunId.of(otherRunId);

    return this.changing(runId, (replay, run) =>
      replay.recordPairingFailure(run, other, failure, spent),
    );
  }

  requestFailed(event: ReplayPairingFailed): Promise<void> {
    return this.changing(event.run.value, (replay, run) =>
      replay.recordPairingFailure(run, event.other, event.why, null),
    );
  }

  private changing(
    runId: string,
    change: (replay: Replay, run: RunId) => Replay,
  ): Promise<void> {
    const run = RunId.of(runId);

    return this.transaction.inTransaction(async () => {
      const replay = await this.replays.ranAs(run);

      if (!replay) {
        return;
      }

      const changed = change(replay, run);

      if (changed !== replay) {
        await this.replays.save(changed);
      }
    });
  }
}
