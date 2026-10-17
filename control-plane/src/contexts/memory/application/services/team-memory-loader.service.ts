import type { WorkPort } from '@memory/application/ports/work.port';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { TeamAccess } from '@memory/domain/services/team-access';
import { TeamLayout } from '@memory/domain/services/team-layout';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';

export class TeamMemoryLoader {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly work: WorkPort,
  ) {}

  async memory(access: TeamAccess, memoryId: string): Promise<Memory> {
    const found = await this.memories.find(MemoryId.of(memoryId));

    if (!found || !access.includes(found)) {
      throw new UnknownMemoryError(memoryId);
    }

    return found;
  }

  async layoutOf(access: TeamAccess): Promise<TeamLayout> {
    return TeamLayout.of({
      teamId: access.teamId,
      lines: (await this.work.linesOf(access.teamId)).map((line) => ({
        id: line.id,
        stations: line.stations.map((each) => each.id),
        repositories: line.repositories,
      })),
    });
  }
}
