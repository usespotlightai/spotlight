import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { LineDefinitionStation } from '@work/application/contracts/line-definition.contract';
import type { ConfigChangeShape } from '@work/application/contracts/station-config.contract';

export const REPLAY_CANDIDATES = Symbol('REPLAY_CANDIDATES');

interface ReplaySource {
  readonly repository: string;
  readonly path: string;
}

export interface ReplayStation {
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly lineKey: string;
  readonly stationId: string;
  readonly key: string;
  readonly name: string;
  readonly source: ReplaySource | null;
}

interface CandidateJudge {
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
}

export interface CandidateScoring {
  readonly checksChanges: boolean;
  readonly judge: CandidateJudge | null;
  readonly rubricVersion: string | null;
}

export interface ConfigHashes {
  readonly behaviour: string;
  readonly scoring: string;
}

export type ValidatedCandidate =
  | {
      readonly ok: true;
      readonly fingerprint: string;
      readonly hashes: ConfigHashes;
      readonly liveHashes: ConfigHashes;
      readonly scoring: CandidateScoring;
      readonly live: string;
      readonly changes: readonly ConfigChangeShape[];
      readonly station: LineDefinitionStation;
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface ReplayThreshold {
  readonly maxRegressions: number;
  readonly ceiling: number;
  readonly currency: string;
  readonly minGain: number;
}

export interface LiveStation {
  readonly lineKey: string;
  readonly station: LineDefinitionStation;
  readonly fingerprint: string;
  readonly scoring: CandidateScoring;
  readonly hashes: ConfigHashes;
  readonly replayCheck: ReplayThreshold | null;
}

export interface ReplayCandidatesPort {
  station(lineId: string, stationId: string): Promise<ReplayStation | null>;

  findStation(stationId: string): Promise<ReplayStation | null>;

  keyed(lineId: string, key: string): Promise<ReplayStation | null>;

  validate(
    lineId: string,
    stationId: string,
    station: unknown,
    repositories?: unknown,
  ): Promise<ValidatedCandidate | null>;

  live(lineId: string, stationId: string): Promise<LiveStation | null>;
}
