import type {
  ChangeStackDto,
  CheckedStepDto,
  QuestionAnswerDto,
  StackCheckDto,
  StackCohortDto,
} from '@change-review/application/dto/change-stack.dto';
import type {
  ChangeStackReaderPort,
  ChangeStackSummary,
} from '@change-review/application/ports/change-stack-reader.port';
import { answersQuestion } from '@change-review/domain/aggregates/question-answer.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { tallyOf } from '@change-review/domain/value-objects/diff.vo';
import type { CheckedStep } from '@change-review/domain/value-objects/stack-check.vo';
import { diffOf } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.mapping';
import { toStackCheck } from '@change-review/infrastructure/persistence/drizzle/repositories/stack-check.repository';
import type { StoredCohort } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.rows';
import { changeStack } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.schema';
import { questionAnswer } from '@change-review/infrastructure/persistence/drizzle/schemas/question-answer.schema';
import { stackCheck } from '@change-review/infrastructure/persistence/drizzle/schemas/stack-check.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';

const PROGRESS = {
  state: changeStack.state,
  failure: changeStack.failure,
  startedAt: changeStack.startedAt,
  completedAt: changeStack.completedAt,
};

const stepOf = (step: CheckedStep): CheckedStepDto => ({
  step: step.step,
  passed: step.passed,
  output: step.output,
  durationMs: step.durationMs,
});

const checkOf = (check: StackCheck | null, now: Date): StackCheckDto | null => {
  if (!check) {
    return null;
  }

  const skip = check.skippedAt(now);

  return {
    command: check.request.command,
    status: check.statusAt(now),
    skip: skip && { code: skip.code, detail: skip.detail },
    wholeFailed: check.wholeFailed,
    whole: check.outcome?.whole ? stepOf(check.outcome.whole) : null,
    layers: check.outcome?.layers.map(stepOf) ?? [],
  };
};

type AnswerRow = Pick<
  typeof questionAnswer.$inferSelect,
  | 'stackId'
  | 'questionId'
  | 'asked'
  | 'reply'
  | 'verdict'
  | 'feedback'
  | 'expected'
>;

const cohortDtosOf = (
  cohorts: readonly StoredCohort[],
  answered: (questionId: string, asked: string) => QuestionAnswerDto | null,
): StackCohortDto[] =>
  cohorts.map((cohort) => ({
    ...cohort,
    layers: cohort.layers.map(({ questions, ...layer }) => ({
      ...layer,
      questions: (questions ?? []).map((each) => ({
        id: each.id,
        question: each.question,
        hunks: each.hunks,
        answered: answered(each.id, each.question),
      })),
    })),
  }));

const answeredFrom =
  (rows: readonly AnswerRow[], stackId: string) =>
  (questionId: string, asked: string): QuestionAnswerDto | null => {
    const row = rows.find(
      (each) =>
        each.stackId === stackId &&
        answersQuestion(each, { id: questionId, question: asked }),
    );

    return row
      ? {
          questionId: row.questionId,
          reply: row.reply,
          verdict: row.verdict,
          feedback: row.feedback,
          expected: row.expected,
        }
      : null;
  };

@Injectable()
export class DrizzleChangeStackReader implements ChangeStackReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async latestForTask(
    taskId: TaskId,
    now: Date,
  ): Promise<ChangeStackSummary | null> {
    const [row] = await this.context.db
      .select({
        id: changeStack.id,
        runId: changeStack.runId,
        repository: changeStack.repository,
        cohorts: changeStack.cohorts,
        files: changeStack.files,
        ...PROGRESS,
      })
      .from(changeStack)
      .where(
        and(
          eq(changeStack.taskId, taskId.value),
          ne(changeStack.state, 'failed'),
        ),
      )
      .orderBy(desc(changeStack.startedAt))
      .limit(1);

    if (!row) {
      return null;
    }

    const tally = tallyOf(diffOf(row.files).files);

    return {
      id: row.id,
      runId: row.runId,
      repository: row.repository,
      state: row.state,
      cohorts: row.cohorts.map((cohort) => ({
        ...cohort,
        layers: cohort.layers.map(({ questions: _, ...layer }) => layer),
      })),
      check: checkOf(StackCheck.latestOf(await this.checksOf([row.id])), now),
      added: tally.added,
      removed: tally.removed,
    };
  }

  async ofRun(
    runId: RunId,
    viewerId: UserId,
    now: Date,
  ): Promise<ChangeStackDto[]> {
    const rows = await this.context.db
      .select({
        id: changeStack.id,
        repository: changeStack.repository,
        files: changeStack.files,
        cohorts: changeStack.cohorts,
        ...PROGRESS,
      })
      .from(changeStack)
      .where(eq(changeStack.runId, runId.value))
      .orderBy(asc(changeStack.startedAt));

    const answers =
      rows.length > 0
        ? await this.context.db
            .select({
              stackId: questionAnswer.stackId,
              questionId: questionAnswer.questionId,
              asked: questionAnswer.asked,
              reply: questionAnswer.reply,
              verdict: questionAnswer.verdict,
              feedback: questionAnswer.feedback,
              expected: questionAnswer.expected,
            })
            .from(questionAnswer)
            .where(
              and(
                inArray(
                  questionAnswer.stackId,
                  rows.map((row) => row.id),
                ),
                eq(questionAnswer.personId, viewerId.value),
              ),
            )
        : [];

    const checks = await this.checksOf(rows.map((row) => row.id));

    return rows.map((row) => ({
      id: row.id,
      repository: row.repository,
      state: row.state,
      failure: row.failure,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      files: row.files,
      cohorts: cohortDtosOf(row.cohorts, answeredFrom(answers, row.id)),
      check: checkOf(
        StackCheck.latestOf(
          checks.filter((each) => each.stackId.value === row.id),
        ),
        now,
      ),
    }));
  }

  async answerOf(
    runId: RunId,
    stackId: string,
    questionId: string,
    viewerId: UserId,
  ): Promise<QuestionAnswerDto | null> {
    const [row] = await this.context.db
      .select({
        questionId: questionAnswer.questionId,
        reply: questionAnswer.reply,
        verdict: questionAnswer.verdict,
        feedback: questionAnswer.feedback,
        expected: questionAnswer.expected,
      })
      .from(questionAnswer)
      .innerJoin(changeStack, eq(changeStack.id, questionAnswer.stackId))
      .where(
        and(
          eq(changeStack.runId, runId.value),
          eq(questionAnswer.stackId, stackId),
          eq(questionAnswer.questionId, questionId),
          eq(questionAnswer.personId, viewerId.value),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  private async checksOf(
    stackIds: readonly string[],
  ): Promise<readonly StackCheck[]> {
    if (stackIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(inArray(stackCheck.stackId, [...stackIds]));

    return rows.map(toStackCheck);
  }
}
