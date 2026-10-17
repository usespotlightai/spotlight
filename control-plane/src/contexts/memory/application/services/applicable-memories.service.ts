import type { MemoryRelevancePort } from '@memory/application/ports/memory-relevance.port';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { withoutSuperseded } from '@memory/domain/services/superseded-memories';
import type { RecallWords } from '@memory/domain/value-objects/recall-words.vo';
import type { RunSite } from '@memory/domain/value-objects/run-site';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ApplicableMemories {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly relevance: MemoryRelevancePort,
  ) {}

  async at(site: RunSite, asOf: Date | null = null): Promise<Memory[]> {
    const applying = (await this.memories.mayApplyAt(site, asOf)).filter(
      (each) => each.appliesAt(site),
    );

    return this.current(applying, asOf);
  }

  async recalled(
    teamId: TeamId,
    words: RecallWords,
    max: number,
    asOf: Date | null = null,
  ): Promise<Memory[]> {
    const found = (
      await this.memories.findAll(
        await this.relevance.recall(teamId, words, max, asOf),
      )
    ).filter((each) =>
      asOf ? each.activeOn(teamId, asOf) : each.isActiveOn(teamId),
    );

    return this.current(found, asOf);
  }

  private async current(
    memories: readonly Memory[],
    asOf: Date | null,
  ): Promise<Memory[]> {
    const successors = await this.memories.successorsOf(
      memories.map((each) => each.id),
    );

    return withoutSuperseded(
      memories,
      asOf ? successors.filter((each) => each.activeAt(asOf)) : successors,
    );
  }
}
