import type {
  MemoryReviewDto,
  ProposedMemoryDto,
} from '@memory/application/dto/memory-review.dto';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import type { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class MemoryReviews {
  constructor(
    private readonly work: WorkPort,
    private readonly people: PeoplePort,
  ) {}

  async of(draft: MemoryDraft, runId: RunId): Promise<MemoryReviewDto> {
    const proposals = draft.proposals.filter((each) =>
      each.grounds.runId.equals(runId),
    );
    const [steps, notes] = await Promise.all([
      this.work.reasoning(runId),
      this.work.spokenOn(draft.taskId),
    ]);

    const memories = await Promise.all(
      proposals.map(
        async (proposal): Promise<ProposedMemoryDto> => ({
          id: proposal.id.value,
          kind: proposal.kind,
          body: proposal.body,
          source: proposal.source,
          state: proposal.state,
          reach: proposal.scope.reach,
          repository: proposal.scope.repository?.value ?? null,
          paths: proposal.scope.paths.map((each) => each.value),
          supersedes: proposal.supersedes?.value ?? null,
          decision: proposal.decision && {
            by: proposal.decision.by.value,
            name: await this.people.nameOf(proposal.decision.by),
            at: proposal.decision.at.toISOString(),
          },
          steps: (steps ?? []).filter((each) =>
            proposal.grounds.steps.includes(each.index),
          ),
          notes: (notes ?? []).filter((each) =>
            proposal.grounds.notes.includes(each.position),
          ),
        }),
      ),
    );

    return { taskId: draft.taskId.value, runId: runId.value, memories };
  }
}
