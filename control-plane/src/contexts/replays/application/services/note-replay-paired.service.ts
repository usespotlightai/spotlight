import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayPairingFailed } from '@replays/domain/events/replay-pairing-failed.event';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { PairVerdict } from '@replays/domain/value-objects/entry-pairing.vo';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReplayRunPaired {
  readonly runId: string;
  readonly againstRunId: string;
  readonly winner: string;
  readonly model: string;
  readonly readings: readonly {
    readonly runShownFirst: boolean;
    readonly winner: string;
    readonly reasons: readonly {
      readonly text: string;
      readonly runHunks: readonly string[];
      readonly againstHunks: readonly string[];
    }[];
  }[];
  readonly spent: ModelSpent;
}

export class NoteReplayPaired {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly transaction: TransactionPort,
  ) {}

  paired(event: ReplayRunPaired): Promise<void> {
    const verdict = PairVerdict.fromWinner(event);
    const against = RunId.of(event.againstRunId);

    return this.changing(event.runId, (replay, run) =>
      replay.pair(run, against, verdict, event.spent),
    );
  }

  failed(
    runId: string,
    againstRunId: string,
    failure: string,
    spent: ModelSpent,
  ): Promise<void> {
    const against = RunId.of(againstRunId);

    return this.changing(runId, (replay, run) =>
      replay.recordPairingFailure(run, against, failure, spent),
    );
  }

  askFailed(event: ReplayPairingFailed): Promise<void> {
    return this.changing(event.run.value, (replay, run) =>
      replay.recordPairingFailure(run, event.against, event.why, null),
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
