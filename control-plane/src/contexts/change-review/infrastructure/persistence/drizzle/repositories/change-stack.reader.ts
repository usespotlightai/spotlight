import type {
  ChangeStackDto,
  StackCheckDto,
} from '@change-review/application/dto/change-stack.dto';
import type {
  ChangeStackReaderPort,
  ChangeStackSummary,
} from '@change-review/application/ports/change-stack-reader.port';
import { checkReasonOf } from '@change-review/application/rendering/check-reason';
import { tallyOf } from '@change-review/domain/value-objects/diff.vo';
import {
  checkStateAt,
  keptSkipOf,
  nobodyChecked,
} from '@change-review/domain/value-objects/stack-check.vo';
import {
  checkedStepOf,
  diffOf,
} from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.mapping';
import { changeStack } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.schema';
import { stackCheck } from '@change-review/infrastructure/persistence/drizzle/schemas/stack-check.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { and, asc, desc, eq, ne } from 'drizzle-orm';

const PROGRESS = {
  state: changeStack.state,
  failure: changeStack.failure,
  draftedAt: changeStack.draftedAt,
  completedAt: changeStack.completedAt,
};

const CHECK = {
  command: stackCheck.command,
  phase: stackCheck.phase,
  outcome: stackCheck.outcome,
  waitingSince: stackCheck.waitingSince,
  leaseExpiresAt: stackCheck.leaseExpiresAt,
  claimedAt: stackCheck.claimedAt,
};

type CheckRow = {
  [K in keyof typeof CHECK]: (typeof CHECK)[K]['_']['data'] | null;
};

const checkOf = (row: CheckRow | null, now: Date): StackCheckDto | null => {
  if (!row?.command || !row.phase || !row.waitingSince) {
    return null;
  }

  const state = checkStateAt(
    {
      phase: row.phase,
      waitingSince: row.waitingSince,
      lease: { leaseExpiresAt: row.leaseExpiresAt, claimedAt: row.claimedAt },
    },
    now,
  );

  const skipped =
    state === 'skipped'
      ? row.outcome?.skip
        ? keptSkipOf(row.outcome.skip.code, row.outcome.skip.detail)
        : nobodyChecked()
      : null;

  return {
    command: row.command,
    state,
    reason: checkReasonOf({
      skipped,
      wholeFailed:
        row.outcome?.state === 'checked' && row.outcome.whole?.passed === false,
    }),
    whole: row.outcome?.whole ? checkedStepOf(row.outcome.whole) : null,
    layers: row.outcome?.layers.map(checkedStepOf) ?? [],
  };
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
        check: CHECK,
      })
      .from(changeStack)
      .leftJoin(stackCheck, eq(stackCheck.stackId, changeStack.id))
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

    const tally = tallyOf(diffOf(row.files).files);

    return {
      id: row.id,
      runId: row.runId,
      repository: row.repository,
      state: row.state,
      cohorts: row.cohorts,
      check: checkOf(row.check, now),
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
        check: CHECK,
      })
      .from(changeStack)
      .leftJoin(stackCheck, eq(stackCheck.stackId, changeStack.id))
      .where(eq(changeStack.runId, runId.value))
      .orderBy(asc(changeStack.draftedAt));

    return rows.map((row) => ({
      id: row.id,
      repository: row.repository,
      state: row.state,
      failure: row.failure,
      draftedAt: row.draftedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      files: row.files,
      cohorts: row.cohorts,
      check: checkOf(row.check, now),
    }));
  }
}
