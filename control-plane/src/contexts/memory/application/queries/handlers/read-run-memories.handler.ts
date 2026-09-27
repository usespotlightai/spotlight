import type {
  RunMemoriesDto,
  RunProposalDto,
} from '@memory/application/dto/team-memory.dto';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import type { ReadRunMemoriesQuery } from '@memory/application/queries/read-run-memories.query';
import type { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import type { TeamMemoryAtHand } from '@memory/application/services/team-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { UnknownRunError } from '@memory/domain/exceptions/unknown-run.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ReadRunMemoriesHandler
  implements QueryHandlerPort<ReadRunMemoriesQuery, RunMemoriesDto>
{
  constructor(
    private readonly atHand: TeamMemoryAtHand,
    private readonly work: WorkPort,
    private readonly memories: MemoryRepository,
    private readonly drafts: MemoryDraftRepository,
    private readonly uses: MemoryUsesPort,
    private readonly reviews: MemoryReviews,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: ReadRunMemoriesQuery): Promise<RunMemoriesDto> {
    try {
      await this.atHand.member(query.teamId, query.viewerId);
      const runId = RunId.of(query.runId);
      const [run, teamId] = await Promise.all([
        this.work.run(runId),
        this.work.teamOfRun(runId),
      ]);

      if (!run || teamId?.value !== query.teamId) {
        throw new UnknownRunError(query.runId);
      }

      const recalled = (await this.uses.ofRun(runId))
        .filter((each) => each.way === 'recalled')
        .map((each) => each.memoryId.value);
      const [briefed, cut, remembered, proposed] = await Promise.all([
        this.held(teamId, run.briefed),
        this.held(teamId, run.cut),
        this.held(teamId, recalled),
        run.taskId ? this.proposedIn(run.taskId, runId) : [],
      ]);

      return {
        briefed: await this.views.summaries(briefed),
        cut: await this.views.summaries(cut),
        recalled: await this.views.summaries(remembered),
        proposed,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async held(
    teamId: TeamId,
    ids: readonly string[],
  ): Promise<readonly Memory[]> {
    const found = await this.memories.findAll(
      [...new Set(ids)].map((each) => MemoryId.of(each)),
    );

    return found.filter((each) => each.scope.teamId.equals(teamId));
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
