import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import type { MemoryStatus } from '@memory/domain/value-objects/memory-status';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const MEMORY_LISTING = Symbol('MEMORY_LISTING');

export interface MemoryCriteria {
  readonly status: MemoryStatus;
  readonly kind: MemoryKind | null;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repository: string | null;
  readonly path: string | null;
}

export interface MemoryListingPort {
  listed(
    teamId: TeamId,
    criteria: MemoryCriteria,
  ): Promise<readonly MemoryId[]>;
}
