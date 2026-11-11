import type { TeamMemoryDto } from '@memory/application/dto/team-memory.dto';
import type { RecallMemoriesQuery } from '@memory/application/queries/recall-memories.query';
import type { ApplicableMemories } from '@memory/application/services/applicable-memories.service';
import type { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { MAX_RECALLED } from '@memory/domain/services/recall-policy';
import { RecallWords } from '@memory/domain/value-objects/recall-words.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RecallMemoriesHandler
  implements QueryHandlerPort<RecallMemoriesQuery, TeamMemoryDto[]>
{
  constructor(
    private readonly loader: RunnerMemoryLoader,
    private readonly applicable: ApplicableMemories,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: RecallMemoriesQuery): Promise<TeamMemoryDto[]> {
    try {
      const words = RecallWords.of(query.words);
      const run = await this.loader.recalling(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
      );

      return await this.views.summaries(
        await this.applicable.recalled(
          run.teamId,
          words,
          MAX_RECALLED,
          run.asOf,
        ),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
