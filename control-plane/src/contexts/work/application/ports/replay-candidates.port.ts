import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { HeldLineStation } from '@work/application/contracts/held-line.contract';
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
  readonly passShare: number;
}

export interface CandidateScoring {
  readonly checksChanges: boolean;
  readonly judge: CandidateJudge | null;
  readonly rubricVersion: string | null;
}

export interface ConfigDigests {
  readonly behaviour: string;
  readonly scoring: string;
}

export type ExaminedCandidate =
  | {
      readonly ok: true;
      readonly fingerprint: string;
      readonly digests: ConfigDigests;
      readonly liveDigests: ConfigDigests;
      readonly scoring: CandidateScoring;
      readonly live: string;
      readonly changes: readonly ConfigChangeShape[];
      readonly station: HeldLineStation;
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface ReplayThreshold {
  readonly mostRegressions: number;
  readonly ceiling: number;
  readonly currency: string;
  readonly minGain: number;
}

export interface LiveStation {
  readonly lineKey: string;
  readonly station: HeldLineStation;
  readonly fingerprint: string;
  readonly scoring: CandidateScoring;
  readonly digests: ConfigDigests;
  readonly replayCheck: ReplayThreshold | null;
}

export interface ReplayCandidatesPort {
  station(lineId: string, stationId: string): Promise<ReplayStation | null>;

  keyed(lineId: string, key: string): Promise<ReplayStation | null>;

  examine(
    lineId: string,
    stationId: string,
    station: unknown,
    repositories?: unknown,
  ): Promise<ExaminedCandidate | null>;

  live(lineId: string, stationId: string): Promise<LiveStation | null>;

  standingAmong(stationIds: readonly string[]): Promise<readonly string[]>;
}
