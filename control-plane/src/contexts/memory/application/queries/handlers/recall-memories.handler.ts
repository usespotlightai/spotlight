import type { TeamMemoryDto } from '@memory/application/dto/team-memory.dto';
import type { RecallMemoriesQuery } from '@memory/application/queries/recall-memories.query';
import type { RunnerMemoryAtHand } from '@memory/application/services/runner-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const MOST_RECALLED = 10;

const MOST_WORDS = 500;

export class RecallMemoriesHandler
  implements QueryHandlerPort<RecallMemoriesQuery, TeamMemoryDto[]>
{
  constructor(
    private readonly atHand: RunnerMemoryAtHand,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: RecallMemoriesQuery): Promise<TeamMemoryDto[]> {
    try {
      const words = query.words.trim();

      if (!words || words.length > MOST_WORDS) {
        throw new InvalidMemoryError(
          `is recalled by at most ${MOST_WORDS} characters of words it holds, or by its handle, like M-12`,
        );
      }

      const held = await this.atHand.held(query.runId, query.runnerId);

      return await this.views.summaries(
        await this.memories.recalled(held.teamId, words, MOST_RECALLED),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
