import type {
  MemoryUpkeepDto,
  UpkeepPersonDto,
} from '@memory/application/dto/memory-upkeep.dto';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { ReadMemoryUpkeepQuery } from '@memory/application/queries/read-memory-upkeep.query';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { MemoryUpkeepRepository } from '@memory/domain/repositories/memory-upkeep.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { inactiveOf } from '@memory/domain/services/memory-lapse';
import { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadMemoryUpkeepHandler implements QueryHandlerPort<
  ReadMemoryUpkeepQuery,
  MemoryUpkeepDto | null
> {
  constructor(
    private readonly access: MemoryAccess,
    private readonly upkeeps: MemoryUpkeepRepository,
    private readonly memories: MemoryRepository,
    private readonly people: PeoplePort,
  ) {}

  async execute(query: ReadMemoryUpkeepQuery): Promise<MemoryUpkeepDto | null> {
    try {
      const access = await this.access.forTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );
      const upkeep = await this.upkeeps.find(MemoryUpkeepId.of(query.upkeepId));

      if (
        !upkeep ||
        !upkeep.teamId.equals(access.teamId) ||
        !upkeep.workspaceId.equals(access.workspaceId)
      ) {
        return null;
      }

      const found = await this.memories.findAll(
        upkeep.proposals.flatMap((each) => each.memories),
      );
      const deciders = [
        ...new Set(
          upkeep.proposals.flatMap((each) =>
            each.decision ? [each.decision.by.value] : [],
          ),
        ),
      ];
      const names = new Map(
        await Promise.all(
          deciders.map(
            async (each) =>
              [
                each,
                (await this.people.find(UserId.of(each)))?.name ?? null,
              ] as const,
          ),
        ),
      );
      const personOf = (id: string): UpkeepPersonDto => ({
        id,
        name: names.get(id) ?? null,
      });

      return {
        id: upkeep.id.value,
        teamId: upkeep.teamId.value,
        sweptAt: upkeep.sweptAt.toISOString(),
        proposals: upkeep.proposals.map((each) => ({
          id: each.id.value,
          change: each.change,
          finding: each.finding,
          reason: each.reason,
          state: each.state,
          body: each.body?.value ?? null,
          memories: each.memories.flatMap((id) => {
            const memory = found.find((one) => one.id.equals(id));
            return memory && access.includes(memory)
              ? [
                  {
                    id: memory.id.value,
                    handle: memory.handle.value,
                    kind: memory.kind,
                    body: memory.body.value,
                    status: memory.status,
                  },
                ]
              : [];
          }),
          decidedBy: each.decision ? personOf(each.decision.by.value) : null,
          decidedAt: each.decision?.at.toISOString() ?? null,
          inactiveMemories: each.pending
            ? inactiveOf(each.memories, found, upkeep.teamId)
            : [],
        })),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
