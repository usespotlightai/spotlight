import type { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';

export interface SandboxPlacementsPort {
  idleInPool(poolId: PoolId): Promise<readonly SandboxId[]>;

  unreportedStartedBefore(cutoff: Date): Promise<readonly SandboxId[]>;

  liveOnHostsSilentSince(cutoff: Date): Promise<readonly SandboxId[]>;
}
