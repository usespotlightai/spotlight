import type { MemoryReviewDto } from '@memory/application/dto/memory-review.dto';
import type { ReadMemoryReviewQuery } from '@memory/application/queries/read-memory-review.query';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ReadMemoryReviewHandler
  implements QueryHandlerPort<ReadMemoryReviewQuery, MemoryReviewDto | null>
{
  constructor(
    private readonly access: MemoryAccess,
    private readonly drafts: MemoryDraftRepository,
    private readonly reviews: MemoryReviews,
  ) {}

  async execute(query: ReadMemoryReviewQuery): Promise<MemoryReviewDto | null> {
    try {
      const reviewing = await this.access.ofTask(
        query.teamId,
        query.taskId,
        query.viewerId,
      );
      const draft = reviewing
        ? await this.drafts.forTask(reviewing.task.id)
        : null;

      return draft ? await this.reviews.of(draft, RunId.of(query.runId)) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
