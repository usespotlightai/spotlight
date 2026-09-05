import { EventRecorder } from '@domain/aggregates/event-recorder';
import { RunAbandoned } from '@domain/events/run-abandoned.event';
import { RunCompleted } from '@domain/events/run-completed.event';
import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
import { InvalidRunTransitionError } from '@domain/exceptions/invalid-run-transition.error';
import type { Declaration } from '@domain/value-objects/declaration.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import type { RunSpec } from '@domain/value-objects/run-spec.vo';
import type { RunState } from '@domain/value-objects/run-state';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

const LEASE_DURATION_MS = 60_000;

const MAX_ATTEMPTS = 3;

export interface RunOutcome {
  readonly exitCode: number;
  readonly failed: boolean;
  readonly message?: string;
}

export interface Said {
  readonly declared?: Declaration | null;
  readonly session?: HarnessSession | null;
}

/**
 * One unit of work a runner claims. A runner reporting nothing for a lease's
 * length is indistinguishable from one that died, so both requeue the run.
 */
export class Run extends EventRecorder {
  private constructor(
    readonly id: RunId,
    readonly workspaceId: WorkspaceId,
    readonly harness: HarnessId,
    readonly priority: number,
    readonly taskId: TaskId | null,
    // A task moves on; the station a run worked does not.
    readonly stationId: StationId | null,
    readonly spec: RunSpec,
    readonly targetRunner: RunnerId | null,
    readonly state: RunState,
    readonly claimedBy: RunnerId | null,
    readonly leaseExpiresAt: Date | null,
    readonly result: RunOutcome | null,
    readonly attempt: number,
  ) {
    super();
  }

  static enqueue(input: {
    id: RunId;
    workspaceId: WorkspaceId;
    harness: HarnessId;
    priority?: number;
    taskId?: TaskId | null;
    stationId?: StationId | null;
    spec: RunSpec;
    targetRunner?: RunnerId | null;
  }): Run {
    return new Run(
      input.id,
      input.workspaceId,
      input.harness,
      input.priority ?? 0,
      input.taskId ?? null,
      input.stationId ?? null,
      input.spec,
      input.targetRunner ?? null,
      'queued',
      null,
      null,
      null,
      1,
    );
  }

  static rehydrate(input: {
    id: RunId;
    workspaceId: WorkspaceId;
    harness: HarnessId;
    priority: number;
    taskId: TaskId | null;
    stationId: StationId | null;
    spec: RunSpec;
    targetRunner: RunnerId | null;
    state: RunState;
    claimedBy: RunnerId | null;
    leaseExpiresAt: Date | null;
    result: RunOutcome | null;
    attempt: number;
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

  /** Which row gets here is the queue's problem, settled in the database. */
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
      result: { exitCode: -1, failed: true, message: reason },
    });

    abandoned.record(new RunAbandoned(this.id, this.taskId, this.attempt));

    return abandoned;
  }

  /** Queued again, on a fresh attempt so its telling is not taken for the last. */
  private backOnTheQueue(): Run {
    return this.with({
      state: 'queued',
      claimedBy: null,
      leaseExpiresAt: null,
      attempt: this.attempt + 1,
    });
  }

  /** Whatever its lease says: waiting it out abandons the work for that long. */
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

  complete(by: RunnerId, outcome: RunOutcome, said: Said = {}): Run {
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
