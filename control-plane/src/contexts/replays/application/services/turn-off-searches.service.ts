import type { WorkPort } from '@replays/application/ports/work.port';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class TurnOffSearches {
  constructor(
    private readonly searches: SearchRepository,
    private readonly work: WorkPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async lineChanged(lineId: string): Promise<void> {
    for (const each of await this.searches.activeOfLine(lineId)) {
      const live = await this.work.live(lineId, each.station.stationId);

      if (!live || live.search?.enabled) {
        continue;
      }

      await this.transaction.inTransaction(async () => {
        const locked = await this.searches.locked(each.id);

        if (locked?.isActive) {
          await this.searches.save(locked.turnOff(this.clock.now()));
        }
      });
    }
  }
}
