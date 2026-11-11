import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type {
  PairVerdict,
  Unpaired,
} from '@replays/domain/value-objects/entry-pairing.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RecordReplayPairVerdict {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  paired(run: RunId, other: RunId, verdict: PairVerdict): Promise<void> {
    return this.changing(run, (replay) => replay.pair(run, other, verdict));
  }

  failed(run: RunId, other: RunId, failure: Unpaired): Promise<void> {
    return this.changing(run, (replay) =>
      replay.recordPairingFailure(
        run,
        other,
        failure,
        this.clock.now(),
        ChangeActor.spotlight(replay.workspaceId),
      ),
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
