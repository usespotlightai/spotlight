import type { WorkPort } from '@replays/application/ports/work.port';
import { ReplaySetStationCheckDue } from '@replays/domain/events/replay-set-station-check-due.event';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class NoteLineRedefined {
  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly work: WorkPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async redefined(lineId: string): Promise<readonly DomainEvent[]> {
    return (await this.sets.ofLine(lineId))
      .filter((each) => !each.isAtGoneStation)
      .map((each) => new ReplaySetStationCheckDue(each.id, each.workspaceId));
  }

  async check(setId: ReplaySetId): Promise<void> {
    const seen = await this.sets.find(setId);

    if (
      !seen ||
      seen.isAtGoneStation ||
      (await this.work.station(seen.station.lineId, seen.station.stationId))
    ) {
      return;
    }

    await this.transaction.run(async () => {
      const set = await this.sets.find(setId);

      if (
        !set ||
        set.isAtGoneStation ||
        (await this.work.station(set.station.lineId, set.station.stationId))
      ) {
        return;
      }

      await this.sets.save(set.stationLeft(this.clock.now()));
    });
  }
}
