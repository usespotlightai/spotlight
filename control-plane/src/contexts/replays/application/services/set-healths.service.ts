import type { WorkPort } from '@replays/application/ports/work.port';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { DEFAULT_MIN_GAIN } from '@replays/domain/services/gain-estimate';
import {
  type SetHealth,
  setHealthOf,
  UNREAD_HEALTH,
} from '@replays/domain/services/set-health';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';

export interface LiveStandard {
  readonly minGain: number;
  readonly fingerprint: StationFingerprint | null;
}

interface AtStation {
  readonly lineId: string;
  readonly stationId: string;
}

export class SetHealths {
  constructor(
    private readonly work: WorkPort,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
  ) {}

  async standardAt(station: AtStation): Promise<LiveStandard> {
    const live = await this.work.live(station.lineId, station.stationId);

    return {
      minGain: live?.threshold?.minGain ?? DEFAULT_MIN_GAIN,
      fingerprint: live?.fingerprint ?? null,
    };
  }

  async standardsAt(
    stations: readonly AtStation[],
  ): Promise<ReadonlyMap<string, LiveStandard>> {
    const distinct = [
      ...new Map(stations.map((each) => [each.stationId, each])).values(),
    ];

    return new Map(
      await Promise.all(
        distinct.map(
          async (each) =>
            [each.stationId, await this.standardAt(each)] as const,
        ),
      ),
    );
  }

  async ofSet(set: ReplaySet, standard: LiveStandard): Promise<SetHealth> {
    return (
      (
        await this.ofSets([set], new Map([[set.station.stationId, standard]]))
      ).get(set.id.value) ?? UNREAD_HEALTH
    );
  }

  async ofSets(
    sets: readonly ReplaySet[],
    standards: ReadonlyMap<string, LiveStandard>,
  ): Promise<ReadonlyMap<string, SetHealth>> {
    const read = await this.replays.healthReadOfSets(
      sets.map((each) => each.id),
    );
    const replayed = [...read, ...(await this.comparisonsMissingFrom(read))];
    const configs =
      replayed.length === 0
        ? []
        : await this.candidates.findMany(
            replayed.map((each) => each.candidateId),
          );

    return new Map(
      sets.map((set) => {
        const standard = standards.get(set.station.stationId);

        return [
          set.id.value,
          standard?.fingerprint
            ? setHealthOf(
                replayed.filter((each) => each.setId.equals(set.id)),
                configs,
                standard.fingerprint,
                standard.minGain,
              )
            : UNREAD_HEALTH,
        ];
      }),
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
