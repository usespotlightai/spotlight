import {
  type MemoryProposal,
  type ProposedMemory,
} from '@memory/domain/entities/memory-proposal.entity';
import { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import { MemoryDraftingAsked } from '@memory/domain/events/memory-drafting-asked.event';
import { MemoryDraftingFailed } from '@memory/domain/events/memory-drafting-failed.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { DraftEvidence } from '@memory/domain/services/draft-evidence';
import type { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryDrafting } from '@memory/domain/value-objects/memory-drafting.vo';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { OwesWork } from '@shared-kernel/domain/owes-work';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class MemoryDraft
  extends EventRecorder
  implements OwesWork<MemoryDraft>
{
  private constructor(
    readonly id: MemoryDraftId,
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly drafting: MemoryDrafting | null,
    readonly draftedIn: RunId | null,
    readonly notesRead: number,
    readonly proposals: readonly MemoryProposal[],
    readonly failure: MemoryDraftingFailure | null,
    readonly version: number,
  ) {
    super();
  }

  static opened(input: {
    id: MemoryDraftId;
    taskId: TaskId;
    workspaceId: WorkspaceId;
  }): MemoryDraft {
    return new MemoryDraft(
      input.id,
      input.taskId,
      input.workspaceId,
      null,
      null,
      0,
      [],
      null,
      0,
    );
  }

  static rehydrate(input: {
    id: MemoryDraftId;
    taskId: TaskId;
    workspaceId: WorkspaceId;
    drafting: MemoryDrafting | null;
    draftedIn: RunId | null;
    notesRead: number;
    proposals: readonly MemoryProposal[];
    failure: MemoryDraftingFailure | null;
    version: number;
  }): MemoryDraft {
    if (!Number.isInteger(input.notesRead) || input.notesRead < 0) {
      throw new InconsistentStateError(
        'memory draft',
        `has read ${input.notesRead} notes`,
      );
    }

    if (
      new Set(input.proposals.map((each) => each.id.value)).size !==
      input.proposals.length
    ) {
      throw new InconsistentStateError(
        'memory draft',
        'holds the same proposal twice',
      );
    }

    if (
      input.proposals.some((each) => !each.grounds.taskId.equals(input.taskId))
    ) {
      throw new InconsistentStateError(
        'memory draft',
        'holds a proposal grounded in another task',
      );
    }

    return new MemoryDraft(
      input.id,
      input.taskId,
      input.workspaceId,
      input.drafting,
      input.draftedIn,
      input.notesRead,
      input.proposals,
      input.failure,
      input.version,
    );
  }

  get owesWork(): boolean {
    return this.drafting !== null;
  }

  get workExhausted(): boolean {
    return this.drafting?.work.exhausted ?? false;
  }

  reads(position: number): boolean {
    return (
      position >= this.notesRead ||
      this.proposals.some((each) => each.proposed && each.citesNote(position))
    );
  }

  asked(runId: RunId, now: Date): MemoryDraft {
    if (this.drafting?.isFor(runId) || this.draftedIn?.equals(runId)) {
      return this;
    }

    const asked = this.with({ drafting: MemoryDrafting.asked(runId, now) });
    asked.record(new MemoryDraftingAsked(this.id, this.taskId, runId));
    return asked;
  }

  leased(now: Date): MemoryDraft {
    if (!this.drafting) {
      throw InvalidMemoryError.ofDraft('has no run to draft memories from');
    }
    if (!this.drafting.work.dueBy(now) || this.drafting.work.exhausted) {
      throw InvalidMemoryError.ofDraft('cannot be drafted again yet');
    }

    return this.with({
      drafting: this.drafting.withWork(this.drafting.work.leased(now)),
    });
  }

  triedAgainLater(now: Date): MemoryDraft {
    return this.failed(MemoryDraftingFailure.of('errored', now));
  }

  gaveUp(now: Date): MemoryDraft {
    return this.ended(MemoryDraftingFailure.of('interrupted', now));
  }

  failed(failure: MemoryDraftingFailure): MemoryDraft {
    if (!this.drafting) {
      return this;
    }

    const next = failure.retry.after(this.drafting.work.attempts, failure.at);

    return next
      ? this.with({
          drafting: this.drafting.withWork(
            this.drafting.work.waitingUntil(next),
          ),
        })
      : this.ended(failure);
  }

  drafted(input: {
    runId: RunId;
    proposed: readonly ProposedMemory[];
    evidence: DraftEvidence;
    newId: () => string;
    now: Date;
  }): MemoryDraft {
    if (!this.drafting?.isFor(input.runId)) {
      return this;
    }

    if (!input.evidence.isFor(this.taskId, input.runId)) {
      throw InvalidMemoryError.ofDraft(
        'is drafted only from the evidence of its own task and run',
      );
    }

    const valid = input.proposed.flatMap((each) => {
      try {
        return [
          input.evidence.proposalOf(
            MemoryId.of(input.newId()),
            each,
            input.now,
          ),
        ];
      } catch (error) {
        if (error instanceof InvalidMemoryError) {
          return [];
        }
        throw error;
      }
    });
    const replaced = input.evidence.isEmpty
      ? []
      : this.proposals.filter((each) => each.proposed);
    const through = input.evidence.notesThrough;

    const drafted = this.with({
      drafting: null,
      draftedIn: input.runId,
      notesRead:
        through === null
          ? this.notesRead
          : Math.max(this.notesRead, through + 1),
      proposals: [
        ...this.proposals.filter((each) => !replaced.includes(each)),
        ...valid,
      ],
      failure: null,
    });
    drafted.record(
      new MemoriesProposed(
        this.id,
        this.taskId,
        input.runId,
        valid.length,
        input.proposed.length - valid.length,
        replaced.length,
      ),
    );
    return drafted;
  }

  private ended(failure: MemoryDraftingFailure): MemoryDraft {
    if (!this.drafting) {
      return this;
    }

    const ended = this.with({ drafting: null, failure });
    ended.record(
      new MemoryDraftingFailed(
        this.id,
        this.taskId,
        this.drafting.runId,
        failure,
      ),
    );
    return ended;
  }

  private with(change: {
    drafting?: MemoryDrafting | null;
    draftedIn?: RunId;
    notesRead?: number;
    proposals?: readonly MemoryProposal[];
    failure?: MemoryDraftingFailure | null;
  }): MemoryDraft {
    const next = new MemoryDraft(
      this.id,
      this.taskId,
      this.workspaceId,
      change.drafting !== undefined ? change.drafting : this.drafting,
      change.draftedIn ?? this.draftedIn,
      change.notesRead ?? this.notesRead,
      change.proposals ?? this.proposals,
      change.failure !== undefined ? change.failure : this.failure,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
