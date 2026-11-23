import type { WaitReason } from '@runs/domain/value-objects/run-waiting';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const RUN_WAITS = Symbol('RUN_WAITS');

// A queued run that no runner takes now, and why.
export interface WaitingRun {
  readonly runId: RunId;
  readonly reason: WaitReason;
  readonly queuedAt: Date;
}

export interface RunWaitsPort {
  // Notes why each run waits, as of one time. The time a run waits since follows waitSince.
  note(waiting: readonly WaitingRun[], at: Date): Promise<void>;
}
