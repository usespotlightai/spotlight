import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangedSinceReadError } from '@change-review/domain/exceptions/changed-since-read.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import { BaseCommit } from '@change-review/domain/value-objects/base-commit.vo';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { OwedWork } from '@change-review/domain/value-objects/owed-work.vo';
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
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';

type Row = typeof changeStack.$inferSelect;

const toChangeStack = (row: Row): ChangeStack =>
  ChangeStack.rehydrate({
    id: ChangeStackId.of(row.id),
    runId: RunId.of(row.runId),
    taskId: row.taskId ? TaskId.of(row.taskId) : null,
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
          RunnerPlacement.ofClauses(row.checkPlacement),
        )
      : null,
    reordering: row.reordering,
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
    await this.context.run(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: ChangeStack): Promise<void> {
    await this.context.db.insert(changeStack).values({
      id: added.id.value,
      runId: added.runId.value,
      taskId: added.taskId?.value ?? null,
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
      reordering: added.reordering,
      version: added.version,
    });
  }

  async save(saved: ChangeStack): Promise<void> {
    await this.context.run(async () => {
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
      })
      .where(
        and(
          eq(changeStack.id, saved.id.value),
          eq(changeStack.version, saved.version),
        ),
      )
      .returning({ id: changeStack.id });

    if (written.length === 0) {
      throw new ChangedSinceReadError('change stack', saved.id.value);
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
