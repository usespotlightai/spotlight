import type { UpkeepSuggestion } from '@memory/domain/services/upkeep-consolidation';
import type { ConsolidationRound } from '@memory/domain/value-objects/consolidation-round.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

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
  readonly round: ConsolidationRound;
  /** The run whose harness, model, placement and working copy the session takes. */
  readonly basedOnRun: RunId;
  readonly groups: readonly ConsolidatedGroup[];
}

/** What the session suggested, or that it has not settled yet, or that it never will. */
export type MemoryConsolidation =
  | {
      readonly status: 'consolidated';
      readonly suggestions: readonly UpkeepSuggestion[];
    }
  | { readonly status: 'waiting' }
  | { readonly status: 'failed'; readonly reason: string };

/** A session that settled, named the way the assist context publishes it. */
export interface SettledSession {
  readonly purpose: string;
  readonly key: string;
}

export interface MemoryConsolidatorPort {
  /** Orders the session of the round the first time, and afterwards reports what it came to. */
  consolidate(
    request: MemoryConsolidationRequest,
  ): Promise<MemoryConsolidation>;

  /** The round a settled session consolidated in, or null when memory did not order it. */
  roundOf(session: SettledSession): ConsolidationRound | null;
}
