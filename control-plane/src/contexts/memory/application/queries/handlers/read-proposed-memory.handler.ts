import type { ProposedMemoryDto } from '@memory/application/dto/memory-review.dto';
import type { ReadProposedMemoryQuery } from '@memory/application/queries/read-proposed-memory.query';
import type { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import type { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class ReadProposedMemoryHandler implements QueryHandlerPort<
  ReadProposedMemoryQuery,
  ProposedMemoryDto
> {
  constructor(
    private readonly loader: RunnerMemoryLoader,
    private readonly drafts: MemoryDraftRepository,
    private readonly reviews: MemoryReviews,
  ) {}

  async execute(query: ReadProposedMemoryQuery): Promise<ProposedMemoryDto> {
    try {
      const run = await this.loader.leased(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
      );
      const draft = run.taskId ? await this.drafts.forTask(run.taskId) : null;
      const shown = draft
        ? (await this.reviews.of(draft, run.id)).memories.find(
            (each) => each.id === query.memoryId,
          )
        : undefined;

      if (!shown) {
        throw new UnknownMemoryError(query.memoryId);
      }

      return shown;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
