import type { SessionWaiting } from '@change-review/application/ports/session-waiting';
import type { CitedHunk } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { AnswerGrade } from '@change-review/domain/aggregates/question-answer.aggregate';
import type { GradingRound } from '@change-review/domain/value-objects/grading-round.vo';
import type { SessionFailure } from '@change-review/domain/value-objects/session-failure.vo';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const ANSWER_GRADER = Symbol('ANSWER_GRADER');

export interface GradingRequest {
  readonly workspaceId: string;
  /** Which session grades it: the same round reports on that session, a new round grades the answer again. */
  readonly round: GradingRound;
  /** The run whose harness, model and working copy the session takes. */
  readonly basedOnRun: RunId;
  readonly question: string;
  readonly expected: string;
  readonly reply: string;
  readonly cited: readonly CitedHunk[];
}

export type GradedAnswer =
  | {
      readonly status: 'graded';
      readonly grade: AnswerGrade;
      readonly usage: ModelCall | null;
    }
  | { readonly status: 'failed'; readonly failure: SessionFailure }
  | SessionWaiting;

export interface AnswerGraderPort {
  /** Grades the answer in an assist session; answers waiting while the session runs. */
  grade(request: GradingRequest): Promise<GradedAnswer>;
}
