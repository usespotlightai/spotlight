import { EventRecorder } from '@domain/aggregates/event-recorder';
import { RunAbandoned } from '@domain/events/run-abandoned.event';
import { RunCompleted } from '@domain/events/run-completed.event';
import { RunStopRequested } from '@domain/events/run-stop-requested.event';
import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
import { InvalidRunTransitionError } from '@domain/exceptions/invalid-run-transition.error';
import { HandoverReport } from '@domain/value-objects/handover-report.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunOutcome } from '@domain/value-objects/run-outcome.vo';
import { RunPriority } from '@domain/value-objects/run-priority.vo';
import type { RunSpec } from '@domain/value-objects/run-spec.vo';
import type { RunState } from '@domain/value-objects/run-state';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

const LEASE_DURATION_MS = 60_000;

const MAX_ATTEMPTS = 3;

export class Run extends EventRecorder {
  private constructor(
    readonly id: RunId,
    readonly workspaceId: WorkspaceId,
    readonly harness: HarnessId,
    readonly priority: RunPriority,
    readonly taskId: TaskId | null,
    readonly stationId: StationId | null,
    readonly spec: RunSpec,
    readonly targetRunner: RunnerId | null,
    readonly state: RunState,
    readonly claimedBy: RunnerId | null,
    readonly leaseExpiresAt: Date | null,
    readonly result: RunOutcome | null,
    readonly attempt: number,
    readonly stopRequestedAt: Date | null,
  ) {
    super();
  }

  static enqueue(input: {
    id: RunId;
    workspaceId: WorkspaceId;
    harness: HarnessId;
    priority?: RunPriority;
    taskId?: TaskId | null;
    stationId?: StationId | null;
    spec: RunSpec;
    targetRunner?: RunnerId | null;
  }): Run {
    return new Run(
      input.id,
      input.workspaceId,
      input.harness,
      input.priority ?? RunPriority.normal,
      input.taskId ?? null,
      input.stationId ?? null,
      input.spec,
      input.targetRunner ?? null,
      'queued',
      null,
      null,
      null,
      1,
      null,
    );
  }

  static rehydrate(input: {
    id: RunId;
    workspaceId: WorkspaceId;
    harness: HarnessId;
    priority: RunPriority;
    taskId: TaskId | null;
    stationId: StationId | null;
    spec: RunSpec;
    targetRunner: RunnerId | null;
    state: RunState;
    claimedBy: RunnerId | null;
    leaseExpiresAt: Date | null;
    result: RunOutcome | null;
    attempt: number;
    stopRequestedAt?: Date | null;
  }): Run {
    Run.guardReconstituted(input);

    return new Run(
      input.id,
      input.workspaceId,
      input.harness,
      input.priority,
      input.taskId,
      input.stationId,
      input.spec,
      input.targetRunner,
      input.state,
      input.claimedBy,
      input.leaseExpiresAt,
      input.result,
      input.attempt,
      input.stopRequestedAt ?? null,
    );
  }

  private static guardReconstituted(input: {
    state: RunState;
    claimedBy: RunnerId | null;
    leaseExpiresAt: Date | null;
    attempt: number;
  }): void {
    if (input.attempt < 1) {
      throw new InconsistentStateError('run', 'has no attempt to its name');
    }
    if (input.state === 'claimed' && !input.claimedBy) {
      throw new InconsistentStateError('run', 'is claimed by nobody');
    }
    if (input.state === 'claimed' && !input.leaseExpiresAt) {
      throw new InconsistentStateError('run', 'is claimed with no lease');
    }
    if (input.state === 'queued' && (input.claimedBy || input.leaseExpiresAt)) {
      throw new InconsistentStateError(
        'run',
        'is queued yet still held by a runner',
      );
    }
  }

  claim(by: RunnerId, now: Date): Run {
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `cannot be claimed while it is ${this.state}`,
      );
    }
    if (this.targetRunner && !this.targetRunner.equals(by)) {
      throw new InvalidRunTransitionError(
        'cannot be claimed by a runner it was not meant for',
      );
    }

    return this.with({
      state: 'claimed',
      claimedBy: by,
      leaseExpiresAt: this.leaseFrom(now),
    });
  }

  requeue(now: Date): Run {
    if (!this.lapsed(now)) {
      throw new InvalidRunTransitionError(
        `cannot be requeued while it is ${this.state} and its lease holds`,
      );
    }

    if (this.attempt >= MAX_ATTEMPTS) {
      return this.givenUp(`no runner finished it in ${MAX_ATTEMPTS} attempts`);
    }

    return this.backOnTheQueue();
  }

  private givenUp(reason: string): Run {
    const abandoned = this.with({
      state: 'failed',
      claimedBy: null,
      leaseExpiresAt: null,
      result: RunOutcome.abandoned(reason),
    });

    abandoned.record(new RunAbandoned(this.id, this.taskId, this.attempt));

    return abandoned;
  }

  private backOnTheQueue(): Run {
    return this.with({
      state: 'queued',
      claimedBy: null,
      leaseExpiresAt: null,
      attempt: this.attempt + 1,
    });
  }

  release(): Run {
    if (this.state !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot be released while it is ${this.state}`,
      );
    }

    return this.backOnTheQueue();
  }

  renewLease(by: RunnerId, now: Date): Run {
    this.requireHeldBy(by, 'renew the lease on');

    return this.with({ leaseExpiresAt: this.leaseFrom(now) });
  }

  complete(
    by: RunnerId,
    outcome: RunOutcome,
    said: HandoverReport = HandoverReport.none(),
  ): Run {
    this.requireHeldBy(by, 'complete');

    const ended = this.with({
      state: outcome.failed ? 'failed' : 'completed',
      result: outcome,
      leaseExpiresAt: null,
    });

    ended.record(
      new RunCompleted(
        this.id,
        this.taskId,
        outcome,
        by,
        said.declared ?? null,
        said.session ?? null,
      ),
    );

    return ended;
  }

  requestStop(now: Date): Run {
    if (this.state !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot be stopped while it is ${this.state}`,
      );
    }

    if (this.stopRequested) {
      return this;
    }

    const stopping = this.with({ stopRequestedAt: now });

    stopping.record(new RunStopRequested(this.id, this.taskId, now));

    return stopping;
  }

  get stopRequested(): boolean {
    return this.stopRequestedAt !== null;
  }

  assertHeldBy(by: RunnerId): void {
    this.requireHeldBy(by, 'act on');
  }

  lapsed(now: Date): boolean {
    return (
      this.state === 'claimed' &&
      this.leaseExpiresAt !== null &&
      this.leaseExpiresAt.getTime() <= now.getTime()
    );
  }

  private with(part: {
    state?: RunState;
    claimedBy?: RunnerId | null;
    leaseExpiresAt?: Date | null;
    result?: RunOutcome | null;
    attempt?: number;
    stopRequestedAt?: Date | null;
  }): Run {
    return new Run(
      this.id,
      this.workspaceId,
      this.harness,
      this.priority,
      this.taskId,
      this.stationId,
      this.spec,
      this.targetRunner,
      part.state ?? this.state,
      part.claimedBy !== undefined ? part.claimedBy : this.claimedBy,
      part.leaseExpiresAt !== undefined
        ? part.leaseExpiresAt
        : this.leaseExpiresAt,
      part.result !== undefined ? part.result : this.result,
      part.attempt ?? this.attempt,
      part.stopRequestedAt !== undefined
        ? part.stopRequestedAt
        : this.stopRequestedAt,
    );
  }

  private leaseFrom(now: Date): Date {
    return new Date(now.getTime() + LEASE_DURATION_MS);
  }

  private requireHeldBy(by: RunnerId, action: string): void {
    if (this.state !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot ${action} a run that is ${this.state}`,
      );
    }
    if (!this.claimedBy?.equals(by)) {
      throw new InvalidRunTransitionError(
        `cannot ${action} a run claimed by another runner`,
      );
    }
  }
}
