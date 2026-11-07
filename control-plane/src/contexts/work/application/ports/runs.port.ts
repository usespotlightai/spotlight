import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunOrderContract } from '@work/application/contracts/run-order.contract';

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

export interface RunLease {
  readonly runId: RunId;
  readonly runner: RunnerId;
}

export interface RunsPort {
  enqueue(order: RunOrderContract): Promise<RunEnqueueing>;
  requestStop(runId: RunId): Promise<void>;
  cancel(runId: RunId): Promise<RunCancellation>;
  cancelIfQueued(runId: RunId, reason: string): Promise<QueuedRunCancellation>;
  askedAPerson(lease: RunLease): Promise<void>;
}
