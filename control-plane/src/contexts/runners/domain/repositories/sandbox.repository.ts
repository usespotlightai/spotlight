import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface SandboxRepository {
  add(sandbox: Sandbox): Promise<void>;

  save(sandbox: Sandbox): Promise<void>;

  find(id: SandboxId): Promise<Sandbox | null>;

  openFor(workspaceId: WorkspaceId, key: SandboxKey): Promise<Sandbox | null>;

  liveByTokenHash(hash: TokenHash): Promise<Sandbox | null>;

  requestedIn(
    workspaceId: WorkspaceId,
    limit: number,
  ): Promise<readonly Sandbox[]>;

  liveOn(hostId: HostId): Promise<readonly Sandbox[]>;

  liveIn(workspaceId: WorkspaceId): Promise<readonly Sandbox[]>;

  openWarm(): Promise<readonly Sandbox[]>;

  openWarmIn(workspaceId: WorkspaceId): Promise<readonly Sandbox[]>;

  lostWarmSince(cutoff: Date): Promise<readonly Sandbox[]>;

  holdingRun(runId: RunId): Promise<readonly Sandbox[]>;

  idleSince(cutoff: Date): Promise<readonly Sandbox[]>;

  withArchiveLeaseRenewedBefore(cutoff: Date): Promise<readonly Sandbox[]>;

  goneBefore(cutoff: Date): Promise<readonly Sandbox[]>;

  remove(sandbox: Sandbox): Promise<void>;
}
