import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { InvalidAnswerError } from '@change-review/domain/exceptions/invalid-answer.error';
import { QuestionAlreadyAnsweredError } from '@change-review/domain/exceptions/question-already-answered.error';
import {
  answersQuestion,
  sharesAnswers,
} from '@change-review/domain/services/shown-answer';
import { assertOneOwner } from '@change-review/domain/services/stack-owner';
import type { AnswerGrading } from '@change-review/domain/value-objects/answer-grading.vo';
import type { AnswerVerdict } from '@change-review/domain/value-objects/answer-verdict.vo';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { GradingRound } from '@change-review/domain/value-objects/grading-round.vo';
import type { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import type { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type { SessionFailure } from '@change-review/domain/value-objects/session-failure.vo';
import type { LayerQuestion } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { QuestionId } from '@change-review/domain/value-objects/stack-ids';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import {
  type ModelCall,
  ModelUsage,
} from '@shared-kernel/domain/value-objects/model-usage.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface AnswerGrade {
  readonly verdict: AnswerVerdict;
  readonly feedback: string;
}

export interface GradedReply {
  readonly grade: AnswerGrade;
  readonly usage: ModelCall | null;
}

const MAX_REPLY = 4_000;

const MAX_FEEDBACK = 2_000;

const replyOf = (raw: string | null): string | null => {
  const reply = raw?.trim() || null;

  if (reply && reply.length > MAX_REPLY) {
    throw new InvalidAnswerError(`must be at most ${MAX_REPLY} characters`);
  }

  return reply;
};

const feedbackOf = (raw: string): string | null =>
  raw.trim().slice(0, MAX_FEEDBACK).trimEnd() || null;

interface Answered {
  readonly reply: string | null;
  readonly grading: AnswerGrading;
  readonly verdict: AnswerVerdict | null;
}

/** An answer in words waits for its grade; "I don't know" is missed at once. */
const answeredWith = (raw: string | null): Answered => {
  const reply = replyOf(raw);

  return reply
    ? { reply, grading: 'pending', verdict: null }
    : { reply: null, grading: 'graded', verdict: 'missed' };
};

const assertGraded = (input: Answered): void => {
  if (input.reply === null && input.verdict !== 'missed') {
    throw new InconsistentStateError(
      'question answer',
      'has no words, yet is not missed',
    );
  }
  if ((input.grading === 'graded') !== (input.verdict !== null)) {
    throw new InconsistentStateError(
      'question answer',
      'has a verdict that does not match its grading',
    );
  }
};

export class QuestionAnswer
  extends EventRecorder
  implements HasPendingJob<QuestionAnswer>
{
  private constructor(
    readonly id: QuestionAnswerId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId | null,
    readonly teamId: TeamId | null,
    readonly stackId: ChangeStackId,
    readonly repository: RepositoryName | null,
    readonly questionId: QuestionId,
    readonly personId: UserId,
    readonly asked: string,
    readonly expected: string,
    readonly reply: string | null,
    readonly grading: AnswerGrading,
    readonly verdict: AnswerVerdict | null,
    readonly feedback: string | null,
    readonly usage: ModelUsage,
    readonly job: PendingJob,
    readonly answeredAt: Date,
    readonly version: number,
  ) {
    super();
  }

  static given(input: {
    id: QuestionAnswerId;
    stack: Pick<
      ChangeStack,
      'id' | 'workspaceId' | 'taskId' | 'teamId' | 'repository'
    >;
    question: LayerQuestion;
    personId: UserId;
    reply: string | null;
    now: Date;
  }): QuestionAnswer {
    const { reply, grading, verdict } = answeredWith(input.reply);
    const { stack } = input;

    assertOneOwner('question answer', stack);

    return new QuestionAnswer(
      input.id,
      stack.workspaceId,
      stack.taskId,
      stack.teamId,
      stack.id,
      stack.repository,
      input.question.id,
      input.personId,
      input.question.question,
      input.question.answer,
      reply,
      grading,
      verdict,
      null,
      ModelUsage.none(),
      PendingJob.fresh(),
      input.now,
      0,
    );
  }

  static rehydrate(input: {
    id: QuestionAnswerId;
    workspaceId: WorkspaceId;
    taskId: TaskId | null;
    teamId: TeamId | null;
    stackId: ChangeStackId;
    repository: RepositoryName | null;
    questionId: QuestionId;
    personId: UserId;
    asked: string;
    expected: string;
    reply: string | null;
    grading: AnswerGrading;
    verdict: AnswerVerdict | null;
    feedback: string | null;
    usage: ModelUsage;
    job: PendingJob;
    answeredAt: Date;
    version: number;
  }): QuestionAnswer {
    assertOneOwner('question answer', input);
    assertGraded(input);

    return new QuestionAnswer(
      input.id,
      input.workspaceId,
      input.taskId,
      input.teamId,
      input.stackId,
      input.repository,
      input.questionId,
      input.personId,
      input.asked,
      input.expected,
      input.reply,
      input.grading,
      input.verdict,
      input.feedback,
      input.usage,
      input.job,
      input.answeredAt,
      input.version,
    );
  }

  static refuseIfAnsweredIn(
    answers: readonly QuestionAnswer[],
    question: LayerQuestion,
    stack: Pick<ChangeStack, 'id' | 'taskId' | 'repository'>,
  ): void {
    const scope = {
      stackId: stack.id,
      taskId: stack.taskId,
      repository: stack.repository,
    };

    for (const answer of answers) {
      if (sharesAnswers(answer, scope)) {
        answer.refuseIfAnswered(question);
      }
    }
  }

  answers(question: LayerQuestion): boolean {
    return answersQuestion(this, question);
  }

  refuseIfAnswered(question: LayerQuestion): void {
    if (this.answers(question)) {
      throw new QuestionAlreadyAnsweredError();
    }
  }

  answeredAgain(input: {
    question: LayerQuestion;
    reply: string | null;
    now: Date;
  }): QuestionAnswer {
    if (input.question.id !== this.questionId) {
      throw new InvalidAnswerError('can only answer its own question again');
    }
    this.refuseIfAnswered(input.question);

    const { reply, grading, verdict } = answeredWith(input.reply);

    return this.with({
      asked: input.question.question,
      expected: input.question.answer,
      reply,
      grading,
      verdict,
      feedback: null,
      job: PendingJob.fresh(),
      answeredAt: input.now,
    });
  }

  /** The session that grades this reply now: a retried job grades in a new round, a job that waits keeps its round. */
  get gradingRound(): GradingRound {
    return GradingRound.of({
      answerId: this.id,
      answeredAt: this.answeredAt,
      attempt: this.job.attempts,
    });
  }

  get hasPendingJob(): boolean {
    return this.grading === 'pending';
  }

  get jobExhausted(): boolean {
    return this.job.exhausted;
  }

  leaseJob(now: Date): QuestionAnswer {
    if (!this.hasPendingJob) {
      throw new InvalidAnswerError('has no grade to wait for');
    }
    if (!this.job.isDue(now) || this.job.exhausted) {
      throw new InvalidAnswerError('cannot be graded again yet');
    }

    return this.with({ job: this.job.lease(now) });
  }

  scheduleRetry(now: Date): QuestionAnswer {
    if (!this.hasPendingJob) {
      return this;
    }

    return this.job.exhausted
      ? this.deadLetter()
      : this.with({ job: this.job.scheduleRetry(now) });
  }

  waitJob(now: Date): QuestionAnswer {
    return this.hasPendingJob ? this.with({ job: this.job.wait(now) }) : this;
  }

  deadLetter(): QuestionAnswer {
    return this.ungraded();
  }

  /**
   * Looks again now at the session grading the reply, because that session settled. A round of another answer or of an
   * earlier reply wakes nothing; a job that does not wait stays as it is.
   */
  wake(round: GradingRound, now: Date): QuestionAnswer {
    if (!this.hasPendingJob || !round.gradesReplyOf(this.id, this.answeredAt)) {
      return this;
    }

    const job = this.job.wake(now);

    return job === this.job ? this : this.with({ job });
  }

  /**
   * Settles a grade that its session failed to give. A failure the same session would meet again leaves the answer
   * ungraded; any other failure grades it again later, until the attempts run out.
   */
  gradingFailed(failure: SessionFailure, now: Date): QuestionAnswer {
    return failure.lasting ? this.ungraded() : this.scheduleRetry(now);
  }

  graded(graded: GradedReply): QuestionAnswer {
    if (!this.hasPendingJob) {
      throw new InvalidAnswerError('has no grade to wait for');
    }

    return this.with({
      grading: 'graded',
      verdict: graded.grade.verdict,
      feedback: feedbackOf(graded.grade.feedback),
      usage: this.usage.with(graded.usage),
      job: PendingJob.fresh(),
    });
  }

  /** Gives up on the grade; the reviewer keeps the expected answer to compare with. */
  ungraded(): QuestionAnswer {
    return this.hasPendingJob
      ? this.with({ grading: 'failed', job: PendingJob.fresh() })
      : this;
  }

  private with(change: {
    asked?: string;
    expected?: string;
    reply?: string | null;
    grading?: AnswerGrading;
    verdict?: AnswerVerdict | null;
    feedback?: string | null;
    usage?: ModelUsage;
    job?: PendingJob;
    answeredAt?: Date;
  }): QuestionAnswer {
    const next = new QuestionAnswer(
      this.id,
      this.workspaceId,
      this.taskId,
      this.teamId,
      this.stackId,
      this.repository,
      this.questionId,
      this.personId,
      change.asked ?? this.asked,
      change.expected ?? this.expected,
      change.reply === undefined ? this.reply : change.reply,
      change.grading ?? this.grading,
      change.verdict === undefined ? this.verdict : change.verdict,
      change.feedback === undefined ? this.feedback : change.feedback,
      change.usage ?? this.usage,
      change.job ?? this.job,
      change.answeredAt ?? this.answeredAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
