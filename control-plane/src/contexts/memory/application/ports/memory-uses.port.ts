import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUse } from '@memory/domain/value-objects/memory-use';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const MEMORY_USES = Symbol('MEMORY_USES');

export interface UsedMemory {
  readonly memoryId: MemoryId;
  readonly way: MemoryUse;
}

export interface MemoryUsesPort {
  record(
    runId: RunId,
    way: MemoryUse,
    memories: readonly MemoryId[],
    at: Date,
  ): Promise<void>;

  ofRun(runId: RunId): Promise<readonly UsedMemory[]>;

  runsUsing(
    memories: readonly MemoryId[],
  ): Promise<ReadonlyMap<string, number>>;
}
