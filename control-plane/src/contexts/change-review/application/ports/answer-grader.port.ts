import type { CitedHunk } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { AnswerGrade } from '@change-review/domain/aggregates/question-answer.aggregate';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export const ANSWER_GRADER = Symbol('ANSWER_GRADER');

export interface GradingRequest {
  readonly workspaceId: string;
  readonly question: string;
  readonly expected: string;
  readonly reply: string;
  readonly cited: readonly CitedHunk[];
}

export interface GradedAnswer {
  readonly grade: AnswerGrade;
  readonly usage: ModelCall | null;
}

export interface AnswerGraderPort {
  availableTo(workspaceId: string): Promise<boolean>;

  grade(request: GradingRequest): Promise<GradedAnswer>;
}
