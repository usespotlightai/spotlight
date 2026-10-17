import type { ApproveMemoriesCommand } from '@memory/application/commands/approve-memories.command';
import type { MemoryReviewDto } from '@memory/application/dto/memory-review.dto';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ApproveMemoriesHandler
  implements CommandHandlerPort<ApproveMemoriesCommand, MemoryReviewDto>
{
  constructor(
    private readonly access: MemoryAccess,
    private readonly drafts: MemoryDraftRepository,
    private readonly reviews: MemoryReviews,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ApproveMemoriesCommand): Promise<MemoryReviewDto> {
    try {
      const reviewing = await this.access.ofTask(
        command.teamId,
        command.taskId,
        command.viewerId,
      );

      if (!reviewing) {
        throw new UnknownMemoryError(command.memories[0]?.id ?? '');
      }

      const approved = await this.transaction.inTransaction(async () => {
        const draft = await this.drafts.forTask(reviewing.task.id);

        if (!draft) {
          throw new UnknownMemoryError(command.memories[0]?.id ?? '');
        }

        const decided = draft.approve({
          runId: RunId.of(command.runId),
          approving: command.memories.map((each) => ({
            id: MemoryId.of(each.id),
            body: each.body,
          })),
          decision: MemoryDecision.of({
            by: reviewing.access.by,
            at: this.clock.now(),
          }),
        });
        await this.drafts.save(decided);
        return decided;
      });

      return await this.reviews.of(approved, RunId.of(command.runId));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
