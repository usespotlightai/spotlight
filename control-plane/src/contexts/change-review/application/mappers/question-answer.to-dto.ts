import type { QuestionAnswerDto } from '@change-review/application/dto/change-stack.dto';
import type { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';

export const questionAnswerDtoOf = (
  answer: QuestionAnswer,
): QuestionAnswerDto => ({
  questionId: answer.questionId,
  reply: answer.reply,
  verdict: answer.verdict,
  feedback: answer.feedback,
  expected: answer.expected,
});
