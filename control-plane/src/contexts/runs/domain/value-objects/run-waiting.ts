import type { RunState } from '@runs/domain/value-objects/run-state';

interface WaitingFacts {
  readonly state: RunState;
  readonly claimableFrom: Date | null;
  readonly reservedUntil: Date | null;
}

export const claimableAt = (run: WaitingFacts, now: Date): boolean =>
  run.state === 'queued' &&
  (run.claimableFrom === null || run.claimableFrom <= now);

export const waitsForAnyRunnerAt = (run: WaitingFacts, now: Date): boolean =>
  claimableAt(run, now) &&
  (run.reservedUntil === null || run.reservedUntil <= now);

// Why Spotlight provisions no runner for a queued run: only the hosts of a pull pool or a trust take it, the pools that fit it are full, only the platform pool could take it and the operator does not allow it that work, or no pool fits it.
export const WAIT_REASONS = [
  'hosts-pull',
  'no-pool-has-room',
  'platform-pool-not-allowed',
  'no-pool-matches',
] as const;

export type WaitReason = (typeof WAIT_REASONS)[number];

// Why a queued run waits, and since when.
export interface RunWait {
  readonly reason: WaitReason;
  readonly since: Date;
}

// A wait as Spotlight keeps it: it belongs to one queueing of the run.
export interface QueuedRunWait extends RunWait {
  readonly queuedAt: Date;
}

interface WaitFacts {
  readonly state: RunState;
  readonly queuedAt: Date;
  readonly reserved: boolean;
}

// A wait holds while the run is queued and no runner is reserved for it. A wait from an earlier queueing of the run no longer holds.
export const currentWait = (
  run: WaitFacts,
  wait: QueuedRunWait | null,
): RunWait | null =>
  wait &&
  run.state === 'queued' &&
  !run.reserved &&
  wait.queuedAt.getTime() === run.queuedAt.getTime()
    ? { reason: wait.reason, since: wait.since }
    : null;
