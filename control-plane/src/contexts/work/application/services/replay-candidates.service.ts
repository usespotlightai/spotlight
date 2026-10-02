import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { ContentDigestPort } from '@work/application/ports/content-digest.port';
import type { LineRenderingPort } from '@work/application/ports/line-rendering.port';
import type {
  CandidateScoring,
  ConfigDigests,
  ExaminedCandidate,
  LiveStation,
  ReplayCandidatesPort,
  ReplayStation,
  ReplayThreshold,
} from '@work/application/ports/replay-candidates.port';
import type {
  CandidateLines,
  StandingStation,
} from '@work/application/services/candidate-lines.service';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import type { ReplayCheckPolicy } from '@work/domain/value-objects/replay-check-policy.vo';
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

const thresholdOf = (
  policy: ReplayCheckPolicy | null,
): ReplayThreshold | null =>
  policy && {
    mostRegressions: policy.mostRegressions,
    ceiling: policy.ceiling,
    currency: policy.currency,
  };

const stationOf = ({ line, station }: StandingStation): ReplayStation => ({
  workspaceId: line.workspaceId.value,
  teamId: line.teamId.value,
  lineId: line.id.value,
  lineKey: line.key.value,
  stationId: station.id.value,
  key: station.key.value,
  name: station.name.value,
  source: line.source
    ? { repository: line.source.repository.value, path: line.source.path }
    : null,
});

export class ReplayCandidates implements ReplayCandidatesPort {
  constructor(
    private readonly candidates: CandidateLines,
    private readonly rendering: LineRenderingPort,
    private readonly digest: ContentDigestPort,
  ) {}

  private digestsOf(
    line: Line,
    station: Station,
    config: StationConfig,
  ): ConfigDigests {
    const behaviour = this.digest.sha256(
      JSON.stringify({
        fingerprint: config.fingerprint,
        options: line.optionsFrom(station.id).map((each) => each.word),
        ends: station.wayOut.ends,
      }),
    );

    return {
      behaviour,
      scoring: this.digest.sha256(
        JSON.stringify({
          behaviour,
          check: station.check?.value ?? null,
          diffs: station.diffs,
          judge: config.parts.judge?.rubricDigest ?? null,
        }),
      ),
    };
  }

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
    repositories?: unknown,
  ): Promise<ExaminedCandidate | null> {
    const standing = await this.candidates.standing(lineId, stationId);

    if (!standing) {
      return null;
    }

    const built = await this.candidates.withStation(
      standing,
      station,
      repositories,
    );

    if (!built.ok) {
      return built;
    }

    const [config, live] = await Promise.all([
      this.candidates.configOf(built.line, built.station),
      this.candidates.configOf(standing.line, standing.station),
    ]);
    const normalised = this.rendering
      .heldOf(built.line)
      .stations.find((each) => each.key === built.station.key.value);

    return config && live && normalised
      ? {
          ok: true,
          fingerprint: config.fingerprint,
          digests: this.digestsOf(built.line, built.station, config),
          liveDigests: this.digestsOf(standing.line, standing.station, live),
          scoring: scoringOf(built.station, config),
          live: live.fingerprint,
          changes: config.changesFrom(live),
          station: normalised,
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
          digests: this.digestsOf(standing.line, standing.station, config),
          replayCheck: thresholdOf(standing.line.replayCheck),
        }
      : null;
  }
}
