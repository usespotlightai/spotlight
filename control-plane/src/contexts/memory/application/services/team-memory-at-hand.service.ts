import type {
  Membership,
  PeoplePort,
} from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { TeamLayout } from '@memory/domain/services/team-layout';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class TeamMemoryAtHand {
  constructor(
    private readonly people: PeoplePort,
    private readonly memories: MemoryRepository,
    private readonly work: WorkPort,
  ) {}

  async member(teamId: string, viewerId: string): Promise<Membership> {
    const member = await this.people.memberOf(teamId, viewerId);

    if (!member) {
      throw new UnknownMemoryError(teamId);
    }

    return member;
  }

  async memory(teamId: string, memoryId: string): Promise<Memory> {
    const held = await this.memories.find(MemoryId.of(memoryId));

    if (!held || held.scope.teamId.value !== teamId) {
      throw new UnknownMemoryError(memoryId);
    }

    return held;
  }

  async layoutOf(teamId: string): Promise<TeamLayout> {
    const team = TeamId.of(teamId);

    return TeamLayout.of({
      teamId: team,
      lines: (await this.work.linesOf(team)).map((line) => ({
        id: line.id,
        stations: line.stations.map((each) => each.id),
        repositories: line.repositories,
      })),
    });
  }
}
