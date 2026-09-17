import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangedSinceReadError } from '@change-review/domain/exceptions/changed-since-read.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { StackCheck } from '@change-review/domain/value-objects/stack-check.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { StackProgress } from '@change-review/domain/value-objects/stack-progress.vo';
import { StackWork } from '@change-review/domain/value-objects/stack-work.vo';
import {
  changeStack,
  type StoredStackCheck,
} from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';

type Row = typeof changeStack.$inferSelect;

export const checkOf = (stored: StoredStackCheck | null): StackCheck | null =>
  stored &&
  StackCheck.rehydrate({
    command: stored.command,
    phase: stored.phase,
    entries: stored.entries ?? [],
    rounds: stored.rounds ?? 0,
    outcome: stored.outcome && {
      ...stored.outcome,
      checkedAt: new Date(stored.outcome.checkedAt),
    },
  });

const storedCheck = (check: StackCheck | null): StoredStackCheck | null =>
  check && {
    command: check.command,
    phase: check.phase,
    entries: check.entries,
    rounds: check.rounds,
    outcome: check.outcome && {
      ...check.outcome,
      checkedAt: check.outcome.checkedAt.toISOString(),
    },
  };

export const progressOf = (
  row: Pick<Row, 'state' | 'failure' | 'draftedAt' | 'settledAt' | 'check'>,
): StackProgress =>
  StackProgress.rehydrate({
    state: row.state,
    failure: row.failure,
    draftedAt: row.draftedAt,
    settledAt: row.settledAt,
    check: checkOf(row.check),
  });

const toChangeStack = (row: Row): ChangeStack =>
  ChangeStack.rehydrate({
    id: ChangeStackId.of(row.id),
    runId: RunId.of(row.runId),
    taskId: row.taskId ? TaskId.of(row.taskId) : null,
    workspaceId: WorkspaceId.of(row.workspaceId),
    repository: row.repository,
    diff: Diff.rehydrate(row.files),
    facts: StackFacts.of(row.facts),
    cohorts: row.cohorts,
    progress: progressOf(row),
    work: StackWork.rehydrate({
      attempts: row.workAttempts,
      dueAt: row.workDueAt,
    }),
    version: row.version,
  });

const factsOf = (facts: StackFacts) => ({
  hunks: [...facts.hunks],
  links: [...facts.links],
  imports: [...facts.imports],
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
      repository: added.repository,
      state: added.state,
      files: [...added.diff.files],
      cohorts: [...added.cohorts],
      failure: added.failure,
      draftedAt: added.draftedAt,
      settledAt: added.settledAt,
      check: storedCheck(added.check),
      facts: factsOf(added.facts),
      workAttempts: added.work.attempts,
      workDueAt: added.work.dueAt,
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
        cohorts: [...saved.cohorts],
        failure: saved.failure,
        settledAt: saved.settledAt,
        check: storedCheck(saved.check),
        workAttempts: saved.work.attempts,
        workDueAt: saved.work.dueAt,
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
            sql`${changeStack.check}->>'phase' = 'reordering'`,
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
