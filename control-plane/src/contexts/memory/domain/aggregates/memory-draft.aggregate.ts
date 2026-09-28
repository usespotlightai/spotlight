import type {
  MemoryProposal,
  ProposedMemory,
} from '@memory/domain/entities/memory-proposal.entity';
import { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import { MemoryDraftingAsked } from '@memory/domain/events/memory-drafting-asked.event';
import { MemoryDraftingFailed } from '@memory/domain/events/memory-drafting-failed.event';
import { MemoryReviewSettled } from '@memory/domain/events/memory-review-settled.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { DraftEvidence } from '@memory/domain/services/draft-evidence';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
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

const runsOf = (proposals: readonly MemoryProposal[]): RunId[] =>
  proposals
    .map((each) => each.grounds.runId)
    .filter(
      (runId, at, all) => all.findIndex((one) => one.equals(runId)) === at,
    );

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
    const kept = valid.filter(
      (each) => !this.stillRemembered.some((one) => one.says(each)),
    );
    const replaced = input.evidence.isEmpty
      ? []
      : this.proposals.filter((each) => each.proposed && !each.remembered);
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
        ...kept,
      ],
      failure: null,
    });
    for (const runId of runsOf(replaced)) {
      if (!drafted.proposals.some((each) => each.proposedIn(runId))) {
        drafted.record(new MemoryReviewSettled(this.id, this.taskId, runId));
      }
    }
    drafted.record(
      new MemoriesProposed(
        this.id,
        this.taskId,
        input.runId,
        kept.length,
        input.proposed.length - kept.length,
        replaced.length,
      ),
    );
    return drafted;
  }

  remembered(proposal: MemoryProposal): MemoryDraft {
    if (!proposal.remembered || !proposal.proposed) {
      throw InvalidMemoryError.ofDraft(
        'takes in only a memory a run proposed itself',
      );
    }

    if (!proposal.grounds.taskId.equals(this.taskId)) {
      throw InvalidMemoryError.ofDraft(
        'takes in only a memory grounded in its own task',
      );
    }

    if (this.twinOf(proposal)) {
      return this;
    }

    const remembered = this.with({
      proposals: [...this.proposals, proposal],
    });
    remembered.record(
      new MemoriesProposed(
        this.id,
        this.taskId,
        proposal.grounds.runId,
        1,
        0,
        0,
      ),
    );
    return remembered;
  }

  holding(proposal: MemoryProposal): MemoryProposal | null {
    return (
      this.proposals.find((each) => each.id.equals(proposal.id)) ??
      this.twinOf(proposal)
    );
  }

  get stillRemembered(): readonly MemoryProposal[] {
    return this.proposals.filter((each) => each.proposed && each.remembered);
  }

  stepsRemembered(runId: RunId): readonly number[] {
    return this.proposals
      .filter((each) => each.remembered && each.grounds.runId.equals(runId))
      .flatMap((each) => each.grounds.steps);
  }

  private twinOf(proposal: MemoryProposal): MemoryProposal | null {
    return (
      this.proposals.find(
        (each) =>
          each.remembered &&
          each.proposedIn(proposal.grounds.runId) &&
          each.says(proposal),
      ) ?? null
    );
  }

  approved(input: {
    runId: RunId;
    approving: readonly { id: MemoryId; body?: string }[];
    decision: MemoryDecision;
  }): MemoryDraft {
    const ids = input.approving.map((each) => each.id.value);

    if (ids.length === 0 || new Set(ids).size !== ids.length) {
      throw new InvalidMemoryError('is approved by naming each memory once');
    }

    const approving = input.approving.map((each) => ({
      proposal: this.proposalNamed(each.id, input.runId),
      body: each.body,
    }));

    if (
      approving.length > 1 &&
      approving.some(({ proposal }) => proposal.fromOutside)
    ) {
      throw new InvalidMemoryError(
        'from outside the team is approved one at a time, never with others',
      );
    }

    const decided = approving.map(({ proposal, body }) =>
      proposal.approved(input.decision, body),
    );
    const next = this.decided(decided);

    for (const each of decided) {
      next.record(
        new MemoryApproved(
          this.id,
          this.taskId,
          this.workspaceId,
          each.id,
          each.kind,
          each.body,
          each.scope,
          each.grounds,
          each.source,
          each.supersedes,
          input.decision,
        ),
      );
    }

    return next.settledWhereDone(decided);
  }

  rejected(input: {
    runId: RunId;
    id: MemoryId;
    decision: MemoryDecision;
  }): MemoryDraft {
    const decided = [
      this.proposalNamed(input.id, input.runId).rejected(input.decision),
    ];

    return this.decided(decided).settledWhereDone(decided);
  }

  private proposalNamed(id: MemoryId, runId: RunId): MemoryProposal {
    const held = this.proposals.find(
      (each) => each.id.equals(id) && each.grounds.runId.equals(runId),
    );

    if (!held) {
      throw new UnknownMemoryError(id.value);
    }

    return held;
  }

  private decided(decided: readonly MemoryProposal[]): MemoryDraft {
    return this.with({
      proposals: this.proposals.map(
        (each) => decided.find((one) => one.id.equals(each.id)) ?? each,
      ),
    });
  }

  private settledWhereDone(decided: readonly MemoryProposal[]): MemoryDraft {
    for (const runId of runsOf(decided)) {
      if (!this.proposals.some((each) => each.proposedIn(runId))) {
        this.record(new MemoryReviewSettled(this.id, this.taskId, runId));
      }
    }

    return this;
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
