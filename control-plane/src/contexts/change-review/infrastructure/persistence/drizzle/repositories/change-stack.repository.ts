import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackVersionConflictError } from '@change-review/domain/exceptions/change-stack-version-conflict.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import { BaseCommit } from '@change-review/domain/value-objects/base-commit.vo';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import {
  cohortRows,
  cohortsOf,
  diffOf,
  factRows,
  factsOf,
  fileRows,
  progressOf,
} from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.mapping';
import { changeStack } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { OwedWork } from '@shared-kernel/domain/value-objects/owed-work.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';

type Row = typeof changeStack.$inferSelect;

const usageRow = (spent: ModelUsage) => ({
  calls: spent.calls,
  inputTokens: spent.inputTokens,
  outputTokens: spent.outputTokens,
  costs: spent.costs.map((each) => ({ ...each })),
  unpriced: spent.unpriced,
});

const toChangeStack = (row: Row): ChangeStack =>
  ChangeStack.rehydrate({
    id: ChangeStackId.of(row.id),
    runId: RunId.of(row.runId),
    taskId: row.taskId ? TaskId.of(row.taskId) : null,
    replay: row.replay,
    workspaceId: WorkspaceId.of(row.workspaceId),
    repository: row.repository ? RepositoryName.of(row.repository) : null,
    base: row.baseCommit ? BaseCommit.of(row.baseCommit) : null,
    diff: diffOf(row.files),
    facts: factsOf(row.facts),
    cohorts: cohortsOf(row.cohorts),
    progress: progressOf(row),
    work: OwedWork.rehydrate({
      attempts: row.workAttempts,
      dueAt: row.workDueAt,
    }),
    request: row.checkCommand
      ? CheckRequest.of(
          row.checkCommand,
          row.checkSetup,
          RunnerPlacement.ofClauses(
            row.checkPlacement,
            row.checkPlacementImage
              ? RunnerImage.of(row.checkPlacementImage)
              : null,
          ),
        )
      : null,
    reordering: row.reordering,
    spent: ModelUsage.rehydrate(row.spent),
    version: row.version,
  });

@Injectable()
export class DrizzleChangeStackRepository implements ChangeStackRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: ChangeStack): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: ChangeStack): Promise<void> {
    await this.context.db.insert(changeStack).values({
      id: added.id.value,
      runId: added.runId.value,
      taskId: added.taskId?.value ?? null,
      replay: added.replay,
      workspaceId: added.workspaceId.value,
      repository: added.repository?.value ?? null,
      baseCommit: added.base?.value ?? null,
      state: added.state,
      files: fileRows(added.diff.files),
      cohorts: cohortRows(added.cohorts),
      failure: added.failure,
      draftedAt: added.draftedAt,
      settledAt: added.settledAt,
      facts: factRows(added.facts),
      workAttempts: added.work.attempts,
      workDueAt: added.work.dueAt,
      checkCommand: added.request?.command ?? null,
      checkSetup: added.request?.setup ?? null,
      checkPlacement: added.request?.placement.clauses ?? [],
      checkPlacementImage: added.request?.placement.image?.value ?? null,
      reordering: added.reordering,
      spent: usageRow(added.spent),
      version: added.version,
    });
  }

  async save(saved: ChangeStack): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async stored(saved: ChangeStack): Promise<void> {
    const written = await this.context.db
      .update(changeStack)
      .set({
        version: saved.version + 1,
        state: saved.state,
        cohorts: cohortRows(saved.cohorts),
        failure: saved.failure,
        settledAt: saved.settledAt,
        workAttempts: saved.work.attempts,
        workDueAt: saved.work.dueAt,
        reordering: saved.reordering,
        spent: usageRow(saved.spent),
      })
      .where(
        and(
          eq(changeStack.id, saved.id.value),
          eq(changeStack.version, saved.version),
        ),
      )
      .returning({ id: changeStack.id });

    if (written.length === 0) {
      throw new ChangeStackVersionConflictError(saved.id.value);
    }
  }

  async find(id: ChangeStackId): Promise<ChangeStack | null> {
    const [row] = await this.context.db
      .select()
      .from(changeStack)
      .where(eq(changeStack.id, id.value))
      .limit(1);

    return row ? toChangeStack(row) : null;
  }

  async ofRun(runId: RunId): Promise<readonly ChangeStack[]> {
    const rows = await this.context.db
      .select()
      .from(changeStack)
      .where(eq(changeStack.runId, runId.value))
      .orderBy(asc(changeStack.draftedAt), asc(changeStack.id));

    return rows.map(toChangeStack);
  }

  async dueForWork(now: Date): Promise<ChangeStack | null> {
    const [row] = await this.context.db
      .select()
      .from(changeStack)
      .where(
        and(
          or(
            eq(changeStack.state, 'drafting'),
            eq(changeStack.reordering, true),
          ),
          or(isNull(changeStack.workDueAt), lte(changeStack.workDueAt, now)),
        ),
      )
      .orderBy(asc(changeStack.draftedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toChangeStack(row) : null;
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(changeStack)
      .where(eq(changeStack.taskId, taskId.value));
  }
}
