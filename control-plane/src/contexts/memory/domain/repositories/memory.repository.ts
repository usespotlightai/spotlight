import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import type { MemoryStanding } from '@memory/domain/value-objects/memory-standing';
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

  ofTeam(teamId: TeamId, criteria: MemoryCriteria): Promise<readonly Memory[]>;
}
