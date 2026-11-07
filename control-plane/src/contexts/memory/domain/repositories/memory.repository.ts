import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { RunContext } from '@memory/domain/value-objects/run-context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const MEMORIES = Symbol('MEMORIES');

export interface MemoryRepository {
  add(memory: Memory): Promise<void>;

  save(memory: Memory): Promise<void>;

  remove(memory: Memory): Promise<void>;

  find(id: MemoryId): Promise<Memory | null>;

  findAll(ids: readonly MemoryId[]): Promise<readonly Memory[]>;

  ofTeam(teamId: TeamId): Promise<readonly Memory[]>;

  withHandle(teamId: TeamId, handle: MemoryHandle): Promise<Memory | null>;

  withHandles(
    teamId: TeamId,
    handles: readonly MemoryHandle[],
  ): Promise<readonly Memory[]>;

  successorsOf(ids: readonly MemoryId[]): Promise<readonly Memory[]>;

  nextHandle(): Promise<MemoryHandle>;

  mayApplyAt(
    runContext: RunContext,
    asOf?: Date | null,
  ): Promise<readonly Memory[]>;
}
