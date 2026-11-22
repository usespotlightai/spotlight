import type { ApproveMemoriesCommand } from '@memory/application/commands/approve-memories.command';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ApproveMemoriesHandler implements CommandHandlerPort<
  ApproveMemoriesCommand,
  void
> {
  constructor(
    private readonly access: MemoryAccess,
    private readonly sets: MemoryProposalSetRepository,
    private readonly memories: MemoryRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ApproveMemoriesCommand): Promise<void> {
    try {
      const reviewing = await this.access.ofTask(
        TeamId.of(command.teamId),
        TaskId.of(command.taskId),
        UserId.of(command.viewerId),
      );

      if (!reviewing) {
        throw new UnknownMemoryError(command.memories[0]?.id ?? '');
      }

      await this.transaction.inTransaction(async () => {
        const set = await this.sets.forTask(reviewing.task.id);

        if (!set) {
          throw new UnknownMemoryError(command.memories[0]?.id ?? '');
        }

        const runId = RunId.of(command.runId);
        const approving = command.memories.map((each) => ({
          id: MemoryId.of(each.id),
          body: each.body,
        }));
        const decided = set.approve({
          runId,
          approving,
          current: await this.memories.findAll(
            set.retiredBy(
              runId,
              approving.map((each) => each.id),
            ),
          ),
          decision: MemoryDecision.of({
            by: reviewing.access.by,
            at: this.clock.now(),
          }),
        });
        await this.sets.save(decided);
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
