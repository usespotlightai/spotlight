import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { RecallMemoryQuery } from '@memory/application/queries/recall-memory.query';
import type { RunnerMemoryAtHand } from '@memory/application/services/runner-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class RecallMemoryHandler
  implements QueryHandlerPort<RecallMemoryQuery, TeamMemoryDetailDto>
{
  constructor(
    private readonly atHand: RunnerMemoryAtHand,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: RecallMemoryQuery): Promise<TeamMemoryDetailDto> {
    try {
      const handle = MemoryHandle.parse(query.handle);
      const held = await this.atHand.held(query.runId, query.runnerId);
      const memory = await this.memories.withHandle(held.teamId, handle);

      if (!memory) {
        throw new UnknownMemoryError(handle.value);
      }

      return await this.views.detail(memory);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
