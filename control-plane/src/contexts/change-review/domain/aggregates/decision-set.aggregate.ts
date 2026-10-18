import {
  Decision,
  type ProposedDecision,
} from '@change-review/domain/entities/decision.entity';
import { DecisionDispute } from '@change-review/domain/entities/decision-dispute.entity';
import { DecisionDisputed } from '@change-review/domain/events/decision-disputed.event';
import { DecisionGenerationFailed } from '@change-review/domain/events/decision-generation-failed.event';
import { DecisionsDiscarded } from '@change-review/domain/events/decisions-discarded.event';
import { DecisionsMerged } from '@change-review/domain/events/decisions-merged.event';
import { DecisionsRecorded } from '@change-review/domain/events/decisions-recorded.event';
import { DecisionsRequested } from '@change-review/domain/events/decisions-requested.event';
import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import { UnknownDecisionError } from '@change-review/domain/exceptions/unknown-decision.error';
import type { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import type { DecisionEvidence } from '@change-review/domain/value-objects/decision-evidence.vo';
import { DecisionGeneration } from '@change-review/domain/value-objects/decision-generation.vo';
import { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import type { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import type { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { DecisionStatus } from '@change-review/domain/value-objects/decision-status.vo';
import type { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DecisionSet
  extends EventRecorder
  implements HasPendingJob<DecisionSet>
{
  private constructor(
    readonly id: DecisionSetId,
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly sourceRunId: RunId | null,
    readonly decisions: readonly Decision[],
    readonly generation: DecisionGeneration | null,
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
    sourceRunId: RunId | null;
    decisions: readonly Decision[];
    generation: DecisionGeneration | null;
    status: DecisionStatus;
    version: number;
  }): DecisionSet {
    if (input.decisions.length > 0 && !input.sourceRunId) {
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
      input.sourceRunId,
      input.decisions,
      input.generation,
      input.status,
      false,
      input.version,
    );
  }

  get hasPendingJob(): boolean {
    return this.generation !== null;
  }

  get jobExhausted(): boolean {
    return this.generation?.job.exhausted ?? false;
  }

  requestGeneration(runId: RunId, now: Date): DecisionSet {
    if (
      this.status.isMerged ||
      this.generation?.isFor(runId) ||
      this.sourceRunId?.equals(runId)
    ) {
      return this;
    }

    const requested = this.with({
      generation: DecisionGeneration.requested(runId, now),
    });
    requested.record(new DecisionsRequested(this.id, this.taskId, runId));
    return requested;
  }

  leaseJob(now: Date): DecisionSet {
    if (!this.generation) {
      throw InvalidDecisionError.ofSet('has no run to generate decisions from');
    }
    if (!this.generation.job.isDue(now) || this.generation.job.exhausted) {
      throw InvalidDecisionError.ofSet('cannot generate decisions again yet');
    }

    return this.with({
      generation: this.generation.withJob(this.generation.job.lease(now)),
    });
  }

  scheduleRetry(now: Date): DecisionSet {
    if (!this.generation) {
      return this;
    }

    return this.generation.job.exhausted
      ? this.deadLetter()
      : this.with({
          generation: this.generation.withJob(
            this.generation.job.scheduleRetry(now),
          ),
        });
  }

  deadLetter(): DecisionSet {
    if (!this.generation) {
      return this;
    }

    const cleared = this.with({ generation: null });
    cleared.record(
      new DecisionGenerationFailed(this.id, this.taskId, this.generation.runId),
    );
    return cleared;
  }

  recordGeneration(input: {
    runId: RunId;
    proposed: readonly ProposedDecision[];
    evidence: DecisionEvidence;
    newId: () => string;
  }): DecisionSet {
    if (!this.generation?.isFor(input.runId)) {
      return this;
    }

    const valid = input.proposed.flatMap((each) => {
      try {
        const decision = Decision.of(DecisionId.of(input.newId()), each);
        return input.evidence.supports(decision) ? [decision] : [];
      } catch (error) {
        if (error instanceof InvalidDecisionError) {
          return [];
        }
        throw error;
      }
    });

    const recorded = this.with({
      sourceRunId: input.runId,
      decisions: valid,
      generation: null,
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
    sourceRunId?: RunId;
    decisions?: readonly Decision[];
    generation?: DecisionGeneration | null;
    status?: DecisionStatus;
    discarded?: boolean;
  }): DecisionSet {
    const next = new DecisionSet(
      this.id,
      this.taskId,
      this.workspaceId,
      change.sourceRunId ?? this.sourceRunId,
      change.decisions ?? this.decisions,
      change.generation !== undefined ? change.generation : this.generation,
      change.status ?? this.status,
      change.discarded ?? this.discarded,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
