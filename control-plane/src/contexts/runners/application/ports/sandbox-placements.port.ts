import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';

export interface SandboxPlacementsPort {
  idleInPool(poolId: PoolId): Promise<readonly SandboxId[]>;

  unreportedStartedBefore(cutoff: Date): Promise<readonly SandboxId[]>;

  liveOnHostsSilentSince(cutoff: Date): Promise<readonly SandboxId[]>;
}
