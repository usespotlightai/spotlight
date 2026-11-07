import type { RetireMemoryCommand } from '@memory/application/commands/retire-memory.command';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { TeamMemoryLoader } from '@memory/application/services/team-memory-loader.service';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class RetireMemoryHandler
  implements CommandHandlerPort<RetireMemoryCommand, void>
{
  constructor(
    private readonly access: MemoryAccess,
    private readonly loader: TeamMemoryLoader,
    private readonly memories: MemoryRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RetireMemoryCommand): Promise<void> {
    try {
      const access = await this.access.forTeam(
        TeamId.of(command.teamId),
        UserId.of(command.viewerId),
      );
      await this.transaction.inTransaction(async () => {
        const memory = await this.loader.memory(access, command.memoryId);
        const next = memory.retire({
          by: access.by,
          reason: command.reason,
          at: this.clock.now(),
        });
        await this.memories.save(next);
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
