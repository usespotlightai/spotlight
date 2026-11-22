import type { MemoryReviewDto } from '@memory/application/dto/memory-review.dto';
import type { ReadMemoryReviewQuery } from '@memory/application/queries/read-memory-review.query';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadMemoryReviewHandler implements QueryHandlerPort<
  ReadMemoryReviewQuery,
  MemoryReviewDto | null
> {
  constructor(
    private readonly access: MemoryAccess,
    private readonly sets: MemoryProposalSetRepository,
    private readonly reviews: MemoryReviews,
  ) {}

  async execute(query: ReadMemoryReviewQuery): Promise<MemoryReviewDto | null> {
    try {
      const reviewing = await this.access.ofTask(
        TeamId.of(query.teamId),
        TaskId.of(query.taskId),
        UserId.of(query.viewerId),
      );
      const set = reviewing ? await this.sets.forTask(reviewing.task.id) : null;

      return set ? await this.reviews.of(set, RunId.of(query.runId)) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
