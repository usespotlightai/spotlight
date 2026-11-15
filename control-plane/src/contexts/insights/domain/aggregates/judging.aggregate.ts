import { RunJudged } from '@insights/domain/events/run-judged.event';
import { InvalidJudgingError } from '@insights/domain/exceptions/invalid-judging.error';
import {
  groundedVerdict,
  type Verdict,
} from '@insights/domain/services/grounded-verdict';
import type { JudgeEvidence } from '@insights/domain/services/judge-evidence';
import { ConfigFingerprint } from '@insights/domain/value-objects/config-fingerprint.vo';
import type { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import {
  LIVE,
  type ScoreOrigin,
} from '@insights/domain/value-objects/score-origin';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import { JudgingFailure } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class Judging extends EventRecorder implements HasPendingJob<Judging> {
  private deleted = false;

  private constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly location: RunLocation,
    readonly fingerprint: ConfigFingerprint | null,
    readonly rubric: Rubric,
    readonly origin: ScoreOrigin,
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
    location: RunLocation;
    fingerprint: ConfigFingerprint | null;
    rubric: Rubric;
    now: Date;
    origin?: ScoreOrigin;
  }): Judging {
    return new Judging(
      input.runId,
      input.workspaceId,
      input.location,
      input.fingerprint,
      input.rubric,
      input.origin ?? LIVE,
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
    location: RunLocation;
    fingerprint: string | null;
    rubric: Rubric;
    origin?: ScoreOrigin;
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
      input.location,
      ConfigFingerprint.optional(input.fingerprint),
      input.rubric,
      input.origin ?? LIVE,
      input.queuedAt,
      input.job,
      input.judgedAt,
      input.failure,
      input.version,
    );
  }

  rejudged(rubric: Rubric, now: Date): Judging {
    if (this.job || this.rubric.version === rubric.version) {
      return this;
    }

    const next = new Judging(
      this.runId,
      this.workspaceId,
      this.location,
      this.fingerprint,
      rubric,
      'backfill',
      now,
      PendingJob.fresh(),
      null,
      null,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }

  get hasPendingJob(): boolean {
    return this.job !== null;
  }

  get jobExhausted(): boolean {
    return this.job?.exhausted ?? false;
  }

  leaseJob(now: Date): Judging {
    if (!this.job) {
      throw new InvalidJudgingError('is already done');
    }
    if (!this.job.isDue(now) || this.job.exhausted) {
      throw new InvalidJudgingError('cannot be retried yet');
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
      throw new InvalidJudgingError('must use only its own run’s evidence');
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
        this.location,
        this.fingerprint,
        this.rubric.version,
        grounded.claimResults,
        this.rubric.passThreshold,
        input.model,
        grounded.reasons,
        input.evidence.seenFor(grounded.reasons),
        input.now,
        this.origin,
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
      this.location,
      this.fingerprint,
      this.rubric,
      this.origin,
      this.queuedAt,
      change.job !== undefined ? change.job : this.job,
      change.judgedAt ?? this.judgedAt,
      change.failure !== undefined ? change.failure : this.failure,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }

  get isDeleted(): boolean {
    return this.deleted;
  }

  delete(): Judging {
    const deleted = this.with({});
    deleted.deleted = true;
    return deleted;
  }
}
