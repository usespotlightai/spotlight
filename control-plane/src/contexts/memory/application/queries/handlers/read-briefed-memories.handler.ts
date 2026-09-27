import type { TeamMemoryDto } from '@memory/application/dto/team-memory.dto';
import type { WorkPort } from '@memory/application/ports/work.port';
import type { ReadBriefedMemoriesQuery } from '@memory/application/queries/read-briefed-memories.query';
import type { TeamMemoryAtHand } from '@memory/application/services/team-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { UnknownRunError } from '@memory/domain/exceptions/unknown-run.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ReadBriefedMemoriesHandler
  implements QueryHandlerPort<ReadBriefedMemoriesQuery, TeamMemoryDto[]>
{
  constructor(
    private readonly atHand: TeamMemoryAtHand,
    private readonly work: WorkPort,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: ReadBriefedMemoriesQuery): Promise<TeamMemoryDto[]> {
    try {
      const member = await this.atHand.member(query.teamId, query.viewerId);
      const run = await this.work.run(RunId.of(query.runId));

      if (!run?.workspaceId.equals(member.workspaceId)) {
        throw new UnknownRunError(query.runId);
      }

      const briefed = (
        await Promise.all(
          run.briefedWith.map((each) => this.memories.find(MemoryId.of(each))),
        )
      ).filter((each): each is Memory => each !== null);

      if (briefed.some((each) => each.scope.teamId.value !== query.teamId)) {
        throw new UnknownRunError(query.runId);
      }

      return await this.views.summaries(briefed);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
