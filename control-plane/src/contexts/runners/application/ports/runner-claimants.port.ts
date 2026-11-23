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

// The pool or trust that a runner came in through, with the key it has now.
export interface RunnerSource {
  readonly kind: 'pool' | 'trust';
  readonly key: string;
  // The platform pool that Spotlight adds to each workspace.
  readonly platform: boolean;
}

export interface RegisteredClaimant extends RunnerClaimant {
  // Null when the pool or trust is gone.
  readonly source: RunnerSource | null;
}

export interface RunnerClaimantsPort {
  claimantOf(runnerId: RunnerId, at: Date): Promise<RunnerClaimant | null>;

  // Also reads the pool or trust of the runner. Only a claim needs it, so the hot routes, such as lease renewals, skip the read.
  registeredClaimantOf(
    runnerId: RunnerId,
    at: Date,
  ): Promise<RegisteredClaimant | null>;
}
