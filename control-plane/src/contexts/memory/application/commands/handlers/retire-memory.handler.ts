import type { RetireMemoryCommand } from '@memory/application/commands/retire-memory.command';
import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { TeamMemoryLoader } from '@memory/application/services/team-memory-loader.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class RetireMemoryHandler
  implements CommandHandlerPort<RetireMemoryCommand, TeamMemoryDetailDto>
{
  constructor(
    private readonly access: MemoryAccess,
    private readonly loader: TeamMemoryLoader,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RetireMemoryCommand): Promise<TeamMemoryDetailDto> {
    try {
      const access = await this.access.forTeam(
        command.teamId,
        command.viewerId,
      );
      const retired = await this.transaction.inTransaction(async () => {
        const memory = await this.loader.memory(access, command.memoryId);
        const next = memory.retire({
          by: access.by,
          reason: command.reason,
          at: this.clock.now(),
        });
        await this.memories.save(next);
        return next;
      });

      return await this.views.detail(retired);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
