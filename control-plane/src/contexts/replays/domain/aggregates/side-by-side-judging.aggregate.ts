import { SideBySideJudged } from '@replays/domain/events/side-by-side-judged.event';
import { SideBySideJudgingFailed } from '@replays/domain/events/side-by-side-judging-failed.event';
import { InvalidJudgingError } from '@replays/domain/exceptions/invalid-judging.error';
import { PairVerdict } from '@replays/domain/value-objects/entry-pairing.vo';
import type { PairJudgment } from '@replays/domain/value-objects/pair-judgment';
import {
  oppositeOf,
  type PairOrder,
  pairOrderOf,
} from '@replays/domain/value-objects/pair-order';
import { SideBySideJudgingRound } from '@replays/domain/value-objects/side-by-side-judging-round.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import { itemAt } from '@shared-kernel/domain/item-at';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { JudgingFailure } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 2;

interface State {
  readonly runId: RunId;
  readonly otherRunId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId;
  readonly order: PairOrder;
  readonly queuedAt: Date;
  readonly job: PendingJob | null;
  readonly judgedAt: Date | null;
  readonly failure: JudgingFailure | null;
  readonly version: number;
}

export class SideBySideJudging
  extends EventRecorder
  implements HasPendingJob<SideBySideJudging>
{
  private constructor(
    private readonly state: State,
    readonly isDeleted = false,
  ) {
    super();
  }

  static requested(input: {
    runId: RunId;
    otherRunId: RunId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    criteria: JudgeCriteria;
    reference: RunId;
    now: Date;
  }): SideBySideJudging {
    if (
      input.runId.equals(input.otherRunId) ||
      input.reference.equals(input.runId) ||
      input.reference.equals(input.otherRunId)
    ) {
      throw new InvalidJudgingError(
        'must compare two different runs against an accepted third',
      );
    }

    return new SideBySideJudging({
      runId: input.runId,
      otherRunId: input.otherRunId,
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      criteria: input.criteria,
      reference: input.reference,
      order: pairOrderOf(input.runId, input.otherRunId),
      queuedAt: input.now,
      job: PendingJob.fresh(),
      judgedAt: null,
      failure: null,
      version: 0,
    });
  }

  static rehydrate(state: State): SideBySideJudging {
    const outcomes = [state.job, state.judgedAt, state.failure].filter(
      (each) => each !== null,
    );

    if (outcomes.length !== 1) {
      throw new InconsistentStateError(
        'side-by-side judging',
        'is either pending, judged or failed, and only one of these',
      );
    }
    if (state.order !== pairOrderOf(state.runId, state.otherRunId)) {
      throw new InconsistentStateError(
        'side-by-side judging',
        'shows its two changes in the order drawn from their runs',
      );
    }

    return new SideBySideJudging(state);
  }

  get runId(): RunId {
    return this.state.runId;
  }

  get otherRunId(): RunId {
    return this.state.otherRunId;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get criteria(): JudgeCriteria {
    return this.state.criteria;
  }

  get reference(): RunId {
    return this.state.reference;
  }

  get order(): PairOrder {
    return this.state.order;
  }

  get queuedAt(): Date {
    return this.state.queuedAt;
  }

  get job(): PendingJob | null {
    return this.state.job;
  }

  get judgedAt(): Date | null {
    return this.state.judgedAt;
  }

  get failure(): JudgingFailure | null {
    return this.state.failure;
  }

  get version(): number {
    return this.state.version;
  }

  get hasPendingJob(): boolean {
    return this.state.job !== null;
  }

  get jobExhausted(): boolean {
    return this.state.job?.exhausted ?? false;
  }

  get orders(): readonly PairOrder[] {
    return [this.state.order, oppositeOf(this.state.order)];
  }

  leaseJob(now: Date): SideBySideJudging {
    const job = this.state.job;

    if (!job) {
      throw new InvalidJudgingError('is already done');
    }
    if (!job.isDue(now) || job.exhausted) {
      throw new InvalidJudgingError('cannot be retried yet');
    }

    return this.with({ job: job.lease(now) });
  }

  scheduleRetry(now: Date): SideBySideJudging {
    return this.failed(JudgingFailure.of('errored', now));
  }

  waitJob(now: Date): SideBySideJudging {
    return this.job ? this.with({ job: this.job.wait(now) }) : this;
  }

  /** The round the leased job runs. */
  get round(): SideBySideJudgingRound {
    if (!this.state.job) {
      throw new InvalidJudgingError('has no round once it is done');
    }

    return this.roundOf(this.state.job.attempts);
  }

  /**
   * Makes the job due now when a session it waits on has settled. A waiting job handed its try back, so it waits
   * on the round of its next try; a job already due, or a session of any other round, is left as it is.
   */
  wake(round: SideBySideJudgingRound, now: Date): SideBySideJudging {
    const { job } = this.state;

    if (
      !job ||
      job.isDue(now) ||
      !round.equals(this.roundOf(job.attempts + 1))
    ) {
      return this;
    }

    const woken = job.wake(now);

    return woken === job ? this : this.with({ job: woken });
  }

  deadLetter(now: Date): SideBySideJudging {
    return this.ended(JudgingFailure.of('interrupted', now));
  }

  failed(failure: JudgingFailure): SideBySideJudging {
    const job = this.state.job;

    if (!job) {
      return this;
    }

    const next =
      job.attempts < ATTEMPTS
        ? failure.retry.nextAttemptAt(job.attempts, failure.at)
        : null;

    return next
      ? this.with({ job: job.scheduleRetryAt(next) })
      : this.ended(failure);
  }

  recordJudgment(judgment: PairJudgment, now: Date): SideBySideJudging {
    if (!this.state.job) {
      return this;
    }

    if (!judgment.judged) {
      return this.failed(JudgingFailure.of(judgment.failure, now));
    }

    const first = itemAt(judgment.passes, 0);
    const second = itemAt(judgment.passes, 1);

    if (
      first === undefined ||
      second === undefined ||
      judgment.passes.length !== this.orders.length ||
      judgment.passes.some(
        (each, at) => each.ownShownFirst !== (this.orders[at] === 'run-first'),
      )
    ) {
      throw new InvalidJudgingError(
        'must judge its own two runs, once in each order',
      );
    }

    const verdict = PairVerdict.of({
      outcome: first.outcome === second.outcome ? first.outcome : 'tie',
      model: judgment.model,
      passes: judgment.passes,
    });
    const judged = this.with({
      job: null,
      judgedAt: now,
      failure: null,
    });
    judged.record(
      new SideBySideJudged(
        this.state.runId,
        this.state.otherRunId,
        this.state.workspaceId,
        verdict,
        now,
      ),
    );
    return judged;
  }

  private roundOf(attempt: number): SideBySideJudgingRound {
    return SideBySideJudgingRound.of({
      runId: this.state.runId,
      otherRunId: this.state.otherRunId,
      attempt,
    });
  }

  private ended(failure: JudgingFailure): SideBySideJudging {
    if (!this.state.job) {
      return this;
    }

    const ended = this.with({ job: null, failure });
    ended.record(
      new SideBySideJudgingFailed(
        this.state.runId,
        this.state.otherRunId,
        this.state.workspaceId,
        failure,
      ),
    );
    return ended;
  }

  delete(): SideBySideJudging {
    const deleted = new SideBySideJudging(this.state, true);

    deleted.inheritEvents(this);

    return deleted;
  }

  private with(part: Partial<State>): SideBySideJudging {
    const next = new SideBySideJudging(
      { ...this.state, ...part },
      this.isDeleted,
    );

    next.inheritEvents(this);

    return next;
  }
}
