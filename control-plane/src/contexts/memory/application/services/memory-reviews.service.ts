import type {
  MemoryReviewDto,
  ProposedMemoryDto,
} from '@memory/application/dto/memory-review.dto';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import { lookUpOnce } from '@memory/application/services/people-lookup';
import { provenanceNotes } from '@memory/application/services/provenance-notes';
import type { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { repeatShown } from '@memory/domain/services/duplicate-comparison';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class MemoryReviews {
  constructor(
    private readonly work: WorkPort,
    private readonly people: PeoplePort,
    private readonly memories: MemoryRepository,
    private readonly checks: DuplicateCheckRepository,
  ) {}

  async of(set: MemoryProposalSet, runId: RunId): Promise<MemoryReviewDto> {
    const proposals = set.proposals.filter((each) =>
      each.provenance.runId.equals(runId),
    );
    const [steps, notes, harness] = await Promise.all([
      this.work.reasoning(runId),
      this.work.notesOf(set.taskId),
      this.work.harnessOf(runId),
    ]);
    const person = lookUpOnce(this.people);
    const current = await this.memories.findAll(
      proposals.flatMap((each) => (each.retires ? [each.retires.memory] : [])),
    );
    const retired = new Map(
      current.map((each) => [each.id.value, each.handle.value]),
    );
    const check = await this.checks.of(runId);
    const repeated = check?.repeatedMemories ?? [];
    const named =
      repeated.length > 0 ? await this.memories.findAll(repeated) : [];

    const memories = await Promise.all(
      proposals.map(async (proposal): Promise<ProposedMemoryDto> => {
        const repeat = repeatShown(check, proposal, named);

        return {
          id: proposal.id.value,
          kind: proposal.kind,
          body: proposal.body.value,
          source: proposal.source,
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
          inactiveMemories: proposal.proposed
            ? proposal.inactiveIn(current)
            : [],
          similarTo: repeat && {
            memoryId: repeat.memory.id.value,
            handle: repeat.memory.handle.value,
            body: repeat.memory.body.value,
            reason: repeat.reason,
          },
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
        };
      }),
    );

    return { taskId: set.taskId.value, runId: runId.value, memories };
  }
}
