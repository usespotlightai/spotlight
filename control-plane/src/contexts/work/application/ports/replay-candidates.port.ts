import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { HeldLineStation } from '@work/application/contracts/held-line.contract';
import type { ConfigChangeShape } from '@work/application/contracts/station-config.contract';

export const REPLAY_CANDIDATES = Symbol('REPLAY_CANDIDATES');

export interface ReplayStation {
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly lineKey: string;
  readonly stationId: string;
  readonly key: string;
  readonly name: string;
}

export interface CandidateScoring {
  readonly checksChanges: boolean;
  readonly rubric: string | null;
  readonly rubricVersion: string | null;
}

export type ExaminedCandidate =
  | {
      readonly ok: true;
      readonly fingerprint: string;
      readonly scoring: CandidateScoring;
      readonly live: string;
      readonly changes: readonly ConfigChangeShape[];
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface LiveStation {
  readonly lineKey: string;
  readonly station: HeldLineStation;
  readonly fingerprint: string;
  readonly scoring: CandidateScoring;
}

export interface ReplayCandidatesPort {
  station(lineId: string, stationId: string): Promise<ReplayStation | null>;

  keyed(lineId: string, key: string): Promise<ReplayStation | null>;

  examine(
    lineId: string,
    stationId: string,
    station: unknown,
  ): Promise<ExaminedCandidate | null>;

  live(lineId: string, stationId: string): Promise<LiveStation | null>;
}
