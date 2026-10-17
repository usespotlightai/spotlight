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

  async at(site: RunSite, standingAt: Date | null = null): Promise<Memory[]> {
    const applying = (await this.memories.mayReach(site, standingAt)).filter(
      (each) => each.appliesAt(site),
    );

    return this.current(applying, standingAt);
  }

  async recalled(
    teamId: TeamId,
    words: RecallWords,
    max: number,
    standingAt: Date | null = null,
  ): Promise<Memory[]> {
    const found = (
      await this.memories.findAll(
        await this.relevance.recall(teamId, words, max, standingAt),
      )
    ).filter((each) =>
      standingAt ? each.stoodOn(teamId, standingAt) : each.standsOn(teamId),
    );

    return this.current(found, standingAt);
  }

  private async current(
    memories: readonly Memory[],
    standingAt: Date | null,
  ): Promise<Memory[]> {
    const successors = await this.memories.successorsOf(
      memories.map((each) => each.id),
    );

    return withoutSuperseded(
      memories,
      standingAt
        ? successors.filter((each) => each.stoodAt(standingAt))
        : successors,
    );
  }
}
