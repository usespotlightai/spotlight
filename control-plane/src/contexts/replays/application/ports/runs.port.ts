import type { OrderedTrial } from '@replays/application/ports/station-trials.port';
import type { SearchRunFact } from '@replays/domain/services/search-reconciliation';
import type { ReplaysRequester } from '@replays/domain/value-objects/replays-requester.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNS = Symbol('REPLAYS_RUNS');

export type RunEnqueueing =
  | { readonly outcome: 'enqueued' }
  | { readonly outcome: 'refused' }
  | { readonly outcome: 'harness-unavailable' };

export type QueuedRunCancellation =
  | { readonly outcome: 'cancelled'; readonly started: boolean }
  | { readonly outcome: 'claimed' | 'ended' | 'unknown' };

export interface RunStatus extends SearchRunFact {
  readonly requester: ReplaysRequester | null;
}

export interface AgentProblem {
  readonly field: 'harness' | 'model' | 'effort';
  readonly reason: string;
}

export interface ReplayTrialRun {
  readonly run: RunId;
  readonly trial: OrderedTrial;
}

export interface SearchAgentRun {
  readonly run: RunId;
  readonly requester: ReplaysRequester;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly agent: SearchAgent;
  readonly briefing: string;
  readonly placement: RunnerPlacement;
}

export interface RunsPort {
  enqueueTrial(run: ReplayTrialRun): Promise<RunEnqueueing>;

  enqueueSearch(run: SearchAgentRun): Promise<RunEnqueueing>;

  cancel(run: RunId, reason: string): Promise<{ readonly known: boolean }>;

  cancelIfQueued(run: RunId, reason: string): Promise<QueuedRunCancellation>;

  statuses(runs: readonly RunId[]): Promise<readonly RunStatus[]>;

  leasedBy(run: RunId, runnerId: string): Promise<ReplaysRequester | null>;

  agentProblem(agent: SearchAgent): AgentProblem | null;
}
