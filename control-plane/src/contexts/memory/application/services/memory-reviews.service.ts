import type {
  MemoryReviewDto,
  ProposedMemoryDto,
} from '@memory/application/dto/memory-review.dto';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import { lookUpOnce } from '@memory/application/services/people-lookup';
import { provenanceNotes } from '@memory/application/services/provenance-notes';
import type { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class MemoryReviews {
  constructor(
    private readonly work: WorkPort,
    private readonly people: PeoplePort,
    private readonly memories: MemoryRepository,
  ) {}

  async of(draft: MemoryDraft, runId: RunId): Promise<MemoryReviewDto> {
    const proposals = draft.proposals.filter((each) =>
      each.provenance.runId.equals(runId),
    );
    const [steps, notes, harness] = await Promise.all([
      this.work.reasoning(runId),
      this.work.notesOf(draft.taskId),
      this.work.harnessOf(runId),
    ]);
    const person = lookUpOnce(this.people);
    const current = await this.memories.findAll(
      proposals.flatMap((each) => (each.retires ? [each.retires.memory] : [])),
    );
    const retired = new Map(
      current.map((each) => [each.id.value, each.handle.value]),
    );

    const memories = await Promise.all(
      proposals.map(async (proposal): Promise<ProposedMemoryDto> => ({
        id: proposal.id.value,
        kind: proposal.kind,
        body: proposal.body.value,
        source: proposal.source,
        proposedBy: proposal.proposedBy,
        state: proposal.state,
        scope: proposal.scope.level,
        repository: proposal.scope.repository?.value ?? null,
        paths: proposal.scope.paths.map((each) => each.value),
        supersedes: proposal.supersedes?.value ?? null,
        retires: proposal.retires && {
          memoryId: proposal.retires.memory.value,
          handle: retired.get(proposal.retires.memory.value) ?? '',
          reason: proposal.retires.reason,
        },
        editable: proposal.editable,
        inactiveMemories: proposal.proposed ? proposal.inactiveIn(current) : [],
        decision: proposal.decision && {
          by: proposal.decision.by.value,
          name: (await person(proposal.decision.by)).name,
          at: proposal.decision.at.toISOString(),
        },
        harness,
        steps: (steps ?? []).filter((each) =>
          proposal.provenance.steps.includes(each.index),
        ),
        notes: await provenanceNotes(
          notes ?? [],
          proposal.provenance.notes,
          person,
        ),
      })),
    );

    return { taskId: draft.taskId.value, runId: runId.value, memories };
  }
}
