import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import { MemoryRetirementApproved } from '@memory/domain/events/memory-retirement-approved.event';
import { MemoryReviewReopened } from '@memory/domain/events/memory-review-reopened.event';
import { MemoryReviewRequested } from '@memory/domain/events/memory-review-requested.event';
import { MemoryReviewResolved } from '@memory/domain/events/memory-review-resolved.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryRetirementLapsedError } from '@memory/domain/exceptions/memory-retirement-lapsed.error';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const runsOf = (proposals: readonly MemoryProposal[]): RunId[] =>
  proposals
    .map((each) => each.provenance.runId)
    .filter(
      (runId, at, all) => all.findIndex((one) => one.equals(runId)) === at,
    );

export class MemoryProposalSet extends EventRecorder {
  private deleted = false;

  private constructor(
    readonly id: MemoryProposalSetId,
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly proposals: readonly MemoryProposal[],
    readonly version: number,
  ) {
    super();
  }

  static create(input: {
    id: MemoryProposalSetId;
    taskId: TaskId;
    workspaceId: WorkspaceId;
  }): MemoryProposalSet {
    return new MemoryProposalSet(
      input.id,
      input.taskId,
      input.workspaceId,
      [],
      0,
    );
  }

  static rehydrate(input: {
    id: MemoryProposalSetId;
    taskId: TaskId;
    workspaceId: WorkspaceId;
    proposals: readonly MemoryProposal[];
    version: number;
  }): MemoryProposalSet {
    if (
      new Set(input.proposals.map((each) => each.id.value)).size !==
      input.proposals.length
    ) {
      throw new InconsistentStateError(
        'memory proposal set',
        'has the same proposal twice',
      );
    }

    if (
      input.proposals.some(
        (each) => !each.provenance.taskId.equals(input.taskId),
      )
    ) {
      throw new InconsistentStateError(
        'memory proposal set',
        'has a proposal that cites another task',
      );
    }

    return new MemoryProposalSet(
      input.id,
      input.taskId,
      input.workspaceId,
      input.proposals,
      input.version,
    );
  }

  remember(proposal: MemoryProposal): MemoryProposalSet {
    if (!proposal.proposed) {
      throw InvalidMemoryError.ofSet(
        'takes in only a memory a run proposed itself',
      );
    }

    if (!proposal.provenance.taskId.equals(this.taskId)) {
      throw InvalidMemoryError.ofSet(
        'takes in only a memory that cites its own task',
      );
    }

    if (this.twinOf(proposal)) {
      return this;
    }

    const remembered = this.with({
      proposals: [...this.proposals, proposal],
    });
    remembered.record(
      new MemoryReviewRequested(
        this.id,
        this.taskId,
        proposal.provenance.runId,
      ),
    );
    return remembered;
  }

  findProposal(proposal: MemoryProposal): MemoryProposal | null {
    return (
      this.proposals.find((each) => each.id.equals(proposal.id)) ??
      this.twinOf(proposal)
    );
  }

  awaitsReviewIn(runId: RunId): boolean {
    return this.proposals.some((each) => each.proposedIn(runId));
  }

  stepsRemembered(runId: RunId): readonly number[] {
    return this.proposals
      .filter((each) => each.provenance.runId.equals(runId))
      .flatMap((each) => each.provenance.steps);
  }

  private twinOf(proposal: MemoryProposal): MemoryProposal | null {
    return (
      this.proposals.find(
        (each) =>
          each.proposedIn(proposal.provenance.runId) && each.matches(proposal),
      ) ?? null
    );
  }

  retiredBy(runId: RunId, ids: readonly MemoryId[]): readonly MemoryId[] {
    return ids.flatMap((id) => {
      const retires = this.proposalNamed(id, runId).retires;
      return retires ? [retires.memory] : [];
    });
  }

  approve(input: {
    runId: RunId;
    approving: readonly { id: MemoryId; body?: string }[];
    decision: MemoryDecision;
    current: readonly Memory[];
  }): MemoryProposalSet {
    const ids = input.approving.map((each) => each.id.value);

    if (ids.length === 0 || new Set(ids).size !== ids.length) {
      throw new InvalidMemoryError('approval must name each memory once');
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
        'from outside the team must be approved on its own',
      );
    }

    const lapsed = approving.flatMap(({ proposal }) =>
      proposal.inactiveIn(input.current),
    );

    if (lapsed.length > 0) {
      throw new MemoryRetirementLapsedError(lapsed);
    }

    const decided = approving.map(({ proposal, body }) =>
      proposal.approve(input.decision, body),
    );
    const next = this.decided(decided);

    for (const each of decided) {
      if (each.retires) {
        next.record(
          new MemoryRetirementApproved(
            this.id,
            this.taskId,
            each.scope.teamId,
            each.id,
            each.retires.memory,
            each.retires.reason,
            input.decision,
          ),
        );
        continue;
      }

      next.record(
        new MemoryApproved(
          this.id,
          this.taskId,
          this.workspaceId,
          each.id,
          each.kind,
          each.body,
          each.scope,
          each.provenance,
          each.source,
          each.supersedes,
          input.decision,
        ),
      );
    }

    return next.resolveDecidedReviews(decided);
  }

  lapse(proposalId: MemoryId): MemoryProposalSet {
    const found = this.proposals.find((each) => each.id.equals(proposalId));

    if (!found) {
      throw new UnknownMemoryError(proposalId.value);
    }

    return this.decided([found.lapse()]);
  }

  reject(input: {
    runId: RunId;
    id: MemoryId;
    decision: MemoryDecision;
  }): MemoryProposalSet {
    const decided = [
      this.proposalNamed(input.id, input.runId).reject(input.decision),
    ];

    return this.decided(decided).resolveDecidedReviews(decided);
  }

  restore(input: { runId: RunId; id: MemoryId }): MemoryProposalSet {
    const restored = this.decided([
      this.proposalNamed(input.id, input.runId).restore(),
    ]);

    restored.record(
      new MemoryReviewReopened(this.id, this.taskId, input.runId),
    );

    return restored;
  }

  private proposalNamed(id: MemoryId, runId: RunId): MemoryProposal {
    const found = this.proposals.find(
      (each) => each.id.equals(id) && each.provenance.runId.equals(runId),
    );

    if (!found) {
      throw new UnknownMemoryError(id.value);
    }

    return found;
  }

  private decided(decided: readonly MemoryProposal[]): MemoryProposalSet {
    return this.with({
      proposals: this.proposals.map(
        (each) => decided.find((one) => one.id.equals(each.id)) ?? each,
      ),
    });
  }

  private resolveDecidedReviews(
    decided: readonly MemoryProposal[],
  ): MemoryProposalSet {
    for (const runId of runsOf(decided)) {
      if (!this.awaitsReviewIn(runId)) {
        this.record(new MemoryReviewResolved(this.id, this.taskId, runId));
      }
    }

    return this;
  }

  private with(change: {
    proposals?: readonly MemoryProposal[];
  }): MemoryProposalSet {
    const next = new MemoryProposalSet(
      this.id,
      this.taskId,
      this.workspaceId,
      change.proposals ?? this.proposals,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }

  get isDeleted(): boolean {
    return this.deleted;
  }

  delete(): MemoryProposalSet {
    const deleted = this.with({});
    deleted.deleted = true;
    return deleted;
  }
}
