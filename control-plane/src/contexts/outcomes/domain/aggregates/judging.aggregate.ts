import { RunJudged } from '@outcomes/domain/events/run-judged.event';
import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import {
  groundedVerdict,
  type Verdict,
} from '@outcomes/domain/services/grounded-verdict';
import type { JudgeEvidence } from '@outcomes/domain/services/judge-evidence';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import type { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import type { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class Judging extends EventRecorder implements HasPendingJob<Judging> {
  private constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly place: RunPlace,
    readonly fingerprint: string | null,
    readonly rubric: Rubric,
    readonly queuedAt: Date,
    readonly job: PendingJob | null,
    readonly judgedAt: Date | null,
    readonly failure: JudgingFailure | null,
    readonly version: number,
  ) {
    super();
  }

  static requested(input: {
    runId: RunId;
    workspaceId: WorkspaceId;
    place: RunPlace;
    fingerprint: string | null;
    rubric: Rubric;
    now: Date;
  }): Judging {
    return new Judging(
      input.runId,
      input.workspaceId,
      input.place,
      input.fingerprint,
      input.rubric,
      input.now,
      PendingJob.fresh(),
      null,
      null,
      0,
    );
  }

  static rehydrate(input: {
    runId: RunId;
    workspaceId: WorkspaceId;
    place: RunPlace;
    fingerprint: string | null;
    rubric: Rubric;
    queuedAt: Date;
    job: PendingJob | null;
    judgedAt: Date | null;
    failure: JudgingFailure | null;
    version: number;
  }): Judging {
    const outcomes = [input.job, input.judgedAt, input.failure].filter(
      (each) => each !== null,
    );

    if (outcomes.length !== 1) {
      throw new InconsistentStateError(
        'judging',
        'is either pending, judged or failed, and only one of these',
      );
    }

    return new Judging(
      input.runId,
      input.workspaceId,
      input.place,
      input.fingerprint,
      input.rubric,
      input.queuedAt,
      input.job,
      input.judgedAt,
      input.failure,
      input.version,
    );
  }

  get hasPendingJob(): boolean {
    return this.job !== null;
  }

  get jobExhausted(): boolean {
    return this.job?.exhausted ?? false;
  }

  leaseJob(now: Date): Judging {
    if (!this.job) {
      throw InvalidScoreError.ofJudging('is already done');
    }
    if (!this.job.isDue(now) || this.job.exhausted) {
      throw InvalidScoreError.ofJudging('cannot be retried yet');
    }

    return this.with({ job: this.job.lease(now) });
  }

  scheduleRetry(now: Date): Judging {
    return this.failed(JudgingFailure.of('errored', now));
  }

  deadLetter(now: Date): Judging {
    return this.ended(JudgingFailure.of('interrupted', now));
  }

  failed(failure: JudgingFailure): Judging {
    if (!this.job) {
      return this;
    }

    const next = failure.retry.nextAttemptAt(this.job.attempts, failure.at);

    return next
      ? this.with({ job: this.job.scheduleRetryAt(next) })
      : this.ended(failure);
  }

  recordVerdict(input: {
    verdict: Verdict;
    evidence: JudgeEvidence;
    model: string;
    now: Date;
  }): Judging {
    if (!this.job) {
      return this;
    }

    if (!input.evidence.isFor(this.runId)) {
      throw InvalidScoreError.ofJudging('must use only its own run’s evidence');
    }

    const grounded = groundedVerdict(
      this.rubric.criteria,
      input.verdict,
      input.evidence,
    );

    if (!grounded.grounded) {
      return this.failed(JudgingFailure.of(grounded.failure, input.now));
    }

    const judged = this.with({
      job: null,
      judgedAt: input.now,
      failure: null,
    });
    judged.record(
      new RunJudged(
        this.runId,
        this.workspaceId,
        this.place,
        this.fingerprint,
        this.rubric.version,
        this.rubric.scale,
        grounded.value,
        grounded.marks,
        input.model,
        grounded.reasons,
        input.evidence.seenFor(grounded.reasons),
        input.now,
      ),
    );
    return judged;
  }

  private ended(failure: JudgingFailure): Judging {
    return this.job ? this.with({ job: null, failure }) : this;
  }

  private with(change: {
    job?: PendingJob | null;
    judgedAt?: Date;
    failure?: JudgingFailure | null;
  }): Judging {
    const next = new Judging(
      this.runId,
      this.workspaceId,
      this.place,
      this.fingerprint,
      this.rubric,
      this.queuedAt,
      change.job !== undefined ? change.job : this.job,
      change.judgedAt ?? this.judgedAt,
      change.failure !== undefined ? change.failure : this.failure,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
