import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type {
  LiveStationConfig,
  StationConfigCandidatesPort,
  StationConfigFacts,
  ValidatedStationConfig,
} from '@work/application/ports/station-config-candidates.port';
import type { CandidateLines } from '@work/application/services/candidate-lines.service';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import type { StationConfig } from '@work/domain/value-objects/station-config.vo';

const UNSTARTABLE: ValidatedStationConfig = {
  ok: false,
  problems: [
    ConfigurationProblem.of({
      path: '',
      at: FieldPath.of(['station', 'harness']),
      reason: 'names a harness a runner can start',
    }),
  ],
};

const factsOf = (
  line: LineMap,
  station: Station,
  config: StationConfig,
): StationConfigFacts => ({
  fingerprint: config.fingerprint,
  handoverWords: line.optionsFrom(station.id).map((each) => each.word),
  ends: station.ends,
  check: station.check,
  diffs: station.diffs,
  judge: station.judge && {
    rubric: station.judge.rubric,
    claims: station.judge.claims,
    passThreshold: station.judge.passThreshold,
  },
  rubricHash: config.parts.judge?.rubricHash ?? null,
});

export class StationConfigCandidates implements StationConfigCandidatesPort {
  constructor(private readonly candidates: CandidateLines) {}

  async validate(
    lineId: string,
    stationId: string,
    station: unknown,
    repositories?: unknown,
  ): Promise<ValidatedStationConfig | null> {
    const current = await this.candidates.live(lineId, stationId);

    if (!current) {
      return null;
    }

    const built = await this.candidates.withStation(
      current,
      station,
      repositories,
    );

    if (!built.ok) {
      return built;
    }

    const config = await this.candidates.configOf(built.line, built.station);
    const live = await this.candidates.configOf(current.line, current.station);

    return config && live
      ? {
          ok: true,
          candidate: factsOf(built.line, built.station, config),
          live: factsOf(current.line, current.station, live),
          changes: config.changesFrom(live),
        }
      : UNSTARTABLE;
  }

  async live(
    lineId: string,
    stationId: string,
  ): Promise<LiveStationConfig | null> {
    const current = await this.candidates.live(lineId, stationId);
    const config = current
      ? await this.candidates.configOf(current.line, current.station)
      : null;

    return current && config
      ? {
          lineKey: current.line.key.value,
          config: factsOf(current.line, current.station, config),
        }
      : null;
  }
}
