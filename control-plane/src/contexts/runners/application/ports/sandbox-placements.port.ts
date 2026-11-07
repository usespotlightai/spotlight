import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import type { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface SandboxPlacementsPort {
  liveKeysIn(
    workspaceId: WorkspaceId,
    heardSince: Date,
  ): Promise<readonly SandboxKey[]>;

  idleInPool(poolId: RunnerPoolId): Promise<readonly SandboxId[]>;

  unreportedStartedBefore(cutoff: Date): Promise<readonly SandboxId[]>;

  liveOnHostsSilentSince(cutoff: Date): Promise<readonly SandboxId[]>;
}
