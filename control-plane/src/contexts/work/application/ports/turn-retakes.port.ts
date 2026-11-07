import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const TURN_RETAKES = Symbol('TURN_RETAKES');

export interface TurnRetakesPort {
  checkedAt(runId: RunId, suspendedAt: Date): Promise<Date | null>;

  advance(
    runId: RunId,
    suspendedAt: Date,
    from: Date | null,
    to: Date,
  ): Promise<boolean>;

  forgetSuspendedBefore(before: Date): Promise<void>;
}
