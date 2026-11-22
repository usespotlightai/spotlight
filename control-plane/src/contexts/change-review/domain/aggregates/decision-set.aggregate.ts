import { DecisionDispute } from '@change-review/domain/entities/decision-dispute.entity';
import type { Decision } from '@change-review/domain/entities/decision.entity';
import { DecisionDisputed } from '@change-review/domain/events/decision-disputed.event';
import { DecisionsRecorded } from '@change-review/domain/events/decisions-recorded.event';
import { DecisionsRefusedError } from '@change-review/domain/exceptions/decisions-refused.error';
import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import { UnknownDecisionError } from '@change-review/domain/exceptions/unknown-decision.error';
import { DECISION_LIMITS } from '@change-review/domain/services/decision-policy';
import type { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import type { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import type { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import type { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { DecisionStatus } from '@change-review/domain/value-objects/decision-status.vo';
import type { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DecisionSet extends EventRecorder {
  private constructor(
    readonly id: DecisionSetId,
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly decisions: readonly Decision[],
    readonly status: DecisionStatus,
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
      [],
      DecisionStatus.proposed(),
      0,
    );
  }

  static rehydrate(input: {
    id: DecisionSetId;
    taskId: TaskId;
    workspaceId: WorkspaceId;
    decisions: readonly Decision[];
    status: DecisionStatus;
    version: number;
  }): DecisionSet {
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
      input.decisions,
      input.status,
      input.version,
    );
  }

  /**
   * Records decisions the agent of a run made itself. They join the decisions of earlier runs of the task, each kept
   * with the run that recorded it, and a decision the task holds already is kept once.
   */
  recordFromRun(runId: RunId, decisions: readonly Decision[]): DecisionSet {
    if (decisions.length === 0 || decisions.length > DECISION_LIMITS.atOnce) {
      throw InvalidDecisionError.ofSet(
        `must list between 1 and ${DECISION_LIMITS.atOnce} decisions`,
      );
    }

    if (decisions.some((each) => !each.recordedIn.equals(runId))) {
      throw InvalidDecisionError.ofSet(
        'takes in only decisions of the run that records them',
      );
    }

    if (this.status.isMerged) {
      throw new DecisionsRefusedError('task-merged');
    }

    const recorded = decisions.filter(
      (each, at, all) =>
        !this.decisions.some((one) => one.sameAs(each)) &&
        all.findIndex((one) => one.sameAs(each)) === at,
    );

    if (recorded.length === 0) {
      return this;
    }

    if (this.decisions.length + recorded.length > DECISION_LIMITS.perTask) {
      throw new DecisionsRefusedError('task-full');
    }

    const next = this.with({ decisions: [...this.decisions, ...recorded] });

    next.record(
      new DecisionsRecorded(this.id, this.taskId, runId, recorded.length),
    );

    return next;
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
    const status = this.status.merged(merge);

    return status === this.status ? this : this.with({ status });
  }

  mergedIn(repository: Repository): readonly Decision[] {
    return this.status.mergeIn(repository)
      ? this.decisions.filter((each) => each.isWithin(repository))
      : [];
  }

  closedUnmerged(
    repository: Repository,
    openIn: readonly Repository[],
  ): DecisionSet | null {
    if (this.status.mergeIn(repository)) {
      return this;
    }

    const stillOpen = openIn.filter((each) => !each.equals(repository));

    if (!this.status.isMerged && stillOpen.length === 0) {
      return null;
    }

    const kept = this.decisions.filter(
      (each) =>
        !each.isWithin(repository) ||
        stillOpen.some((open) => each.isWithin(open)),
    );

    return kept.length === this.decisions.length
      ? this
      : this.with({ decisions: kept });
  }

  private with(change: {
    decisions?: readonly Decision[];
    status?: DecisionStatus;
  }): DecisionSet {
    const next = new DecisionSet(
      this.id,
      this.taskId,
      this.workspaceId,
      change.decisions ?? this.decisions,
      change.status ?? this.status,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
