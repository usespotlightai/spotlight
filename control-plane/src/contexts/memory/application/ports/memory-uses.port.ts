import type { RecordedMemoryUses } from '@memory/domain/entities/recorded-memory-uses.entity';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUse } from '@memory/domain/value-objects/memory-use';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const MEMORY_USES = Symbol('MEMORY_USES');

export interface MemoryUsesPort {
  record(uses: RecordedMemoryUses): Promise<void>;

  usedBy(runId: RunId, via: MemoryUse): Promise<readonly MemoryId[]>;

  runsUsing(
    memories: readonly MemoryId[],
    via?: MemoryUse,
  ): Promise<ReadonlyMap<string, number>>;
}
