import type { RecallMemoryCommand } from '@memory/application/commands/recall-memory.command';
import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class RecallMemoryHandler
  implements CommandHandlerPort<RecallMemoryCommand, TeamMemoryDetailDto>
{
  constructor(
    private readonly loader: RunnerMemoryLoader,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(command: RecallMemoryCommand): Promise<TeamMemoryDetailDto> {
    try {
      const handle = MemoryHandle.parse(command.handle);
      const run = await this.loader.recalling(command.runId, command.runnerId);
      const memory = await this.memories.withHandle(run.teamId, handle);

      if (
        !memory ||
        (run.replaysFrom && !memory.activeOn(run.teamId, run.replaysFrom))
      ) {
        throw new UnknownMemoryError(handle.value);
      }

      await this.loader.recalled(run, [memory.id]);

      return await this.views.detail(memory);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
