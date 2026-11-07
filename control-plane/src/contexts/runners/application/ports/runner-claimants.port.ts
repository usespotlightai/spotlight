import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_CLAIMANTS = Symbol('RUNNER_CLAIMANTS');

export type RunnerClaims = 'reserved' | 'nothing';

export interface RunnerClaimant {
  readonly workspaceId: WorkspaceId;
  readonly harnesses: readonly HarnessId[];
  readonly offer: RunnerOffer;
  readonly claims: RunnerClaims;
}

export interface RunnerClaimantsPort {
  claimantOf(runnerId: RunnerId, at: Date): Promise<RunnerClaimant | null>;
}
