import type { StationConfigs } from '@replays/application/services/station-configs.service';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { minGainUnder } from '@replays/domain/services/gain-estimate';
import {
  HEALTH_SAMPLES_PER_GROUP,
  healthSamplesOf,
  type SetHealth,
  setHealthOf,
  UNREAD_HEALTH,
  wantsCalibration,
} from '@replays/domain/services/set-health';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export interface LiveStandard {
  readonly minGain: number;
  readonly threshold: ReplayThreshold | null;
  readonly fingerprint: StationFingerprint | null;
}

interface AtStation {
  readonly lineId: LineId;
  readonly stationId: StationId;
}

export class SetHealths {
  constructor(
    private readonly configs: StationConfigs,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
  ) {}

  async standardAt(station: AtStation): Promise<LiveStandard> {
    const live = await this.configs.live(station.lineId, station.stationId);

    return {
      minGain: minGainUnder(live?.threshold ?? null),
      threshold: live?.threshold ?? null,
      fingerprint: live?.fingerprint ?? null,
    };
  }

  async standardsAt(
    stations: readonly AtStation[],
  ): Promise<ReadonlyMap<string, LiveStandard>> {
    const distinct = [
      ...new Map(stations.map((each) => [each.stationId.value, each])).values(),
    ];

    return new Map(
      await Promise.all(
        distinct.map(
          async (each) =>
            [each.stationId.value, await this.standardAt(each)] as const,
        ),
      ),
    );
  }

  async ofSet(set: ReplaySet, standard: LiveStandard): Promise<SetHealth> {
    return (
      (
        await this.ofSets(
          [set],
          new Map([[set.station.stationId.value, standard]]),
        )
      ).get(set.id.value) ?? UNREAD_HEALTH
    );
  }

  async ofSets(
    sets: readonly ReplaySet[],
    standards: ReadonlyMap<string, LiveStandard>,
  ): Promise<ReadonlyMap<string, SetHealth>> {
    const read = healthSamplesOf(
      await this.replays.healthSamplesOfSets(
        sets.map((each) => each.id),
        HEALTH_SAMPLES_PER_GROUP,
      ),
    );
    const replayed = [
      ...read,
      ...(await this.comparisonsMissingFrom(read)),
    ].map((each) => each.outcome());
    const candidates =
      replayed.length === 0
        ? []
        : await this.candidates.findMany(
            replayed.map((each) => each.candidateId),
          );

    return new Map(
      sets.map((set) => {
        const standard = standards.get(set.station.stationId.value);

        return [
          set.id.value,
          standard?.fingerprint
            ? setHealthOf(
                replayed.filter((each) => each.setId.equals(set.id)),
                candidates,
                standard.fingerprint,
                standard.minGain,
              )
            : UNREAD_HEALTH,
        ];
      }),
    );
  }

  async calibrationWanted(
    set: ReplaySet,
    liveFingerprint: StationFingerprint,
  ): Promise<boolean> {
    const replays = await this.replays.ofSet(set.id);
    const candidates = await this.candidates.findMany(
      replays.map((each) => each.candidateId),
    );

    return wantsCalibration(
      set,
      replays.map((each) => each.outcome()),
      candidates,
      liveFingerprint,
    );
  }

  private async comparisonsMissingFrom(
    read: readonly Replay[],
  ): Promise<readonly Replay[]> {
    const missing = read.flatMap((each) =>
      each.referenceReplayId &&
      !read.some((other) => each.referenceReplayId?.equals(other.id))
        ? [each.referenceReplayId]
        : [],
    );
    const found = await Promise.all(
      missing.map((each) => this.replays.find(each)),
    );

    return found.flatMap((each) => (each ? [each] : []));
  }
}
