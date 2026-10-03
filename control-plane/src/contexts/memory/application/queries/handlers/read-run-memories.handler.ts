import type {
  RunMemoriesDto,
  RunProposalDto,
} from '@memory/application/dto/team-memory.dto';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { ReviewsPort } from '@memory/application/ports/reviews.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import type { ReadRunMemoriesQuery } from '@memory/application/queries/read-run-memories.query';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { UnknownRunError } from '@memory/domain/exceptions/unknown-run.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import type { MemoryClearance } from '@memory/domain/services/memory-clearance';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class ReadRunMemoriesHandler
  implements QueryHandlerPort<ReadRunMemoriesQuery, RunMemoriesDto>
{
  constructor(
    private readonly access: MemoryAccess,
    private readonly work: WorkPort,
    private readonly memories: MemoryRepository,
    private readonly drafts: MemoryDraftRepository,
    private readonly uses: MemoryUsesPort,
    private readonly reviews: MemoryReviews,
    private readonly views: TeamMemoryViews,
    private readonly reviewItems: ReviewsPort,
  ) {}

  async execute(query: ReadRunMemoriesQuery): Promise<RunMemoriesDto> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.viewerId,
      );
      const runId = RunId.of(query.runId);
      const [run, site] = await Promise.all([
        this.work.run(runId),
        this.work.siteOfRun(runId),
      ]);

      if (!run || !site || !clearance.sees(site)) {
        throw new UnknownRunError(query.runId);
      }

      const recalled = (await this.uses.ofRun(runId))
        .filter((each) => each.way === 'recalled')
        .map((each) => each.memoryId.value);
      const [briefed, cut, remembered, proposed] = await Promise.all([
        this.held(clearance, run.briefed),
        this.held(clearance, run.cut),
        this.held(clearance, recalled),
        run.taskId ? this.proposedIn(run.taskId, runId) : [],
      ]);
      const reviewItemId =
        run.taskId && proposed.length > 0
          ? await this.reviewItems.reviewItemOf(run.taskId, runId)
          : null;

      return {
        briefed: await this.views.summaries(briefed),
        cut: await this.views.summaries(cut),
        recalled: await this.views.summaries(remembered),
        proposed,
        reviewItemId,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async held(
    clearance: MemoryClearance,
    ids: readonly string[],
  ): Promise<readonly Memory[]> {
    const found = await this.memories.findAll(
      [...new Set(ids)].map((each) => MemoryId.of(each)),
    );

    return found.filter((each) => clearance.holds(each));
  }

  private async proposedIn(
    taskId: TaskId,
    runId: RunId,
  ): Promise<RunProposalDto[]> {
    const draft = await this.drafts.forTask(taskId);

    if (!draft) {
      return [];
    }

    const review = await this.reviews.of(draft, runId);

    return Promise.all(
      review.memories.map(async (proposal) => {
        const stood =
          proposal.state === 'approved'
            ? await this.memories.find(MemoryId.of(proposal.id))
            : null;

        return {
          ...proposal,
          handle: stood?.handle.value ?? null,
          standing: stood?.standing ?? null,
        };
      }),
    );
  }
}
