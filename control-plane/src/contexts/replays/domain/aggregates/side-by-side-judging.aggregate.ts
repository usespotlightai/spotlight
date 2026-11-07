import { SideBySideJudged } from '@replays/domain/events/side-by-side-judged.event';
import { SideBySideJudgingFailed } from '@replays/domain/events/side-by-side-judging-failed.event';
import { InvalidJudgingError } from '@replays/domain/exceptions/invalid-judging.error';
import { PairVerdict } from '@replays/domain/value-objects/entry-pairing.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { PairJudgment } from '@replays/domain/value-objects/pair-judgment';
import {
  oppositeOf,
  type PairOrder,
  pairOrderOf,
} from '@replays/domain/value-objects/pair-order';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { JudgingFailure } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly runId: RunId;
  readonly otherRunId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId;
  readonly maxAttempts: number;
  readonly order: PairOrder;
  readonly queuedAt: Date;
  readonly job: PendingJob | null;
  readonly judgedAt: Date | null;
  readonly failure: JudgingFailure | null;
  readonly spent: ModelSpent;
  readonly version: number;
}

export class SideBySideJudging
  extends EventRecorder
  implements HasPendingJob<SideBySideJudging>
{
  private constructor(private readonly state: State) {
    super();
  }

  static requested(input: {
    runId: RunId;
    otherRunId: RunId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    criteria: JudgeCriteria;
    reference: RunId;
    maxAttempts: number;
    now: Date;
  }): SideBySideJudging {
    if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) {
      throw new InvalidJudgingError(
        'attempts must be from 1 to the number paid for',
      );
    }
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
      maxAttempts: input.maxAttempts,
      order: pairOrderOf(input.runId, input.otherRunId),
      queuedAt: input.now,
      job: PendingJob.fresh(),
      judgedAt: null,
      failure: null,
      spent: ModelSpent.none(),
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

  get maxAttempts(): number {
    return this.state.maxAttempts;
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

  get spent(): ModelSpent {
    return this.state.spent;
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

  deadLetter(now: Date): SideBySideJudging {
    return this.ended(JudgingFailure.of('interrupted', now));
  }

  failed(failure: JudgingFailure): SideBySideJudging {
    const job = this.state.job;

    if (!job) {
      return this;
    }

    const next =
      job.attempts < this.state.maxAttempts
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

    const spending = this.with({
      spent: this.state.spent.plus(judgment.spent),
    });

    if (!judgment.judged) {
      return spending.failed(JudgingFailure.of(judgment.failure, now));
    }

    const [first, second] = judgment.passes;

    if (
      !first ||
      !second ||
      judgment.passes.length !== this.orders.length ||
      judgment.passes.some((each, at) => each.order !== this.orders[at])
    ) {
      throw new InvalidJudgingError(
        'must judge its own two runs, once in each order',
      );
    }

    const verdict = PairVerdict.fromWinner({
      winner: first.winner === second.winner ? first.winner : 'tie',
      model: judgment.model,
      passes: judgment.passes.map((each) => ({
        runShownFirst: each.order === 'run-first',
        winner: each.winner,
        reasons: each.reasons,
      })),
    });
    const judged = spending.with({
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
        judged.spent,
        now,
      ),
    );
    return judged;
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
        this.state.spent,
      ),
    );
    return ended;
  }

  private with(part: Partial<State>): SideBySideJudging {
    const next = new SideBySideJudging({ ...this.state, ...part });

    next.inheritEvents(this);

    return next;
  }
}
