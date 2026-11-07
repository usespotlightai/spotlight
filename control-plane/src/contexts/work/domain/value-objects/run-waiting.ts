import type { RunState } from '@work/domain/value-objects/run-state';

export interface WaitingFacts {
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
