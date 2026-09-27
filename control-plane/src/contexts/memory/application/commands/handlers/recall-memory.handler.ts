import type { RecallMemoryCommand } from '@memory/application/commands/recall-memory.command';
import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { RunnerMemoryAtHand } from '@memory/application/services/runner-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class RecallMemoryHandler
  implements CommandHandlerPort<RecallMemoryCommand, TeamMemoryDetailDto>
{
  constructor(
    private readonly atHand: RunnerMemoryAtHand,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
    private readonly uses: MemoryUsesPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RecallMemoryCommand): Promise<TeamMemoryDetailDto> {
    try {
      const handle = MemoryHandle.parse(command.handle);
      const held = await this.atHand.held(command.runId, command.runnerId);
      const memory = await this.memories.withHandle(held.teamId, handle);

      if (!memory) {
        throw new UnknownMemoryError(handle.value);
      }

      await this.uses.record(
        held.id,
        'recalled',
        [memory.id],
        this.clock.now(),
      );

      return await this.views.detail(memory);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
