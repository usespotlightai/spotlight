import type { RetireMemoryCommand } from '@memory/application/commands/retire-memory.command';
import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { TeamMemoryAtHand } from '@memory/application/services/team-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class RetireMemoryHandler
  implements CommandHandlerPort<RetireMemoryCommand, TeamMemoryDetailDto>
{
  constructor(
    private readonly atHand: TeamMemoryAtHand,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RetireMemoryCommand): Promise<TeamMemoryDetailDto> {
    try {
      const member = await this.atHand.member(command.teamId, command.viewerId);
      const retired = await this.transaction.run(async () => {
        const held = await this.atHand.memory(command.teamId, command.memoryId);
        const next = held.retired({
          by: member.by,
          reason: command.reason,
          at: this.clock.now(),
        });
        await this.memories.save(next);
        return next;
      });

      return await this.views.detail(retired);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
