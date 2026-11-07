import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { RubricVersion } from '@replays/domain/value-objects/rubric-version.vo';
import type { ScoringHash } from '@replays/domain/value-objects/scoring-hash.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

interface State {
  readonly id: CandidateId;
  readonly stationId: StationId;
  readonly isLive: boolean;
  readonly isOracle: boolean;
  readonly judges: boolean;
  readonly checksChanges: boolean;
  readonly rubricVersion: RubricVersion | null;
  readonly scoringHash: ScoringHash;
  readonly basedOn: StationFingerprint;
}

export class ReplayedCandidate {
  private constructor(private readonly state: State) {}

  static of(state: State): ReplayedCandidate {
    return new ReplayedCandidate({ ...state });
  }

  get id(): CandidateId {
    return this.state.id;
  }

  get isLive(): boolean {
    return this.state.isLive;
  }

  get isOracle(): boolean {
    return this.state.isOracle;
  }

  get judges(): boolean {
    return this.state.judges;
  }

  get checksChanges(): boolean {
    return this.state.checksChanges;
  }

  get rubricVersion(): RubricVersion | null {
    return this.state.rubricVersion;
  }

  get scoringHash(): ScoringHash {
    return this.state.scoringHash;
  }

  get basedOn(): StationFingerprint {
    return this.state.basedOn;
  }

  isFor(stationId: StationId): boolean {
    return this.state.stationId.equals(stationId);
  }
}
