import type {
  MemoryReviewDto,
  ProposedMemoryDto,
} from '@memory/application/dto/memory-review.dto';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import { groundNotes } from '@memory/application/services/ground-notes';
import { lookUpOnce } from '@memory/application/services/people-lookup';
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
    const [steps, notes, harness] = await Promise.all([
      this.work.reasoning(runId),
      this.work.notesOf(draft.taskId),
      this.work.harnessOf(runId),
    ]);
    const person = lookUpOnce(this.people);

    const memories = await Promise.all(
      proposals.map(
        async (proposal): Promise<ProposedMemoryDto> => ({
          id: proposal.id.value,
          kind: proposal.kind,
          body: proposal.body.value,
          source: proposal.source,
          origin: proposal.origin,
          state: proposal.state,
          scope: proposal.scope.level,
          repository: proposal.scope.repository?.value ?? null,
          paths: proposal.scope.paths.map((each) => each.value),
          supersedes: proposal.supersedes?.value ?? null,
          decision: proposal.decision && {
            by: proposal.decision.by.value,
            name: (await person(proposal.decision.by)).name,
            at: proposal.decision.at.toISOString(),
          },
          harness,
          steps: (steps ?? []).filter((each) =>
            proposal.grounds.steps.includes(each.index),
          ),
          notes: await groundNotes(notes ?? [], proposal.grounds.notes, person),
        }),
      ),
    );

    return { taskId: draft.taskId.value, runId: runId.value, memories };
  }
}
