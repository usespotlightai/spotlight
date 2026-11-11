import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const TURN_RETAKES = Symbol('TURN_RETAKES');

export interface TurnRetakeClaim {
  readonly runId: RunId;
  readonly suspendedAt: Date;
  readonly attempt: number;
  readonly from: Date | null;
  readonly to: Date;
  readonly retakes: boolean;
}

export interface DueRetake {
  readonly runId: RunId;
  readonly suspendedAt: Date;
  readonly attempt: number;
  readonly tries: number;
  readonly leaseToken: string;
}

export interface DueRetakeLease {
  readonly token: string;
  readonly now: Date;
  readonly leasedUntil: Date;
  readonly maxTries: number;
}

export interface TurnRetakesPort {
  checkedAt(runId: RunId, suspendedAt: Date): Promise<Date | null>;

  claim(claim: TurnRetakeClaim): Promise<boolean>;

  leaseNextDue(lease: DueRetakeLease): Promise<DueRetake | null>;

  retaken(retake: DueRetake): Promise<void>;

  retakeFailed(retake: DueRetake, retryAt: Date): Promise<void>;

  forgetSuspendedBefore(before: Date): Promise<void>;
}
