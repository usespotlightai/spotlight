import { RunAbandoned } from '@domain/events/run-abandoned.event';
import { RunCompleted } from '@domain/events/run-completed.event';
import { InvalidRunTransitionError } from '@domain/exceptions/invalid-run-transition.error';
import type { Declaration } from '@domain/value-objects/declaration.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import type { RunState } from '@domain/value-objects/run-state';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/** How long a claim survives without the runner asking again. */
const LEASE_DURATION_MS = 60_000;

const MAX_ATTEMPTS = 3;

export interface RunOutcome {
  readonly exitCode: number;
  readonly failed: boolean;
  readonly message?: string;
}

/** What the agent said as it finished. The run announces it and keeps none. */
export interface Said {
  readonly declared?: Declaration | null;
  readonly session?: HarnessSession | null;
}

/**
 * One unit of work a runner claims. The state here is the control plane's own
 * view: a runner reporting nothing for a lease's length is indistinguishable
 * from one that died, so both put the run back on the queue.
 */
export class Run {
  #gaveUp = false;
  #raised: (RunCompleted | RunAbandoned)[] = [];

  private constructor(
    readonly id: RunId,
    readonly workspaceId: WorkspaceId,
    readonly harness: HarnessId,
    readonly priority: number,
    readonly taskId: TaskId | null,
    readonly spec: unknown,
    readonly targetRunner: RunnerId | null,
    private currentState: RunState,
    private claimant: RunnerId | null,
    private leaseUntil: Date | null,
    private outcome: RunOutcome | null,
    private attemptNumber: number,
  ) {}

  static enqueue(input: {
    id: RunId;
    workspaceId: WorkspaceId;
    harness: HarnessId;
    priority?: number;
    taskId?: TaskId | null;
    spec: unknown;
    targetRunner?: RunnerId | null;
  }): Run {
    return new Run(
      input.id,
      input.workspaceId,
      input.harness,
      input.priority ?? 0,
      input.taskId ?? null,
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
    spec: unknown;
    targetRunner: RunnerId | null;
    state: RunState;
    claimedBy: RunnerId | null;
    leaseExpiresAt: Date | null;
    outcome: RunOutcome | null;
    attempt: number;
  }): Run {
    return new Run(
      input.id,
      input.workspaceId,
      input.harness,
      input.priority,
      input.taskId,
      input.spec,
      input.targetRunner,
      input.state,
      input.claimedBy,
      input.leaseExpiresAt,
      input.outcome,
      input.attempt,
    );
  }

  get state(): RunState {
    return this.currentState;
  }

  get claimedBy(): RunnerId | null {
    return this.claimant;
  }

  get leaseExpiresAt(): Date | null {
    return this.leaseUntil;
  }

  get result(): RunOutcome | null {
    return this.outcome;
  }

  get attempt(): number {
    return this.attemptNumber;
  }

  /**
   * Hands the run to a runner. Which row gets here is the queue's problem and
   * is settled in the database. What being claimed means, the lease and the
   * claimant and the state, is settled here.
   */
  claim(by: RunnerId, now: Date): void {
    if (this.currentState !== 'queued') {
      throw new InvalidRunTransitionError(
        `cannot be claimed while it is ${this.currentState}`,
      );
    }
    if (this.targetRunner && !this.targetRunner.equals(by)) {
      throw new InvalidRunTransitionError(
        'cannot be claimed by a runner it was not meant for',
      );
    }

    this.currentState = 'claimed';
    this.claimant = by;
    this.leaseUntil = this.leaseFrom(now);
  }

  /**
   * Puts a run whose runner stopped reporting back on the queue. The attempt
   * rises so the next telling is not mistaken for a duplicate of the one that
   * was cut short.
   */
  requeue(now: Date): void {
    if (!this.lapsed(now)) {
      throw new InvalidRunTransitionError(
        `cannot be requeued while it is ${this.currentState} and its lease holds`,
      );
    }

    if (this.attemptNumber >= MAX_ATTEMPTS) {
      this.giveUp(`no runner finished it in ${MAX_ATTEMPTS} attempts`);
      return;
    }

    this.currentState = 'queued';
    this.claimant = null;
    this.leaseUntil = null;
    this.attemptNumber += 1;
  }

  get abandoned(): boolean {
    return this.#gaveUp;
  }

  private giveUp(reason: string): void {
    this.#gaveUp = true;
    this.currentState = 'failed';
    this.claimant = null;
    this.leaseUntil = null;
    this.outcome = { exitCode: -1, failed: true, message: reason };
    this.#raised.push(
      new RunAbandoned(this.id, this.taskId, this.attemptNumber),
    );
  }

  /**
   * Puts a claimed run back on the queue because its claimant can no longer
   * serve it, whatever its lease says. Waiting for the lease to lapse would
   * leave the work abandoned for as long as a lease lasts.
   */
  release(): void {
    if (this.currentState !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot be released while it is ${this.currentState}`,
      );
    }

    this.currentState = 'queued';
    this.claimant = null;
    this.leaseUntil = null;
    this.attemptNumber += 1;
  }

  /** Extends the lease. Only the runner holding the claim may do so. */
  renewLease(by: RunnerId, now: Date): void {
    this.requireHeldBy(by, 'renew the lease on');
    this.leaseUntil = this.leaseFrom(now);
  }

  complete(by: RunnerId, outcome: RunOutcome, said: Said = {}): void {
    this.requireHeldBy(by, 'complete');
    this.currentState = outcome.failed ? 'failed' : 'completed';
    this.outcome = outcome;
    this.leaseUntil = null;
    this.#raised.push(
      new RunCompleted(
        this.id,
        this.taskId,
        outcome,
        by,
        said.declared ?? null,
        said.session ?? null,
      ),
    );
  }

  pullEvents(): readonly (RunCompleted | RunAbandoned)[] {
    const raised = this.#raised;
    this.#raised = [];
    return raised;
  }

  assertHeldBy(by: RunnerId): void {
    this.requireHeldBy(by, 'act on');
  }

  /** True when nobody has reported on it for longer than a lease. */
  lapsed(now: Date): boolean {
    return (
      this.currentState === 'claimed' &&
      this.leaseUntil !== null &&
      this.leaseUntil.getTime() <= now.getTime()
    );
  }

  private leaseFrom(now: Date): Date {
    return new Date(now.getTime() + LEASE_DURATION_MS);
  }

  private requireHeldBy(by: RunnerId, action: string): void {
    if (this.currentState !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot ${action} a run that is ${this.currentState}`,
      );
    }
    if (!this.claimant?.equals(by)) {
      throw new InvalidRunTransitionError(
        `cannot ${action} a run claimed by another runner`,
      );
    }
  }
}
