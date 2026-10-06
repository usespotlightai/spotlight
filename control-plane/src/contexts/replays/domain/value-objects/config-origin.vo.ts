import { InvalidConfigOriginError } from '@replays/domain/exceptions/invalid-config-origin.error';
import type { StretchStart } from '@replays/domain/services/stretch-starts';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { OriginKind } from '@replays/domain/value-objects/candidate-kind';
import type { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface OriginCandidateHeld {
  readonly id: CandidateId;
  readonly name: CandidateName;
  readonly kind: OriginKind;
  readonly searchId: SearchId | null;
  readonly createdAt: Date;
}

export interface PossibleOrigin {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly stationId: string;
  readonly fingerprint: StationFingerprint;
  readonly candidate: OriginCandidateHeld;
  readonly withdrawn: boolean;
}

export class ConfigOrigin {
  private constructor(
    readonly start: StretchStart,
    readonly origin: PossibleOrigin,
  ) {}

  static mayHaveMade(possible: PossibleOrigin, start: StretchStart): boolean {
    return (
      possible.stationId === start.stationId &&
      possible.fingerprint.equals(start.fingerprint) &&
      possible.candidate.createdAt.getTime() <= start.changedAt.getTime()
    );
  }

  static credited(start: StretchStart, possible: PossibleOrigin): ConfigOrigin {
    if (!ConfigOrigin.mayHaveMade(possible, start)) {
      throw new InvalidConfigOriginError(
        `must be a searched or proposed candidate at the station, with the config it changed to, made no later than the station changed to it at ${start.changedAt.toISOString()}`,
      );
    }

    return new ConfigOrigin(start, possible);
  }

  get lineId(): string {
    return this.origin.lineId;
  }

  get stationId(): string {
    return this.start.stationId;
  }

  get fingerprint(): StationFingerprint {
    return this.start.fingerprint;
  }

  get changedAt(): Date {
    return this.start.changedAt;
  }

  get candidate(): OriginCandidateHeld {
    return this.origin.candidate;
  }

  get withdrawn(): boolean {
    return this.origin.withdrawn;
  }
}
