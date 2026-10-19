import { ChangeJudged } from '@insights/domain/events/change-judged.event';
import { ChangeJudgingFailed } from '@insights/domain/events/change-judging-failed.event';
import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import {
  groundedVerdict,
  type Verdict,
} from '@insights/domain/services/grounded-verdict';
import { guardedGuidanceOf } from '@insights/domain/services/guidance';
import type { JudgeEvidence } from '@insights/domain/services/judge-evidence';
import type { JudgeCriteria } from '@insights/domain/value-objects/judge-criteria.vo';
import type { JudgingAttempt } from '@insights/domain/value-objects/judging-attempt';
import { JudgingFailure } from '@insights/domain/value-objects/judging-failure.vo';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import {
  type ModelCall,
  ModelUsage,
} from '@shared-kernel/domain/value-objects/model-usage.vo';
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
  readonly spent: ModelUsage;
  readonly version: number;
}

export class ChangeJudging
  extends EventRecorder
  implements HasPendingJob<ChangeJudging>
{
  private constructor(private readonly state: State) {
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
      throw InvalidScoreError.ofJudging(
        'must compare a change with another run’s',
      );
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
      spent: ModelUsage.none(),
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

  get scale(): ScoreScale {
    return this.state.criteria.scale;
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

  get spent(): ModelUsage {
    return this.state.spent;
  }

  get version(): number {
    return this.state.version;
  }

  requeued(now: Date): ChangeJudging {
    if (this.state.attempt !== 1 || this.state.judgedAt === null) {
      throw InvalidScoreError.ofJudging(
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
      spent: ModelUsage.none(),
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
      throw InvalidScoreError.ofJudging('is already done');
    }
    if (!job.isDue(now) || job.exhausted) {
      throw InvalidScoreError.ofJudging('cannot be retried yet');
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

  recordModel(usage: ModelCall | null): ChangeJudging {
    return usage && this.state.job
      ? this.with({ spent: this.state.spent.with(usage) })
      : this;
  }

  recordVerdict(input: {
    verdict: Verdict;
    guidance: string | null;
    usage: ModelCall | null;
    evidence: JudgeEvidence;
    model: string;
    now: Date;
  }): ChangeJudging {
    if (!this.state.job) {
      return this;
    }

    if (!input.evidence.isFor(this.state.runId)) {
      throw InvalidScoreError.ofJudging('must use only its own run’s evidence');
    }

    const spending = this.recordModel(input.usage);
    const grounded = groundedVerdict(
      this.state.criteria,
      input.verdict,
      input.evidence,
    );

    if (!grounded.grounded) {
      return spending.failed(JudgingFailure.of(grounded.failure, input.now));
    }

    const judged = spending.with({
      job: null,
      judgedAt: input.now,
      failure: null,
    });
    judged.record(
      new ChangeJudged(
        this.state.runId,
        this.state.attempt,
        this.state.workspaceId,
        this.state.criteria.scale,
        grounded.value,
        grounded.claimResults,
        this.state.criteria.claims,
        this.state.criteria.passThreshold,
        input.model,
        grounded.reasons,
        this.guidanceRequested
          ? guardedGuidanceOf(input.guidance, this.state.criteria)
          : null,
        input.evidence.reference !== null,
        judged.spent,
        input.now,
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
        this.state.spent,
      ),
    );
    return ended;
  }

  private with(part: Partial<State>): ChangeJudging {
    const next = new ChangeJudging({ ...this.state, ...part });

    next.inheritEvents(this);

    return next;
  }
}
