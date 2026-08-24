import { InvalidRunTransitionError } from '@domain/exceptions/invalid-run-transition.error';
import { RunId } from '@domain/value-objects/run-id.vo';
import type { RunState } from '@domain/value-objects/run-state';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/** How long a claim survives without the runner asking again. */
const LEASE_DURATION_MS = 60_000;

export interface RunOutcome {
  readonly exitCode: number;
  readonly failed: boolean;
  readonly message?: string;
}

/**
 * One unit of work a runner claims. The state here is the control plane's own
 * view: a runner reporting nothing for a lease's length is indistinguishable
 * from one that died, so both put the run back on the queue.
 */
export class Run {
  private constructor(
    readonly id: RunId,
    readonly workspaceId: WorkspaceId,
    readonly pool: string,
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
    pool: string;
    spec: unknown;
    targetRunner?: RunnerId | null;
  }): Run {
    return new Run(
      input.id,
      input.workspaceId,
      input.pool,
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
    pool: string;
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
      input.pool,
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

    this.currentState = 'queued';
    this.claimant = null;
    this.leaseUntil = null;
    this.attemptNumber += 1;
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

  complete(by: RunnerId, outcome: RunOutcome): void {
    this.requireHeldBy(by, 'complete');
    this.currentState = outcome.failed ? 'failed' : 'completed';
    this.outcome = outcome;
    this.leaseUntil = null;
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
