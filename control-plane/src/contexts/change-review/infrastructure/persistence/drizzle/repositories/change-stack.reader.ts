import type {
  ChangeStackDto,
  QuestionAnswerDto,
  StackCheckDto,
  StackCohortDto,
} from '@change-review/application/dto/change-stack.dto';
import type {
  ChangeStackReaderPort,
  ChangeStackSummary,
} from '@change-review/application/ports/change-stack-reader.port';
import { answersQuestion } from '@change-review/domain/aggregates/question-answer.aggregate';
import { tallyOf } from '@change-review/domain/value-objects/diff.vo';
import {
  checkStatusAt,
  parseStoredSkip,
  queueTimeout,
} from '@change-review/domain/value-objects/stack-check.vo';
import {
  checkedStepOf,
  diffOf,
} from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.mapping';
import type { StoredCohort } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.rows';
import { changeStack } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.schema';
import { questionAnswer } from '@change-review/infrastructure/persistence/drizzle/schemas/question-answer.schema';
import { stackCheck } from '@change-review/infrastructure/persistence/drizzle/schemas/stack-check.schema';
import { checkReasonOf } from '@change-review/infrastructure/rendering/check-reason';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const PROGRESS = {
  state: changeStack.state,
  failure: changeStack.failure,
  startedAt: changeStack.startedAt,
  completedAt: changeStack.completedAt,
};

const firstCheck = alias(stackCheck, 'first_check');

const recheck = alias(stackCheck, 'recheck');

const checkColumns = (table: typeof firstCheck | typeof recheck) => ({
  command: table.command,
  status: table.status,
  outcome: table.outcome,
  waitingSince: table.waitingSince,
  leaseExpiresAt: table.leaseExpiresAt,
  claimedAt: table.claimedAt,
});

const CHECKS = {
  firstCheck: checkColumns(firstCheck),
  recheck: checkColumns(recheck),
};

type CheckColumns = ReturnType<typeof checkColumns>;

type CheckRow = {
  [K in keyof CheckColumns]: CheckColumns[K]['_']['data'] | null;
};

const latestCheckOf = (row: {
  readonly firstCheck: CheckRow | null;
  readonly recheck: CheckRow | null;
}): CheckRow | null => (row.recheck?.command ? row.recheck : row.firstCheck);

const checkOf = (row: CheckRow | null, now: Date): StackCheckDto | null => {
  if (!row?.command || !row.status || !row.waitingSince) {
    return null;
  }

  const status = checkStatusAt(
    {
      status: row.status,
      waitingSince: row.waitingSince,
      lease: { leaseExpiresAt: row.leaseExpiresAt, claimedAt: row.claimedAt },
    },
    now,
  );

  const skipped =
    status === 'skipped'
      ? row.outcome?.skip
        ? parseStoredSkip(row.outcome.skip.code, row.outcome.skip.detail)
        : queueTimeout()
      : null;

  return {
    command: row.command,
    status,
    reason: checkReasonOf({
      skipped,
      wholeFailed:
        row.outcome?.status === 'checked' &&
        row.outcome.whole?.passed === false,
    }),
    whole: row.outcome?.whole ? checkedStepOf(row.outcome.whole) : null,
    layers: row.outcome?.layers.map(checkedStepOf) ?? [],
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
        ...CHECKS,
      })
      .from(changeStack)
      .leftJoin(
        firstCheck,
        and(
          eq(firstCheck.stackId, changeStack.id),
          eq(firstCheck.recheck, false),
        ),
      )
      .leftJoin(
        recheck,
        and(eq(recheck.stackId, changeStack.id), eq(recheck.recheck, true)),
      )
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
      check: checkOf(latestCheckOf(row), now),
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
        ...CHECKS,
      })
      .from(changeStack)
      .leftJoin(
        firstCheck,
        and(
          eq(firstCheck.stackId, changeStack.id),
          eq(firstCheck.recheck, false),
        ),
      )
      .leftJoin(
        recheck,
        and(eq(recheck.stackId, changeStack.id), eq(recheck.recheck, true)),
      )
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

    return rows.map((row) => ({
      id: row.id,
      repository: row.repository,
      state: row.state,
      failure: row.failure,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      files: row.files,
      cohorts: cohortDtosOf(row.cohorts, answeredFrom(answers, row.id)),
      check: checkOf(latestCheckOf(row), now),
    }));
  }
}
