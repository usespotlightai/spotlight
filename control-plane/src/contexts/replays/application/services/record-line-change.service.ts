import type { LinesPort } from '@replays/application/ports/lines.port';
import type { StationConfigs } from '@replays/application/services/station-configs.service';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';

export class RecordLineChange {
  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly lines: LinesPort,
    private readonly configs: StationConfigs,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async stationsLeft(lineId: LineId): Promise<void> {
    for (const seen of await this.atStationsOf(lineId)) {
      if (await this.stationExists(seen)) {
        continue;
      }

      await this.transaction.inTransaction(async () => {
        const set = await this.sets.find(seen.id);

        if (!set || set.isAtGoneStation || (await this.stationExists(set))) {
          return;
        }

        await this.sets.save(set.stationLeft(this.clock.now()));
      });
    }
  }

  async staleOraclesStopped(lineId: LineId): Promise<void> {
    for (const set of await this.atStationsOf(lineId)) {
      if (await this.stationExists(set)) {
        for (const oracle of await this.staleOraclesOf(set)) {
          await this.stopped(set, oracle);
        }
      }
    }
  }

  private async atStationsOf(lineId: LineId): Promise<readonly ReplaySet[]> {
    return (await this.sets.ofLine(lineId)).filter(
      (each) => !each.isAtGoneStation,
    );
  }

  private async stationExists(set: ReplaySet): Promise<boolean> {
    return (
      (await this.lines.station(set.station.lineId, set.station.stationId)) !==
      null
    );
  }

  private async staleOraclesOf(set: ReplaySet): Promise<readonly ReplayId[]> {
    const live = await this.configs.live(
      set.station.lineId,
      set.station.stationId,
    );
    const oracles = (await this.replays.ofSet(set.id)).filter(
      (each) => each.isOracle && each.isStoppable,
    );
    const candidates = await this.candidates.findMany(
      oracles.map((each) => each.candidateId),
    );

    return oracles
      .filter((oracle) => {
        const candidate = candidates.find((each) =>
          each.id.equals(oracle.candidateId),
        );

        return (
          !candidate || candidate.isStaleAgainst(live?.fingerprint ?? null)
        );
      })
      .map((each) => each.id);
  }

  private stopped(set: ReplaySet, oracleId: ReplayId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.sets.locked(set.id);

      const oracle = await this.replays.find(oracleId);

      if (oracle?.isStoppable) {
        await this.replays.save(
          oracle.stop(
            this.clock.now(),
            ChangeActor.spotlight(oracle.workspaceId),
            'stale',
          ),
        );
      }
    });
  }
}
