import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { RecallWords } from '@memory/domain/value-objects/recall-words.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const MEMORY_RELEVANCE = Symbol('MEMORY_RELEVANCE');

export interface MemoryRelevancePort {
  rank(
    memories: readonly MemoryId[],
    words: string,
  ): Promise<ReadonlyMap<string, number>>;

  recall(
    teamId: TeamId,
    words: RecallWords,
    max: number,
    asOf?: Date | null,
  ): Promise<readonly MemoryId[]>;
}
