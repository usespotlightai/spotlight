import type { RestoreMemoryCommand } from '@memory/application/commands/restore-memory.command';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class RestoreMemoryHandler implements CommandHandlerPort<
  RestoreMemoryCommand,
  void
> {
  constructor(
    private readonly access: MemoryAccess,
    private readonly sets: MemoryProposalSetRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: RestoreMemoryCommand): Promise<void> {
    try {
      const reviewing = await this.access.ofTask(
        TeamId.of(command.teamId),
        TaskId.of(command.taskId),
        UserId.of(command.viewerId),
      );

      if (!reviewing) {
        throw new UnknownMemoryError(command.memoryId);
      }

      await this.transaction.inTransaction(async () => {
        const set = await this.sets.forTask(reviewing.task.id);

        if (!set) {
          throw new UnknownMemoryError(command.memoryId);
        }

        await this.sets.save(
          set.restore({
            runId: RunId.of(command.runId),
            id: MemoryId.of(command.memoryId),
          }),
        );
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
