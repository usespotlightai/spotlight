import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { DEFAULT_MIN_GAIN } from '@replays/domain/services/gain-reading';
import { type SetNoise, setNoiseOf } from '@replays/domain/services/set-noise';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';

export interface LiveStandard {
  readonly minGain: number;
  readonly fingerprint: StationFingerprint | null;
}

interface AtStation {
  readonly lineId: string;
  readonly stationId: string;
}

export class SetNoises {
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

  async ofSets(
    sets: readonly ReplaySet[],
    standards: ReadonlyMap<string, LiveStandard>,
  ): Promise<ReadonlyMap<string, SetNoise | null>> {
    const measured = await this.replays.repeatedOfSets(
      sets.map((each) => each.id),
    );
    const configs =
      measured.length === 0
        ? []
        : await this.candidates.findMany(
            measured.map((each) => each.candidateId),
          );

    return new Map(
      sets.map((set) => {
        const fingerprint = standards.get(set.station.stationId)?.fingerprint;

        return [
          set.id.value,
          fingerprint
            ? setNoiseOf(
                measured.filter((each) => each.setId.equals(set.id)),
                configs,
                fingerprint,
              )
            : null,
        ];
      }),
    );
  }
}
