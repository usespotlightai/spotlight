import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

interface State {
  readonly id: CandidateId;
  readonly stationId: StationId;
  readonly isLive: boolean;
  readonly fingerprint: StationFingerprint;
}

export class SeedCandidate {
  private constructor(private readonly state: State) {}

  static of(state: State): SeedCandidate {
    return new SeedCandidate({ ...state });
  }

  get id(): CandidateId {
    return this.state.id;
  }

  get isLive(): boolean {
    return this.state.isLive;
  }

  get fingerprint(): StationFingerprint {
    return this.state.fingerprint;
  }

  isFor(stationId: StationId): boolean {
    return this.state.stationId.equals(stationId);
  }
}
