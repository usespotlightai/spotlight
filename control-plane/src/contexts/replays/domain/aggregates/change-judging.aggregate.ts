import { ChangeJudged } from '@replays/domain/events/change-judged.event';
import { ChangeJudgingFailed } from '@replays/domain/events/change-judging-failed.event';
import { InvalidJudgingError } from '@replays/domain/exceptions/invalid-judging.error';
import type { ChangeJudgment } from '@replays/domain/value-objects/change-judgment';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import type { JudgingAttempt } from '@replays/domain/value-objects/judging-attempt';
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
  readonly attempt: JudgingAttempt;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId | null;
  readonly queuedAt: Date;
  readonly job: PendingJob | null;
  readonly judgedAt: Date | null;
  readonly failure: JudgingFailure | null;
  readonly version: number;
}

export class ChangeJudging
  extends EventRecorder
  implements HasPendingJob<ChangeJudging>
{
  private constructor(
    private readonly state: State,
    readonly isDeleted = false,
  ) {
    super();
  }

  static requested(input: {
    runId: RunId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    criteria: JudgeCriteria;
    reference: RunId | null;
    now: Date;
  }): ChangeJudging {
    if (input.reference?.equals(input.runId)) {
      throw new InvalidJudgingError('must compare a change with another run’s');
    }

    return new ChangeJudging({
      runId: input.runId,
      attempt: 1,
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      criteria: input.criteria,
      reference: input.reference,
      queuedAt: input.now,
      job: PendingJob.fresh(),
      judgedAt: null,
      failure: null,
      version: 0,
    });
  }

  static rehydrate(state: State): ChangeJudging {
    const outcomes = [state.job, state.judgedAt, state.failure].filter(
      (each) => each !== null,
    );

    if (outcomes.length !== 1) {
      throw new InconsistentStateError(
        'change judging',
        'is either pending, judged or failed, and only one of these',
      );
    }

    return new ChangeJudging(state);
  }

  get runId(): RunId {
    return this.state.runId;
  }

  get attempt(): JudgingAttempt {
    return this.state.attempt;
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

  get reference(): RunId | null {
    return this.state.reference;
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

  requeued(now: Date): ChangeJudging {
    if (this.state.attempt !== 1 || this.state.judgedAt === null) {
      throw new InvalidJudgingError(
        'can be requeued only for a change judged once',
      );
    }

    return new ChangeJudging({
      ...this.state,
      attempt: 2,
      queuedAt: now,
      job: PendingJob.fresh(),
      judgedAt: null,
      failure: null,
      version: 0,
    });
  }

  get guidanceRequested(): boolean {
    return this.state.attempt === 1;
  }

  get hasPendingJob(): boolean {
    return this.state.job !== null;
  }

  get jobExhausted(): boolean {
    return this.state.job?.exhausted ?? false;
  }

  leaseJob(now: Date): ChangeJudging {
    const job = this.state.job;

    if (!job) {
      throw new InvalidJudgingError('is already done');
    }
    if (!job.isDue(now) || job.exhausted) {
      throw new InvalidJudgingError('cannot be retried yet');
    }

    return this.with({ job: job.lease(now) });
  }

  scheduleRetry(now: Date): ChangeJudging {
    return this.failed(JudgingFailure.of('errored', now));
  }

  deadLetter(now: Date): ChangeJudging {
    return this.ended(JudgingFailure.of('interrupted', now));
  }

  failed(failure: JudgingFailure): ChangeJudging {
    const job = this.state.job;

    if (!job) {
      return this;
    }

    const next = failure.retry.nextAttemptAt(job.attempts, failure.at);

    return next
      ? this.with({ job: job.scheduleRetryAt(next) })
      : this.ended(failure);
  }

  recordJudgment(judgment: ChangeJudgment, now: Date): ChangeJudging {
    if (!this.state.job) {
      return this;
    }

    if (!judgment.judged) {
      return this.failed(JudgingFailure.of(judgment.failure, now));
    }

    const { criteria } = this.state;
    const verdict = JudgeVerdict.of({
      scale: criteria.scale.kind,
      value: judgment.value,
      claimResults: judgment.claimResults,
      claims: criteria.claims,
      passThreshold: criteria.passThreshold,
      model: judgment.model,
      referenced: judgment.referenced,
      reasons: judgment.reasons,
      guidance: this.guidanceRequested ? judgment.guidance : null,
    });
    const judged = this.with({
      job: null,
      judgedAt: now,
      failure: null,
    });
    judged.record(
      new ChangeJudged(
        this.state.runId,
        this.state.attempt,
        this.state.workspaceId,
        verdict,
        now,
      ),
    );
    return judged;
  }

  private ended(failure: JudgingFailure): ChangeJudging {
    if (!this.state.job) {
      return this;
    }

    const ended = this.with({ job: null, failure });
    ended.record(
      new ChangeJudgingFailed(
        this.state.runId,
        this.state.attempt,
        this.state.workspaceId,
        failure,
      ),
    );
    return ended;
  }

  delete(): ChangeJudging {
    const deleted = new ChangeJudging(this.state, true);

    deleted.inheritEvents(this);

    return deleted;
  }

  private with(part: Partial<State>): ChangeJudging {
    const next = new ChangeJudging({ ...this.state, ...part }, this.isDeleted);

    next.inheritEvents(this);

    return next;
  }
}
