import type { UpkeepSuggestion } from '@memory/domain/services/upkeep-consolidation';

export const MEMORY_CONSOLIDATOR = Symbol('MEMORY_CONSOLIDATOR');

interface ConsolidatedMemory {
  readonly handle: string;
  readonly kind: string;
  readonly body: string;
}

export interface ConsolidatedGroup {
  readonly where: string;
  readonly memories: readonly ConsolidatedMemory[];
}

export interface MemoryConsolidationRequest {
  readonly workspaceId: string;
  readonly groups: readonly ConsolidatedGroup[];
}

export interface MemoryConsolidatorPort {
  availableTo(workspaceId: string): Promise<boolean>;

  consolidate(
    request: MemoryConsolidationRequest,
  ): Promise<readonly UpkeepSuggestion[]>;
}
