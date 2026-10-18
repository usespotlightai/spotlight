import type { RecallMemoriesCommand } from '@memory/application/commands/recall-memories.command';
import type { TeamMemoryDto } from '@memory/application/dto/team-memory.dto';
import type { ApplicableMemories } from '@memory/application/services/applicable-memories.service';
import type { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { RecallWords } from '@memory/domain/value-objects/recall-words.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

const MAX_RECALLED = 10;

export class RecallMemoriesHandler
  implements CommandHandlerPort<RecallMemoriesCommand, TeamMemoryDto[]>
{
  constructor(
    private readonly loader: RunnerMemoryLoader,
    private readonly applicable: ApplicableMemories,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(command: RecallMemoriesCommand): Promise<TeamMemoryDto[]> {
    try {
      const words = RecallWords.of(command.words);
      const run = await this.loader.recalling(command.runId, command.runnerId);

      const recalled = await this.applicable.recalled(
        run.teamId,
        words,
        MAX_RECALLED,
        run.replaysFrom,
      );

      await this.loader.recalled(
        run,
        recalled.map((each) => each.id),
      );

      return await this.views.summaries(recalled);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
