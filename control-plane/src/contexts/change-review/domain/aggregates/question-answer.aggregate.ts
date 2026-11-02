import { InvalidAnswerError } from '@change-review/domain/exceptions/invalid-answer.error';
import { QuestionAlreadyAnsweredError } from '@change-review/domain/exceptions/question-already-answered.error';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import type { LayerQuestion } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { QuestionId } from '@change-review/domain/value-objects/stack-ids';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import {
  type ModelCall,
  ModelUsage,
} from '@shared-kernel/domain/value-objects/model-usage.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const ANSWER_VERDICTS = ['right', 'partly-right', 'missed'] as const;

export type AnswerVerdict = (typeof ANSWER_VERDICTS)[number];

export interface AnswerGrade {
  readonly verdict: AnswerVerdict;
  readonly feedback: string;
}

export interface GradedReply {
  readonly grade: AnswerGrade;
  readonly usage: ModelCall | null;
}

export const MAX_REPLY = 4_000;

export const MAX_FEEDBACK = 2_000;

const replyOf = (raw: string | null): string | null => {
  const reply = raw?.trim() || null;

  if (reply && reply.length > MAX_REPLY) {
    throw new InvalidAnswerError(`must be at most ${MAX_REPLY} characters`);
  }

  return reply;
};

const gradedReply = (raw: string | null, graded: GradedReply | null) => {
  const reply = replyOf(raw);

  if (reply && !graded) {
    throw new InvalidAnswerError('in words needs a grade');
  }
  if (!reply && graded) {
    throw new InvalidAnswerError('without words has no grade');
  }

  const feedback = graded?.grade.feedback.trim() || null;

  if (feedback && feedback.length > MAX_FEEDBACK) {
    throw new InvalidAnswerError(
      `needs feedback of at most ${MAX_FEEDBACK} characters`,
    );
  }

  return {
    reply,
    verdict: graded?.grade.verdict ?? ('missed' as const),
    feedback,
  };
};

export class QuestionAnswer extends EventRecorder {
  private constructor(
    readonly id: QuestionAnswerId,
    readonly workspaceId: WorkspaceId,
    readonly stackId: ChangeStackId,
    readonly questionId: QuestionId,
    readonly personId: UserId,
    readonly asked: string,
    readonly expected: string,
    readonly reply: string | null,
    readonly verdict: AnswerVerdict,
    readonly feedback: string | null,
    readonly usage: ModelUsage,
    readonly answeredAt: Date,
    readonly version: number,
  ) {
    super();
  }

  static replyOf(raw: string | null): string | null {
    return replyOf(raw);
  }

  static given(input: {
    id: QuestionAnswerId;
    workspaceId: WorkspaceId;
    stackId: ChangeStackId;
    question: LayerQuestion;
    personId: UserId;
    reply: string | null;
    graded: GradedReply | null;
    now: Date;
  }): QuestionAnswer {
    const { reply, verdict, feedback } = gradedReply(input.reply, input.graded);

    return new QuestionAnswer(
      input.id,
      input.workspaceId,
      input.stackId,
      input.question.id,
      input.personId,
      input.question.question,
      input.question.answer,
      reply,
      verdict,
      feedback,
      ModelUsage.none().with(input.graded?.usage ?? null),
      input.now,
      0,
    );
  }

  static rehydrate(input: {
    id: QuestionAnswerId;
    workspaceId: WorkspaceId;
    stackId: ChangeStackId;
    questionId: QuestionId;
    personId: UserId;
    asked: string;
    expected: string;
    reply: string | null;
    verdict: AnswerVerdict;
    feedback: string | null;
    usage: ModelUsage;
    answeredAt: Date;
    version: number;
  }): QuestionAnswer {
    if (input.reply === null && input.verdict !== 'missed') {
      throw new InconsistentStateError(
        'question answer',
        'has no words, yet is not missed',
      );
    }

    return new QuestionAnswer(
      input.id,
      input.workspaceId,
      input.stackId,
      input.questionId,
      input.personId,
      input.asked,
      input.expected,
      input.reply,
      input.verdict,
      input.feedback,
      input.usage,
      input.answeredAt,
      input.version,
    );
  }

  answers(question: LayerQuestion): boolean {
    return question.id === this.questionId && question.question === this.asked;
  }

  refuseIfAnswered(question: LayerQuestion): void {
    if (this.answers(question)) {
      throw new QuestionAlreadyAnsweredError();
    }
  }

  answeredAgain(input: {
    question: LayerQuestion;
    reply: string | null;
    graded: GradedReply | null;
    now: Date;
  }): QuestionAnswer {
    if (input.question.id !== this.questionId) {
      throw new InvalidAnswerError('can only answer its own question again');
    }
    this.refuseIfAnswered(input.question);

    const { reply, verdict, feedback } = gradedReply(input.reply, input.graded);

    return new QuestionAnswer(
      this.id,
      this.workspaceId,
      this.stackId,
      this.questionId,
      this.personId,
      input.question.question,
      input.question.answer,
      reply,
      verdict,
      feedback,
      this.usage.with(input.graded?.usage ?? null),
      input.now,
      this.version,
    );
  }
}
