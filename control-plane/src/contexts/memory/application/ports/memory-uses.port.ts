import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUse } from '@memory/domain/value-objects/memory-use';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const MEMORY_USES = Symbol('MEMORY_USES');

export interface UsedMemory {
  readonly memoryId: MemoryId;
  readonly via: MemoryUse;
}

export interface MemoryUsesPort {
  record(
    runId: RunId,
    via: MemoryUse,
    memories: readonly MemoryId[],
    at: Date,
  ): Promise<void>;

  ofRun(runId: RunId): Promise<readonly UsedMemory[]>;

  runsUsing(
    memories: readonly MemoryId[],
    via?: MemoryUse,
  ): Promise<ReadonlyMap<string, number>>;
}
