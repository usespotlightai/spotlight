import type { RecallMemoriesCommand } from '@memory/application/commands/recall-memories.command';
import type { TeamMemoryDto } from '@memory/application/dto/team-memory.dto';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { MemoriesInReach } from '@memory/application/services/memories-in-reach.service';
import type { RunnerMemoryAtHand } from '@memory/application/services/runner-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { RecallWords } from '@memory/domain/value-objects/recall-words.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

const MOST_RECALLED = 10;

export class RecallMemoriesHandler
  implements CommandHandlerPort<RecallMemoriesCommand, TeamMemoryDto[]>
{
  constructor(
    private readonly atHand: RunnerMemoryAtHand,
    private readonly inReach: MemoriesInReach,
    private readonly views: TeamMemoryViews,
    private readonly uses: MemoryUsesPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RecallMemoriesCommand): Promise<TeamMemoryDto[]> {
    try {
      const words = RecallWords.of(command.words);
      const held = await this.atHand.held(command.runId, command.runnerId);

      const recalled = await this.inReach.recalled(
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
