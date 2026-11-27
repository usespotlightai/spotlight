import type { AnswerGraderPort } from '@change-review/application/ports/answer-grader.port';
import type {
  ChangeStack,
  CitedHunk,
} from '@change-review/domain/aggregates/change-stack.aggregate';
import type { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { QuestionAnswerVersionConflictError } from '@change-review/domain/exceptions/question-answer-version-conflict.error';
import { UnknownQuestionError } from '@change-review/domain/exceptions/unknown-question.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import { sessionRunFor } from '@change-review/domain/services/session-run';
import { answersQuestion } from '@change-review/domain/services/shown-answer';
import type { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';

const MAX_GRADES_AT_ONCE = 4;

const citedFor = (stack: ChangeStack, answer: QuestionAnswer): CitedHunk[] => {
  try {
    const question = stack.question(answer.questionId);

    return answersQuestion(answer, question) ? stack.citedBy(question) : [];
  } catch (error) {
    if (error instanceof UnknownQuestionError) {
      return [];
    }
    throw error;
  }
};

/** Grades answers in words after they are saved, one assist session per reply. */
export class WorkAnswerGrades implements PendingJobsPort {
  readonly name = 'Grading answers to change stack questions';

  readonly #loop: JobLoop<QuestionAnswer, QuestionAnswerId>;

  constructor(
    private readonly answers: QuestionAnswerRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly grader: AnswerGraderPort,
    transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<QuestionAnswer, QuestionAnswerId>(
      {
        name: this.name,
        batchSize: MAX_GRADES_AT_ONCE,
        due: (now) => this.answers.nextDueGrading(now),
        find: (id) => this.answers.find(id),
        save: (answer) => this.answers.save(answer),
        keyOf: (answer) => answer.id,
        ids: (answer) => ({
          workspaceId: answer.workspaceId.value,
          taskId: answer.taskId?.value,
        }),
        about: (answer) => ({
          questionAnswerId: answer.id.value,
          changeStackId: answer.stackId.value,
          attempts: answer.job.attempts,
        }),
        process: (answer) => this.graded(answer),
        stale: (error) => error instanceof QuestionAnswerVersionConflictError,
      },
      transaction,
      clock,
      logger,
      reports,
      telemetry,
    );
  }

  processDue(): Promise<void> {
    return this.#loop.processDue();
  }

  idle(): Promise<void> {
    return this.#loop.idle();
  }

  private async graded(answer: QuestionAnswer): Promise<QuestionAnswer> {
    const stack = await this.stacks.find(answer.stackId);
    const basis =
      stack &&
      sessionRunFor(
        stack,
        stack.taskId ? await this.stacks.ofTask(stack.taskId) : [],
      );

    if (!stack || !basis || answer.reply === null || answer.reply === '') {
      this.logger.warn(
        {
          questionAnswerId: answer.id.value,
          changeStackId: answer.stackId.value,
        },
        'No run can host the session grading the answer, so it stays ungraded',
      );
      return answer.ungraded();
    }

    const graded = await this.grader.grade({
      workspaceId: answer.workspaceId.value,
      round: answer.gradingRound,
      basedOnRun: basis,
      question: answer.asked,
      expected: answer.expected,
      reply: answer.reply,
      cited: citedFor(stack, answer),
    });

    if (graded.status === 'waiting') {
      return answer.waitJob(this.clock.now());
    }
    if (graded.status === 'graded') {
      return answer.graded(graded);
    }

    this.logger.warn(
      { questionAnswerId: answer.id.value, failure: graded.failure.reason },
      'The session grading an answer gave no grade',
    );

    return answer.gradingFailed(graded.failure, this.clock.now());
  }
}
