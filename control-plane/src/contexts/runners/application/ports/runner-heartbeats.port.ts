import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_HEARTBEATS = Symbol('RUNNER_HEARTBEATS');

export type RunnerClaims = 'reserved' | 'nothing';

export interface RunnerHeartbeat {
  readonly workspaceId: WorkspaceId;
  readonly harnesses: readonly HarnessId[];
  readonly terms: RunnerTerms;
  readonly claims: RunnerClaims;
}

export interface RunnerHeartbeatsPort {
  heartbeat(runnerId: RunnerId, at: Date): Promise<RunnerHeartbeat | null>;
}
