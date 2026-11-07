import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunOrderContract } from '@work/application/contracts/run-order.contract';
import type { RunCheckout } from '@work/domain/value-objects/run-spec.vo';

export const RUNS = Symbol('RUNS');

export type RunCancellation = {
  readonly was: 'queued' | 'claimed' | 'suspended' | 'ended' | 'unknown';
  readonly started: boolean;
};

export type QueuedRunCancellation =
  | { readonly outcome: 'cancelled'; readonly started: boolean }
  | { readonly outcome: 'claimed' | 'ended' | 'unknown' };

export type RunEnqueueing =
  | { readonly outcome: 'enqueued' }
  | { readonly outcome: 'refused'; readonly reason: string };

export type ResumedBecause = 'messages' | 'answered';

export interface StopRequest {
  readonly pendingTurn: number | null;
}

export interface RunLease {
  readonly runId: RunId;
  readonly runner: RunnerId;
}

export interface RunsPort {
  enqueue(order: RunOrderContract): Promise<RunEnqueueing>;
  requestStop(runId: RunId): Promise<StopRequest>;
  cancel(runId: RunId): Promise<RunCancellation>;
  cancelIfQueued(runId: RunId, reason: string): Promise<QueuedRunCancellation>;
  askedAPerson(lease: RunLease): Promise<void>;
  keep(runId: RunId, attempt: number): Promise<void>;
  resume(
    runId: RunId,
    attempt: number | null,
    because: ResumedBecause,
    checkouts: readonly RunCheckout[],
  ): Promise<void>;
  finish(runId: RunId, attempt: number): Promise<void>;
}
