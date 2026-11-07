import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  RunOrderContract,
  RunRequesterContract,
} from '@work/application/contracts/run-order.contract';
import type { RunSpecShape } from '@work/application/contracts/run-spec.contract';

export const RUNS = Symbol('REPLAYS_RUNS');

export type RunEnqueueing =
  | { readonly enqueued: true }
  | { readonly enqueued: false; readonly reason: string };

export type QueuedRunCancellation =
  | { readonly outcome: 'cancelled'; readonly started: boolean }
  | { readonly outcome: 'claimed' | 'ended' | 'unknown' };

export const RUN_STATES = [
  'queued',
  'claimed',
  'suspended',
  'completed',
  'failed',
  'cancelled',
] as const;

export type RunState = (typeof RUN_STATES)[number];

export interface RunStatus {
  readonly run: RunId;
  readonly requester: RunRequesterContract;
  readonly state: RunState;
  readonly askedAPerson: boolean;
  readonly started: boolean;
  readonly queuedAt: Date;
  readonly endedAt: Date | null;
}

export interface AgentProblem {
  readonly field: 'harness' | 'model' | 'effort';
  readonly reason: string;
}

export interface RunsPort {
  enqueue(order: RunOrderContract): Promise<RunEnqueueing>;

  cancel(run: RunId): Promise<{ readonly known: boolean }>;

  cancelIfQueued(run: RunId, reason: string): Promise<QueuedRunCancellation>;

  statuses(runs: readonly RunId[]): Promise<readonly RunStatus[]>;

  leasedBy(run: RunId, runnerId: string): Promise<RunRequesterContract | null>;

  agentProblem(agent: SearchAgent): AgentProblem | null;

  commandFor(
    agent: SearchAgent,
    requester: RunRequesterContract,
    run: RunId,
  ): RunSpecShape['command'] | null;
}
