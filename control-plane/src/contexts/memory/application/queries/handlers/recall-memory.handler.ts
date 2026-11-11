import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { RecallMemoryQuery } from '@memory/application/queries/recall-memory.query';
import type { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { recallableBy } from '@memory/domain/services/recall-policy';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RecallMemoryHandler implements QueryHandlerPort<
  RecallMemoryQuery,
  TeamMemoryDetailDto
> {
  constructor(
    private readonly loader: RunnerMemoryLoader,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: RecallMemoryQuery): Promise<TeamMemoryDetailDto> {
    try {
      const handle = MemoryHandle.parse(query.handle);
      const run = await this.loader.recalling(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
      );
      const memory = await this.memories.withHandle(run.teamId, handle);

      if (!memory || !recallableBy(memory, run)) {
        throw new UnknownMemoryError(handle.value);
      }

      return await this.views.detail(memory);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
