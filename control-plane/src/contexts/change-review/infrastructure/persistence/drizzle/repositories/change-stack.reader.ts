import type {
  ChangeStackDto,
  StackCheckDto,
} from '@change-review/application/dto/change-stack.dto';
import type {
  ChangeStackReaderPort,
  ChangeStackSummary,
  RunStackChecks,
} from '@change-review/application/ports/change-stack-reader.port';
import { checkStepsOf } from '@change-review/domain/services/check-steps';
import { Diff, tallyOf } from '@change-review/domain/value-objects/diff.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import type { StackProgress } from '@change-review/domain/value-objects/stack-progress.vo';
import { progressOf } from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.repository';
import { changeStack } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { and, asc, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm';

const PROGRESS = {
  state: changeStack.state,
  failure: changeStack.failure,
  draftedAt: changeStack.draftedAt,
  settledAt: changeStack.settledAt,
  check: changeStack.check,
};

const checkOf = (progress: StackProgress, now: Date): StackCheckDto | null => {
  const state = progress.checkStateAt(now);

  return state && progress.check
    ? {
        command: progress.check.command,
        state,
        reason: progress.checkReasonAt(now),
        whole: progress.check.outcome?.whole ?? null,
        layers: progress.check.outcome?.layers ?? [],
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
      .orderBy(desc(changeStack.draftedAt))
      .limit(1);

    if (!row) {
      return null;
    }

    const tally = tallyOf(row.files);

    return {
      id: row.id,
      runId: row.runId,
      repository: row.repository,
      state: row.state,
      cohorts: row.cohorts,
      check: checkOf(progressOf(row), now),
      added: tally.added,
      removed: tally.removed,
    };
  }

  async ofRun(runId: RunId, now: Date): Promise<ChangeStackDto[]> {
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
      .orderBy(asc(changeStack.draftedAt));

    return rows.map((row) => ({
      id: row.id,
      repository: row.repository,
      state: row.state,
      failure: row.failure,
      draftedAt: row.draftedAt.toISOString(),
      settledAt: row.settledAt?.toISOString() ?? null,
      files: row.files,
      cohorts: row.cohorts,
      check: checkOf(progressOf(row), now),
    }));
  }

  async checksOfRun(runId: RunId, now: Date): Promise<RunStackChecks> {
    const rows = await this.context.db
      .select({ id: changeStack.id, ...PROGRESS })
      .from(changeStack)
      .where(
        and(eq(changeStack.runId, runId.value), isNotNull(changeStack.check)),
      )
      .orderBy(asc(changeStack.draftedAt));
    const progress = rows.map((row) => ({ id: row.id, of: progressOf(row) }));
    const pending = progress
      .filter(
        (each) =>
          each.of.checkStateAt(now) === 'waiting' && !each.of.check?.reordering,
      )
      .map((each) => each.id);

    const plans =
      pending.length === 0
        ? []
        : await this.context.db
            .select({
              id: changeStack.id,
              repository: changeStack.repository,
              files: changeStack.files,
              cohorts: changeStack.cohorts,
              facts: changeStack.facts,
              check: changeStack.check,
            })
            .from(changeStack)
            .where(inArray(changeStack.id, pending))
            .orderBy(asc(changeStack.draftedAt));

    return {
      waiting: progress.some(
        (each) =>
          each.of.state === 'drafting' ||
          (each.of.check?.reordering === true &&
            each.of.checkStateAt(now) === 'waiting'),
      ),
      checks: plans.map((plan) => ({
        stackId: plan.id,
        repository: plan.repository,
        command: plan.check?.command ?? '',
        files: plan.files,
        steps: checkStepsOf({
          hunks: Diff.rehydrate(plan.files).hunks.map((hunk) => hunk.id),
          facts: StackFacts.of(plan.facts),
          cohorts: plan.cohorts,
          entries: plan.check?.entries ?? [],
        }),
      })),
    };
  }
}
