import type {
  MemoryConsolidationRequest,
  MemoryConsolidatorPort,
} from '@memory/application/ports/memory-consolidator.port';
import type { UpkeepSuggestion } from '@memory/domain/services/upkeep-consolidation';

/** No model consolidates memories yet: a sweep keeps its other checks. */
export class UnavailableMemoryConsolidator implements MemoryConsolidatorPort {
  async availableTo(): Promise<boolean> {
    return false;
  }

  async consolidate(
    _request: MemoryConsolidationRequest,
  ): Promise<readonly UpkeepSuggestion[]> {
    return [];
  }
}
