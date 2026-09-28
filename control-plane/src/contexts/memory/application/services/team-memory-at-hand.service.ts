import type { WorkPort } from '@memory/application/ports/work.port';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { MemoryClearance } from '@memory/domain/services/memory-clearance';
import { TeamLayout } from '@memory/domain/services/team-layout';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';

export class TeamMemoryAtHand {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly work: WorkPort,
  ) {}

  async memory(clearance: MemoryClearance, memoryId: string): Promise<Memory> {
    const held = await this.memories.find(MemoryId.of(memoryId));

    if (!held || !clearance.holds(held)) {
      throw new UnknownMemoryError(memoryId);
    }

    return held;
  }

  async layoutOf(clearance: MemoryClearance): Promise<TeamLayout> {
    return TeamLayout.of({
      teamId: clearance.teamId,
      lines: (await this.work.linesOf(clearance.teamId)).map((line) => ({
        id: line.id,
        stations: line.stations.map((each) => each.id),
        repositories: line.repositories,
      })),
    });
  }
}
