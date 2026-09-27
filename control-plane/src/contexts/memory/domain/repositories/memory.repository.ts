import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import type { MemoryStanding } from '@memory/domain/value-objects/memory-standing';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface MemoryCriteria {
  readonly standing: MemoryStanding;
  readonly kind: MemoryKind | null;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repository: string | null;
  readonly path: string | null;
}

export interface MemoryRepository {
  add(memory: Memory): Promise<void>;

  save(memory: Memory): Promise<void>;

  find(id: MemoryId): Promise<Memory | null>;

  findAll(ids: readonly MemoryId[]): Promise<readonly Memory[]>;

  withHandle(teamId: TeamId, handle: MemoryHandle): Promise<Memory | null>;

  withHandles(
    teamId: TeamId,
    handles: readonly MemoryHandle[],
  ): Promise<readonly Memory[]>;

  matching(
    ids: readonly MemoryId[],
    words: string,
  ): Promise<ReadonlyMap<string, number>>;

  recalled(
    teamId: TeamId,
    words: string,
    most: number,
  ): Promise<readonly Memory[]>;

  nextHandle(): Promise<MemoryHandle>;

  mayReach(place: {
    teamId: TeamId;
    lineId: string | null;
    stationId: string | null;
    repositories: readonly Repository[];
  }): Promise<readonly Memory[]>;

  ofTeam(teamId: TeamId, criteria: MemoryCriteria): Promise<readonly Memory[]>;
}
