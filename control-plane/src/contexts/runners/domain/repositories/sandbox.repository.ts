import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import type { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface SandboxRepository {
  add(sandbox: Sandbox): Promise<void>;

  save(sandbox: Sandbox): Promise<void>;

  find(id: SandboxId): Promise<Sandbox | null>;

  openFor(workspaceId: WorkspaceId, key: SandboxKey): Promise<Sandbox | null>;

  liveOn(hostId: HostId): Promise<readonly Sandbox[]>;

  liveKeysIn(
    workspaceId: WorkspaceId,
    heardSince: Date,
  ): Promise<readonly SandboxKey[]>;

  idleInPool(poolId: RunnerPoolId): Promise<number>;

  holdingRun(runId: string): Promise<readonly Sandbox[]>;

  idleSince(cutoff: Date): Promise<readonly Sandbox[]>;

  liveOnHostsSilentSince(cutoff: Date): Promise<readonly Sandbox[]>;

  removeGoneBefore(cutoff: Date): Promise<number>;
}
