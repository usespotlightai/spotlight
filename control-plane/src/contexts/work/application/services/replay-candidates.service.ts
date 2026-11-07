import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { ContentHashPort } from '@work/application/ports/content-hash.port';
import type {
  CandidateScoring,
  ConfigHashes,
  LiveStation,
  ReplayCandidatesPort,
  ReplayStation,
  ReplayThreshold,
  StationSearchPolicy,
  ValidatedCandidate,
} from '@work/application/ports/replay-candidates.port';
import type {
  CandidateLines,
  StationInLine,
} from '@work/application/services/candidate-lines.service';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { ReplayThreshold as LineReplayThreshold } from '@work/domain/value-objects/replay-threshold';
import type { SearchSettings } from '@work/domain/value-objects/search-settings';
import type { Station } from '@work/domain/value-objects/station.vo';
import type { StationConfig } from '@work/domain/value-objects/station-config.vo';

const UNSTARTABLE: ValidatedCandidate = {
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
  judge: station.judge && {
    rubric: station.judge.rubric,
    claims: station.judge.claims,
    passThreshold: station.judge.passThreshold,
  },
  rubricVersion: config.parts.judge?.rubricHash ?? null,
});

const thresholdOf = (
  policy: LineReplayThreshold | null,
): ReplayThreshold | null =>
  policy && {
    maxRegressions: policy.maxRegressions,
    ceiling: policy.ceiling,
    currency: policy.currency,
    minGain: policy.minGain,
  };

const searchOf = (policy: SearchSettings | null): StationSearchPolicy | null =>
  policy && {
    enabled: policy.enabled,
    monthlyCeiling: policy.monthlyCeiling,
    currency: policy.currency,
    ceiling: policy.ceiling,
    periodMilliseconds: policy.periodMilliseconds,
    onAlert: policy.onAlert,
    cooldownMilliseconds: policy.cooldownMilliseconds,
    agent: policy.agent && { ...policy.agent },
    iterations: policy.iterations,
    repeats: policy.repeats,
    objective: policy.objective,
  };

const stationOf = ({ line, station }: StationInLine): ReplayStation => ({
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
    private readonly hash: ContentHashPort,
  ) {}

  private hashesOf(
    line: LineMap,
    station: Station,
    config: StationConfig,
  ): ConfigHashes {
    const behaviour = this.hash.sha256(
      JSON.stringify({
        fingerprint: config.fingerprint,
        options: line.optionsFrom(station.id).map((each) => each.word),
        ends: station.ends,
      }),
    );

    return {
      behaviour,
      scoring: this.hash.sha256(
        JSON.stringify({
          behaviour,
          check: station.check,
          diffs: station.diffs,
          judge: config.parts.judge?.rubricHash ?? null,
        }),
      ),
    };
  }

  async station(
    lineId: string,
    stationId: string,
  ): Promise<ReplayStation | null> {
    const current = await this.candidates.live(lineId, stationId);

    return current ? stationOf(current) : null;
  }

  async findStation(stationId: string): Promise<ReplayStation | null> {
    const current = await this.candidates.withStationId(stationId);

    return current ? stationOf(current) : null;
  }

  async keyed(lineId: string, key: string): Promise<ReplayStation | null> {
    const current = await this.candidates.keyed(lineId, key);

    return current ? stationOf(current) : null;
  }

  async validate(
    lineId: string,
    stationId: string,
    station: unknown,
    repositories?: unknown,
  ): Promise<ValidatedCandidate | null> {
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
    const normalised = built.definition;

    return config && live
      ? {
          ok: true,
          fingerprint: config.fingerprint,
          hashes: this.hashesOf(built.line, built.station, config),
          liveHashes: this.hashesOf(current.line, current.station, live),
          scoring: scoringOf(built.station, config),
          live: live.fingerprint,
          changes: config.changesFrom(live),
          station: normalised,
        }
      : UNSTARTABLE;
  }

  async live(lineId: string, stationId: string): Promise<LiveStation | null> {
    const current = await this.candidates.live(lineId, stationId);
    const block = current ? this.candidates.liveBlockOf(current) : null;
    const config = current
      ? await this.candidates.configOf(current.line, current.station)
      : null;

    return current && block && config
      ? {
          lineKey: current.line.key.value,
          station: block,
          fingerprint: config.fingerprint,
          scoring: scoringOf(current.station, config),
          hashes: this.hashesOf(current.line, current.station, config),
          replayCheck: thresholdOf(current.line.replayCheck),
          search: searchOf(current.station.search),
          agent: current.station.harness && {
            harness: current.station.harness.value,
            model: current.station.model?.value ?? null,
            effort: current.station.effort?.value ?? null,
          },
        }
      : null;
  }
}
