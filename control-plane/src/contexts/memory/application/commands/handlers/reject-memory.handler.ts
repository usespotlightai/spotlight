import type { RejectMemoryCommand } from '@memory/application/commands/reject-memory.command';
import type { MemoryReviewDto } from '@memory/application/dto/memory-review.dto';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RejectMemoryHandler
  implements CommandHandlerPort<RejectMemoryCommand, MemoryReviewDto>
{
  constructor(
    private readonly access: MemoryAccess,
    private readonly drafts: MemoryDraftRepository,
    private readonly reviews: MemoryReviews,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RejectMemoryCommand): Promise<MemoryReviewDto> {
    try {
      const reviewing = await this.access.ofTask(
        command.teamId,
        command.taskId,
        command.viewerId,
      );

      if (!reviewing) {
        throw new UnknownMemoryError(command.memoryId);
      }

      const rejected = await this.transaction.run(async () => {
        const draft = await this.drafts.forTask(reviewing.task.id);

        if (!draft) {
          throw new UnknownMemoryError(command.memoryId);
        }

        const decided = draft.rejected({
          runId: RunId.of(command.runId),
          id: MemoryId.of(command.memoryId),
          decision: MemoryDecision.of({
            by: reviewing.by,
            at: this.clock.now(),
          }),
        });
        await this.drafts.save(decided);
        return decided;
      });

      return await this.reviews.of(rejected, RunId.of(command.runId));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
