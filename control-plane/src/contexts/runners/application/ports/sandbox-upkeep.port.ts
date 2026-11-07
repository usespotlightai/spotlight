import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';

export const SANDBOX_UPKEEP = Symbol('SANDBOX_UPKEEP');

export interface SandboxUpkeepPort {
  toDrainOn(host: RunnerHost): Promise<readonly string[]>;

  droppedBy(hostId: HostId, sandboxId: SandboxId, at: Date): Promise<void>;

  drainIdle(now: Date): Promise<void>;
}
