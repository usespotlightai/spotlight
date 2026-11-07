import type { RunRequesterContract } from '@runs/application/contracts/run-order.contract';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUN_START_GATES = Symbol('RUN_START_GATES');

export type StartDecision =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'denied'; readonly reason: string }
  | { readonly kind: 'retry'; readonly because: string };

export interface StartingRun {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly requester: RunRequesterContract;
}

export interface RunStartGate {
  readonly owner: string;

  mayStart(run: StartingRun, until: Date): Promise<StartDecision>;
}

export interface RunStartGatesPort {
  register(gate: RunStartGate): void;
}
