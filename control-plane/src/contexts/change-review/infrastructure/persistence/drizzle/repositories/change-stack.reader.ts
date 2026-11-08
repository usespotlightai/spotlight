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
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import {
  type AnswerScope,
  type GivenAnswer,
  shownAnswerFor,
} from '@change-review/domain/services/shown-answer';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { tallyOf } from '@change-review/domain/value-objects/diff.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type { CheckedStep } from '@change-review/domain/value-objects/stack-check.vo';
import type { QuestionId } from '@change-review/domain/value-objects/stack-ids';
import { isShownForTask } from '@change-review/domain/value-objects/stack-progress.vo';
import { diffOf } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.mapping';
import { toStackCheck } from '@change-review/infrastructure/persistence/drizzle/repositories/stack-check.repository';
import type { StoredCohort } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.rows';
import { changeStack } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.schema';
import { questionAnswer } from '@change-review/infrastructure/persistence/drizzle/schemas/question-answer.schema';
import { stackCheck } from '@change-review/infrastructure/persistence/drizzle/schemas/stack-check.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';

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
    skip: skip && {
      code: skip.code,
      detail: skip.detail,
      attempts: skip.attempts ?? null,
    },
    wholeFailed: check.wholeFailed,
    whole: check.outcome?.whole ? stepOf(check.outcome.whole) : null,
    layers: check.outcome?.layers.map(stepOf) ?? [],
  };
};

const ANSWER = {
  id: questionAnswer.id,
  stackId: questionAnswer.stackId,
  taskId: questionAnswer.taskId,
  repository: questionAnswer.repository,
  asked: questionAnswer.asked,
  expected: questionAnswer.expected,
  reply: questionAnswer.reply,
  verdict: questionAnswer.verdict,
  feedback: questionAnswer.feedback,
  answeredAt: questionAnswer.answeredAt,
};

type AnswerRow = {
  [K in keyof typeof ANSWER]: (typeof questionAnswer.$inferSelect)[K];
};

interface StackScope {
  readonly id: string;
  readonly taskId: string | null;
  readonly repository: string | null;
}

type StoredLayer = StoredCohort['layers'][number];

const outlinedLayerOf = (layer: StoredLayer) => ({
  id: layer.id,
  title: layer.title,
  summary: layer.summary,
  dependsOn: layer.dependsOn.map((each) => ({
    layer: each.layer,
    because: each.because,
  })),
  hunks: layer.hunks.map((each) => ({ hunk: each.hunk })),
  notes: layer.notes.map((each) => ({ path: each.path, note: each.note })),
});

const outlinedCohortOf = <L>(
  cohort: StoredCohort,
  layerOf: (layer: StoredLayer) => L,
) => ({
  id: cohort.id,
  kind: cohort.kind,
  title: cohort.title,
  intent: cohort.intent,
  layers: cohort.layers.map(layerOf),
});

type StoredQuestion = NonNullable<StoredLayer['questions']>[number];

const cohortDtosOf = (
  cohorts: readonly StoredCohort[],
  answered: (question: StoredQuestion) => QuestionAnswerDto | null,
): StackCohortDto[] =>
  cohorts.map((cohort) =>
    outlinedCohortOf(cohort, (layer) => ({
      ...outlinedLayerOf(layer),
      questions: (layer.questions ?? []).map((each) => ({
        id: each.id,
        question: each.question,
        hunks: each.hunks,
        answered: answered(each),
      })),
      revision: layer.revision
        ? {
            status: layer.revision.status,
            previous: layer.revision.previous ?? null,
          }
        : null,
    })),
  );

const scopeOf = (stack: StackScope): AnswerScope => ({
  stackId: ChangeStackId.of(stack.id),
  taskId: stack.taskId ? TaskId.of(stack.taskId) : null,
  repository: stack.repository ? RepositoryName.of(stack.repository) : null,
});

const givenOf = (row: AnswerRow): GivenAnswer => ({
  ...scopeOf({
    id: row.stackId,
    taskId: row.taskId,
    repository: row.repository,
  }),
  id: QuestionAnswerId.of(row.id),
  asked: row.asked,
  expected: row.expected,
  reply: row.reply,
  verdict: row.verdict,
  feedback: row.feedback,
  answeredAt: row.answeredAt,
});

const answeredFrom =
  (rows: readonly AnswerRow[], stack: StackScope) =>
  (question: StoredQuestion): QuestionAnswerDto | null => {
    const shown = shownAnswerFor(question, scopeOf(stack), rows.map(givenOf));

    return shown && { questionId: question.id, ...shown };
  };

const inScopeOf = (stacks: readonly StackScope[]) => {
  const tasks = [
    ...new Set(stacks.flatMap((stack) => (stack.taskId ? [stack.taskId] : []))),
  ];

  return or(
    inArray(
      questionAnswer.stackId,
      stacks.map((stack) => stack.id),
    ),
    tasks.length > 0 ? inArray(questionAnswer.taskId, tasks) : undefined,
  );
};

@Injectable()
export class DrizzleChangeStackReader implements ChangeStackReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async latestForTask(
    taskId: TaskId,
    now: Date,
  ): Promise<ChangeStackSummary | null> {
    const rows = await this.context.db
      .select({
        id: changeStack.id,
        runId: changeStack.runId,
        repository: changeStack.repository,
        cohorts: changeStack.cohorts,
        files: changeStack.files,
        ...PROGRESS,
      })
      .from(changeStack)
      .where(eq(changeStack.taskId, taskId.value))
      .orderBy(desc(changeStack.startedAt));
    const row = rows.find((each) => isShownForTask(each.state));

    if (!row) {
      return null;
    }

    const tally = tallyOf(diffOf(row.files).files);

    return {
      id: row.id,
      runId: RunId.of(row.runId),
      repository: row.repository,
      state: row.state,
      cohorts: row.cohorts.map((cohort) =>
        outlinedCohortOf(cohort, outlinedLayerOf),
      ),
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
        taskId: changeStack.taskId,
        repository: changeStack.repository,
        files: changeStack.files,
        cohorts: changeStack.cohorts,
        removedLayers: changeStack.removedLayers,
        ...PROGRESS,
      })
      .from(changeStack)
      .where(eq(changeStack.runId, runId.value))
      .orderBy(asc(changeStack.startedAt));

    const answers =
      rows.length > 0
        ? await this.context.db
            .select(ANSWER)
            .from(questionAnswer)
            .where(
              and(inScopeOf(rows), eq(questionAnswer.personId, viewerId.value)),
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
      cohorts: cohortDtosOf(row.cohorts, answeredFrom(answers, row)),
      removed: row.removedLayers.map((each) => ({
        previous: each.previous,
        cohort: each.cohort,
        title: each.title,
      })),
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
    stackId: ChangeStackId,
    questionId: QuestionId,
    viewerId: UserId,
  ): Promise<QuestionAnswerDto | null> {
    const [stack] = await this.context.db
      .select({
        id: changeStack.id,
        taskId: changeStack.taskId,
        repository: changeStack.repository,
        cohorts: changeStack.cohorts,
      })
      .from(changeStack)
      .where(
        and(
          eq(changeStack.id, stackId.value),
          eq(changeStack.runId, runId.value),
        ),
      )
      .limit(1);
    const question = stack?.cohorts
      .flatMap((cohort) => cohort.layers)
      .flatMap((layer) => layer.questions ?? [])
      .find((each) => each.id === questionId);

    if (!stack || !question) {
      return null;
    }

    const answers = await this.context.db
      .select(ANSWER)
      .from(questionAnswer)
      .where(
        and(inScopeOf([stack]), eq(questionAnswer.personId, viewerId.value)),
      );

    return answeredFrom(answers, stack)(question);
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
