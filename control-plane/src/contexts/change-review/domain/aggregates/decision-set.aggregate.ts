import {
  Decision,
  type ProposedDecision,
} from '@change-review/domain/entities/decision.entity';
import { DecisionDispute } from '@change-review/domain/entities/decision-dispute.entity';
import { DecisionDisputed } from '@change-review/domain/events/decision-disputed.event';
import { DecisionDraftingFailed } from '@change-review/domain/events/decision-drafting-failed.event';
import { DecisionsAsked } from '@change-review/domain/events/decisions-asked.event';
import { DecisionsDiscarded } from '@change-review/domain/events/decisions-discarded.event';
import { DecisionsMerged } from '@change-review/domain/events/decisions-merged.event';
import { DecisionsRecorded } from '@change-review/domain/events/decisions-recorded.event';
import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import { UnknownDecisionError } from '@change-review/domain/exceptions/unknown-decision.error';
import type { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import { DecisionDraft } from '@change-review/domain/value-objects/decision-draft.vo';
import type { DecisionGrounds } from '@change-review/domain/value-objects/decision-grounds.vo';
import { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import type { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import type { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { DecisionStatus } from '@change-review/domain/value-objects/decision-status.vo';
import type { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { OwesWork } from '@shared-kernel/domain/owes-work';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DecisionSet
  extends EventRecorder
  implements OwesWork<DecisionSet>
{
  private constructor(
    readonly id: DecisionSetId,
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly decidedIn: RunId | null,
    readonly decisions: readonly Decision[],
    readonly draft: DecisionDraft | null,
    readonly status: DecisionStatus,
    readonly discarded: boolean,
    readonly version: number,
  ) {
    super();
  }

  static open(input: {
    id: DecisionSetId;
    taskId: TaskId;
    workspaceId: WorkspaceId;
  }): DecisionSet {
    return new DecisionSet(
      input.id,
      input.taskId,
      input.workspaceId,
      null,
      [],
      null,
      DecisionStatus.proposed(),
      false,
      0,
    );
  }

  static rehydrate(input: {
    id: DecisionSetId;
    taskId: TaskId;
    workspaceId: WorkspaceId;
    decidedIn: RunId | null;
    decisions: readonly Decision[];
    draft: DecisionDraft | null;
    status: DecisionStatus;
    version: number;
  }): DecisionSet {
    if (input.decisions.length > 0 && !input.decidedIn) {
      throw new InconsistentStateError(
        'decision set',
        'has decisions without the run they were made in',
      );
    }

    if (
      new Set(input.decisions.map((each) => each.id.value)).size !==
      input.decisions.length
    ) {
      throw new InconsistentStateError(
        'decision set',
        'has the same decision twice',
      );
    }

    return new DecisionSet(
      input.id,
      input.taskId,
      input.workspaceId,
      input.decidedIn,
      input.decisions,
      input.draft,
      input.status,
      false,
      input.version,
    );
  }

  get owesWork(): boolean {
    return this.draft !== null;
  }

  get workExhausted(): boolean {
    return this.draft?.work.exhausted ?? false;
  }

  asked(runId: RunId, now: Date): DecisionSet {
    if (
      this.status.isMerged ||
      this.draft?.isFor(runId) ||
      this.decidedIn?.equals(runId)
    ) {
      return this;
    }

    const asked = this.with({ draft: DecisionDraft.asked(runId, now) });
    asked.record(new DecisionsAsked(this.id, this.taskId, runId));
    return asked;
  }

  leased(now: Date): DecisionSet {
    if (!this.draft) {
      throw InvalidDecisionError.ofSet('has no run to draft decisions from');
    }
    if (!this.draft.work.dueBy(now) || this.draft.work.exhausted) {
      throw InvalidDecisionError.ofSet('cannot be drafted again yet');
    }

    return this.with({
      draft: this.draft.withWork(this.draft.work.leased(now)),
    });
  }

  triedAgainLater(now: Date): DecisionSet {
    if (!this.draft) {
      return this;
    }

    return this.draft.work.exhausted
      ? this.gaveUp()
      : this.with({
          draft: this.draft.withWork(this.draft.work.backedOff(now)),
        });
  }

  gaveUp(): DecisionSet {
    if (!this.draft) {
      return this;
    }

    const kept = this.with({ draft: null });
    kept.record(
      new DecisionDraftingFailed(this.id, this.taskId, this.draft.runId),
    );
    return kept;
  }

  recordDraft(input: {
    runId: RunId;
    proposed: readonly ProposedDecision[];
    grounds: DecisionGrounds;
    newId: () => string;
  }): DecisionSet {
    if (!this.draft?.isFor(input.runId)) {
      return this;
    }

    const valid = input.proposed.flatMap((each) => {
      try {
        const decision = Decision.of(DecisionId.of(input.newId()), each);
        return input.grounds.admits(decision) ? [decision] : [];
      } catch (error) {
        if (error instanceof InvalidDecisionError) {
          return [];
        }
        throw error;
      }
    });

    const recorded = this.with({
      decidedIn: input.runId,
      decisions: valid,
      draft: null,
    });
    recorded.record(
      new DecisionsRecorded(
        this.id,
        this.taskId,
        input.runId,
        valid.length,
        input.proposed.length - valid.length,
      ),
    );
    return recorded;
  }

  dispute(input: {
    id: DecisionDisputeId;
    decisionId: DecisionId;
    path: FilePath;
    by: UserId;
    reason: string;
    now: Date;
  }): DecisionSet {
    const target = this.decisions.find((each) =>
      each.id.equals(input.decisionId),
    );

    if (!target) {
      throw new UnknownDecisionError();
    }

    const disputed = target.dispute(
      DecisionDispute.of({
        id: input.id,
        path: input.path,
        by: input.by,
        reason: input.reason,
        at: input.now,
      }),
    );
    const changed = this.with({
      decisions: this.decisions.map((each) =>
        each.equals(target) ? disputed : each,
      ),
    });
    changed.record(
      new DecisionDisputed(this.id, this.taskId, target.id, input.path),
    );
    return changed;
  }

  merge(merge: DecisionMerge): DecisionSet {
    if (this.status.isMerged) {
      return this;
    }

    const merged = this.with({ status: DecisionStatus.merged(merge) });
    merged.record(new DecisionsMerged(this.id, this.taskId, merge.commit));
    return merged;
  }

  closeUnmerged(): DecisionSet {
    if (this.status.isMerged || this.discarded) {
      return this;
    }

    const discarded = this.with({ discarded: true });
    discarded.record(new DecisionsDiscarded(this.id, this.taskId));
    return discarded;
  }

  private with(change: {
    decidedIn?: RunId;
    decisions?: readonly Decision[];
    draft?: DecisionDraft | null;
    status?: DecisionStatus;
    discarded?: boolean;
  }): DecisionSet {
    const next = new DecisionSet(
      this.id,
      this.taskId,
      this.workspaceId,
      change.decidedIn ?? this.decidedIn,
      change.decisions ?? this.decisions,
      change.draft !== undefined ? change.draft : this.draft,
      change.status ?? this.status,
      change.discarded ?? this.discarded,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
