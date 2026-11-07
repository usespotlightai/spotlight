import type { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export const STATION_CONFIG_CANDIDATES = Symbol(
  'REPLAYS_STATION_CONFIG_CANDIDATES',
);

export interface LiveStationConfig {
  readonly lineKey: string;
  readonly fingerprint: StationFingerprint;
  readonly scoring: CandidateScoring;
  readonly hashes: StationHashes;
}

export type CandidateValidation =
  | {
      readonly ok: true;
      readonly fingerprint: StationFingerprint;
      readonly hashes: StationHashes;
      readonly liveHashes: StationHashes;
      readonly scoring: CandidateScoring;
      readonly changedFrom: StationChanges;
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface StationConfigCandidatesPort {
  live(lineId: LineId, stationId: StationId): Promise<LiveStationConfig | null>;

  validate(
    lineId: LineId,
    stationId: StationId,
    block: unknown,
    line: PlannedLine | null,
  ): Promise<CandidateValidation | null>;
}
