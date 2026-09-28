import type { MemoryRelevancePort } from '@memory/application/ports/memory-relevance.port';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { withoutSuperseded } from '@memory/domain/services/superseded-memories';
import type { RecallWords } from '@memory/domain/value-objects/recall-words.vo';
import type { RunSite } from '@memory/domain/value-objects/run-site';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class MemoriesInReach {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly relevance: MemoryRelevancePort,
  ) {}

  async at(site: RunSite): Promise<Memory[]> {
    const applying = (await this.memories.mayReach(site)).filter((each) =>
      each.appliesAt(site),
    );

    return this.current(applying);
  }

  async recalled(
    teamId: TeamId,
    words: RecallWords,
    most: number,
  ): Promise<Memory[]> {
    const found = (
      await this.memories.findAll(
        await this.relevance.recall(teamId, words, most),
      )
    ).filter((each) => each.standsOn(teamId));

    return this.current(found);
  }

  private async current(memories: readonly Memory[]): Promise<Memory[]> {
    return withoutSuperseded(
      memories,
      await this.memories.successorsOf(memories.map((each) => each.id)),
    );
  }
}
