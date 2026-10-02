import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type {
  CandidateScoring,
  ExaminedCandidate,
  LiveStation,
  ReplayCandidatesPort,
  ReplayStation,
} from '@work/application/ports/replay-candidates.port';
import type {
  CandidateLines,
  StandingStation,
} from '@work/application/services/candidate-lines.service';
import type { Station } from '@work/domain/entities/station.entity';
import type { StationConfig } from '@work/domain/value-objects/station-config.vo';

const UNSTARTABLE: ExaminedCandidate = {
  ok: false,
  problems: [
    ConfigurationProblem.of({
      path: '',
      at: FieldPath.of(['station', 'harness']),
      reason: 'names a harness a runner can start',
    }),
  ],
};

const scoringOf = (
  station: Station,
  config: StationConfig,
): CandidateScoring => ({
  checksChanges: station.diffs && station.check !== null,
  rubric: station.judge?.rubric ?? null,
  rubricVersion: config.parts.judge?.rubricDigest ?? null,
});

const stationOf = ({ line, station }: StandingStation): ReplayStation => ({
  workspaceId: line.workspaceId.value,
  teamId: line.teamId.value,
  lineId: line.id.value,
  lineKey: line.key.value,
  stationId: station.id.value,
  key: station.key.value,
  name: station.name.value,
});

export class ReplayCandidates implements ReplayCandidatesPort {
  constructor(private readonly candidates: CandidateLines) {}

  async station(
    lineId: string,
    stationId: string,
  ): Promise<ReplayStation | null> {
    const standing = await this.candidates.standing(lineId, stationId);

    return standing ? stationOf(standing) : null;
  }

  async keyed(lineId: string, key: string): Promise<ReplayStation | null> {
    const standing = await this.candidates.keyed(lineId, key);

    return standing ? stationOf(standing) : null;
  }

  async examine(
    lineId: string,
    stationId: string,
    station: unknown,
  ): Promise<ExaminedCandidate | null> {
    const standing = await this.candidates.standing(lineId, stationId);

    if (!standing) {
      return null;
    }

    const built = await this.candidates.withStation(standing, station);

    if (!built.ok) {
      return built;
    }

    const [config, live] = await Promise.all([
      this.candidates.configOf(built.line, built.station),
      this.candidates.configOf(standing.line, standing.station),
    ]);

    return config && live
      ? {
          ok: true,
          fingerprint: config.fingerprint,
          scoring: scoringOf(built.station, config),
          live: live.fingerprint,
          changes: config.changesFrom(live),
        }
      : UNSTARTABLE;
  }

  async live(lineId: string, stationId: string): Promise<LiveStation | null> {
    const standing = await this.candidates.standing(lineId, stationId);
    const block = standing ? this.candidates.liveBlockOf(standing) : null;
    const config = standing
      ? await this.candidates.configOf(standing.line, standing.station)
      : null;

    return standing && block && config
      ? {
          lineKey: standing.line.key.value,
          station: block,
          fingerprint: config.fingerprint,
          scoring: scoringOf(standing.station, config),
        }
      : null;
  }
}
