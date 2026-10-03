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
import type { OwesWork } from '@shared-kernel/domain/owes-work';
import { OwedWork } from '@shared-kernel/domain/value-objects/owed-work.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class Judging extends EventRecorder implements OwesWork<Judging> {
  private constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly place: RunPlace,
    readonly fingerprint: string | null,
    readonly rubric: Rubric,
    readonly askedAt: Date,
    readonly work: OwedWork | null,
    readonly judgedAt: Date | null,
    readonly failure: JudgingFailure | null,
    readonly version: number,
  ) {
    super();
  }

  static asked(input: {
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
      OwedWork.fresh(),
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
    askedAt: Date;
    work: OwedWork | null;
    judgedAt: Date | null;
    failure: JudgingFailure | null;
    version: number;
  }): Judging {
    const settled = [input.work, input.judgedAt, input.failure].filter(
      (each) => each !== null,
    );

    if (settled.length !== 1) {
      throw new InconsistentStateError(
        'judging',
        'is either still owed, judged or failed, and only one of these',
      );
    }

    return new Judging(
      input.runId,
      input.workspaceId,
      input.place,
      input.fingerprint,
      input.rubric,
      input.askedAt,
      input.work,
      input.judgedAt,
      input.failure,
      input.version,
    );
  }

  get owesWork(): boolean {
    return this.work !== null;
  }

  get workExhausted(): boolean {
    return this.work?.exhausted ?? false;
  }

  leased(now: Date): Judging {
    if (!this.work) {
      throw InvalidScoreError.ofJudging('is done, and owes no more work');
    }
    if (!this.work.dueBy(now) || this.work.exhausted) {
      throw InvalidScoreError.ofJudging('cannot be worked on again yet');
    }

    return this.with({ work: this.work.leased(now) });
  }

  triedAgainLater(now: Date): Judging {
    return this.failed(JudgingFailure.of('errored', now));
  }

  gaveUp(now: Date): Judging {
    return this.ended(JudgingFailure.of('interrupted', now));
  }

  failed(failure: JudgingFailure): Judging {
    if (!this.work) {
      return this;
    }

    const next = failure.retry.after(this.work.attempts, failure.at);

    return next
      ? this.with({ work: this.work.waitingUntil(next) })
      : this.ended(failure);
  }

  judged(input: {
    verdict: Verdict;
    evidence: JudgeEvidence;
    model: string;
    now: Date;
  }): Judging {
    if (!this.work) {
      return this;
    }

    if (!input.evidence.isFor(this.runId)) {
      throw InvalidScoreError.ofJudging(
        'is judged only on the evidence of its own run',
      );
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
      work: null,
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
    return this.work ? this.with({ work: null, failure }) : this;
  }

  private with(change: {
    work?: OwedWork | null;
    judgedAt?: Date;
    failure?: JudgingFailure | null;
  }): Judging {
    const next = new Judging(
      this.runId,
      this.workspaceId,
      this.place,
      this.fingerprint,
      this.rubric,
      this.askedAt,
      change.work !== undefined ? change.work : this.work,
      change.judgedAt ?? this.judgedAt,
      change.failure !== undefined ? change.failure : this.failure,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
