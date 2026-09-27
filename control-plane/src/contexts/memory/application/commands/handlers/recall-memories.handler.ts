import type { RecallMemoriesCommand } from '@memory/application/commands/recall-memories.command';
import type { TeamMemoryDto } from '@memory/application/dto/team-memory.dto';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { RunnerMemoryAtHand } from '@memory/application/services/runner-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

const MOST_RECALLED = 10;

const MOST_WORDS = 500;

export class RecallMemoriesHandler
  implements CommandHandlerPort<RecallMemoriesCommand, TeamMemoryDto[]>
{
  constructor(
    private readonly atHand: RunnerMemoryAtHand,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
    private readonly uses: MemoryUsesPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RecallMemoriesCommand): Promise<TeamMemoryDto[]> {
    try {
      const words = command.words.trim();

      if (!words || words.length > MOST_WORDS) {
        throw new InvalidMemoryError(
          `is recalled by at most ${MOST_WORDS} characters of words it holds, or by its handle, like M-12`,
        );
      }

      const held = await this.atHand.held(command.runId, command.runnerId);

      const recalled = await this.memories.recalled(
        held.teamId,
        words,
        MOST_RECALLED,
      );

      await this.uses.record(
        held.id,
        'recalled',
        recalled.map((each) => each.id),
        this.clock.now(),
      );

      return await this.views.summaries(recalled);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
