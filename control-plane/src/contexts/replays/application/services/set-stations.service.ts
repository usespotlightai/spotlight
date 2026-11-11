import type { LinesPort } from '@replays/application/ports/lines.port';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class SetStations {
  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly lines: LinesPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async stillThere(set: ReplaySet): Promise<void> {
    if (
      set.isAtGoneStation ||
      (await this.lines.station(set.station.lineId, set.station.stationId))
    ) {
      set.stillAtItsStation();
      return;
    }

    const left = await this.transaction.inTransaction(async () => {
      const fresh = await this.sets.find(set.id);
      const gone = (fresh ?? set).stationLeft(this.clock.now());

      if (fresh && gone !== fresh) {
        await this.sets.save(gone);
      }

      return gone;
    });

    left.stillAtItsStation();
  }
}
