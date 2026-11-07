import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { ConfigChangeShape } from '@work/application/contracts/station-config.contract';

export const STATION_CONFIG_CANDIDATES = Symbol('STATION_CONFIG_CANDIDATES');

export interface StationConfigJudge {
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
}

export interface StationConfigFacts {
  readonly fingerprint: string;
  readonly handoverWords: readonly string[];
  readonly ends: boolean;
  readonly check: string | null;
  readonly diffs: boolean;
  readonly judge: StationConfigJudge | null;
  readonly rubricHash: string | null;
}

export type ValidatedStationConfig =
  | {
      readonly ok: true;
      readonly candidate: StationConfigFacts;
      readonly live: StationConfigFacts;
      readonly changes: readonly ConfigChangeShape[];
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface LiveStationConfig {
  readonly lineKey: string;
  readonly config: StationConfigFacts;
}

export interface StationConfigCandidatesPort {
  validate(
    lineId: string,
    stationId: string,
    station: unknown,
    repositories?: unknown,
  ): Promise<ValidatedStationConfig | null>;

  live(lineId: string, stationId: string): Promise<LiveStationConfig | null>;
}
