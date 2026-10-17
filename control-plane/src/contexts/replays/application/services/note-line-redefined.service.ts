import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplaySetStationCheckDue } from '@replays/domain/events/replay-set-station-check-due.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class NoteLineRedefined {
  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
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

    if (!seen || seen.isAtGoneStation) {
      return;
    }

    if (await this.work.station(seen.station.lineId, seen.station.stationId)) {
      await this.staleOraclesStopped(seen);
      return;
    }

    await this.transaction.inTransaction(async () => {
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

  private staleOraclesStopped(set: ReplaySet): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const locked = await this.sets.locked(set.id);

      if (!locked) {
        return;
      }

      const live = await this.work.live(
        locked.station.lineId,
        locked.station.stationId,
      );
      const oracles = (await this.replays.ofSet(locked.id)).filter(
        (each) => each.isOracle && each.isDispatching && !each.stoppedAt,
      );
      const configs = await this.candidates.findMany(
        oracles.map((each) => each.candidateId),
      );

      for (const oracle of oracles) {
        const config = configs.find((each) =>
          each.id.equals(oracle.candidateId),
        );

        if (!live || !config?.basedOn.equals(live.fingerprint)) {
          await this.replays.save(
            oracle.stop(
              this.clock.now(),
              Attribution.spotlight(oracle.workspaceId),
            ),
          );
        }
      }
    });
  }
}
