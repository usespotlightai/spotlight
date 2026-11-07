import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type {
  PairVerdict,
  Unpaired,
} from '@replays/domain/value-objects/entry-pairing.vo';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RecordReplayPairVerdict {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly transaction: TransactionPort,
  ) {}

  paired(
    run: RunId,
    other: RunId,
    verdict: PairVerdict,
    spent: ModelSpent,
  ): Promise<void> {
    return this.changing(run, (replay) =>
      replay.pair(run, other, verdict, spent),
    );
  }

  failed(
    run: RunId,
    other: RunId,
    failure: Unpaired,
    spent: ModelSpent | null,
  ): Promise<void> {
    return this.changing(run, (replay) =>
      replay.recordPairingFailure(run, other, failure, spent),
    );
  }

  private changing(
    run: RunId,
    change: (replay: Replay) => Replay,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const replay = await this.replays.ranAs(run);

      if (!replay) {
        return;
      }

      const changed = change(replay);

      if (changed !== replay) {
        await this.replays.save(changed);
      }
    });
  }
}
