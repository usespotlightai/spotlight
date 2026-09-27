import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';

export interface MemoryRepository {
  add(memory: Memory): Promise<void>;

  save(memory: Memory): Promise<void>;

  find(id: MemoryId): Promise<Memory | null>;
}
