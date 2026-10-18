import type {
  RunFactsDrift,
  RunFactsPort,
} from '@insights/application/ports/run-facts.port';
import {
  runFact,
  runRecord,
  taskHumanAction,
  taskPullRequest,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  and,
  asc,
  eq,
  getTableColumns,
  gt,
  gte,
  inArray,
  isNotNull,
  notExists,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

export type RunFactRefresh =
  | { readonly kind: 'runs'; readonly runIds: readonly string[] }
  | { readonly kind: 'tasks'; readonly taskIds: readonly string[] };

export type RunFactOwner =
  | {
      readonly kind: 'team';
      readonly workspaceId: string;
      readonly teamId: string;
    }
  | { readonly kind: 'workspace'; readonly workspaceId: string };

export type DeletedTasks =
  | { readonly kind: 'workspace'; readonly workspaceId: string }
  | {
      readonly kind: 'tasks';
      readonly workspaceId: string;
      readonly taskIds: readonly string[];
    };

type RunFactScope = RunFactRefresh | RunFactOwner;

interface ScopedColumns {
  readonly runId: PgColumn;
  readonly taskId: PgColumn;
  readonly workspaceId: PgColumn;
  readonly teamId: PgColumn;
}

const within = (columns: ScopedColumns, scope: RunFactScope): SQL => {
  switch (scope.kind) {
    case 'runs':
      return inArray(columns.runId, [...scope.runIds]);
    case 'tasks':
      return inArray(columns.taskId, [...scope.taskIds]);
    case 'team':
      return and(
        eq(columns.workspaceId, scope.workspaceId),
        eq(columns.teamId, scope.teamId),
      ) as SQL;
    case 'workspace':
      return eq(columns.workspaceId, scope.workspaceId);
  }
};

const isEmpty = (scope: RunFactRefresh): boolean =>
  scope.kind === 'runs'
    ? scope.runIds.length === 0
    : scope.taskIds.length === 0;

const nonNull = <T>(column: PgColumn): SQL<T> => sql<T>`${column}`;

const ended = and(
  isNotNull(runRecord.endedAt),
  isNotNull(runRecord.teamId),
  isNotNull(runRecord.lineId),
  isNotNull(runRecord.stationId),
  isNotNull(runRecord.taskId),
  isNotNull(runRecord.ending),
  isNotNull(runRecord.harness),
  isNotNull(runRecord.repositories),
  isNotNull(runRecord.skills),
  isNotNull(runRecord.visit),
) as SQL;

const replaced = Object.fromEntries(
  Object.entries(getTableColumns(runFact))
    .filter(([key]) => key !== 'runId')
    .map(([key, column]) => [key, sql.raw(`excluded."${column.name}"`)]),
);

const projected = (db: DrizzleDatabase, where: SQL) =>
  db
    .select({
      runId: runRecord.runId,
      workspaceId: runRecord.workspaceId,
      teamId: nonNull<string>(runRecord.teamId).as('team_id'),
      lineId: nonNull<string>(runRecord.lineId).as('line_id'),
      stationId: nonNull<string>(runRecord.stationId).as('station_id'),
      taskId: nonNull<string>(runRecord.taskId).as('task_id'),
      fingerprint: runRecord.fingerprint,
      harness: nonNull<string>(runRecord.harness).as('harness'),
      model: runRecord.model,
      effort: runRecord.effort,
      profileKey: runRecord.profileKey,
      repositories: nonNull<string[]>(runRecord.repositories).as(
        'repositories',
      ),
      skills: nonNull<string[]>(runRecord.skills).as('skills'),
      queuedAt: runRecord.queuedAt,
      startedAt: runRecord.startedAt,
      endedAt: nonNull<Date>(runRecord.endedAt).as('ended_at'),
      beganAt:
        sql<Date>`coalesce(${runRecord.startedAt}, ${runRecord.endedAt})`.as(
          'began_at',
        ),
      ending: sql<
        typeof runRecord.$inferSelect.ending & string
      >`${runRecord.ending}`.as('ending'),
      ran: sql<boolean>`${runRecord.ending} <> 'cancelled'`.as('ran'),
      failure: runRecord.failure,
      visit: nonNull<number>(runRecord.visit).as('visit'),
      asked: runRecord.asked,
      supersededAt: runRecord.supersededAt,
      checks: runRecord.checks,
      checkedAt: runRecord.checkedAt,
      firstHumanAction: runRecord.firstHumanAction,
      firstHumanActionAt: runRecord.firstHumanActionAt,
      approvalAnsweredAt: runRecord.approvalAnsweredAt,
      passedTo: runRecord.passedTo,
      passedAt: runRecord.passedAt,
      usageRecorded: runRecord.usageRecorded,
      ms: runRecord.ms,
      steps: runRecord.steps,
      errors: runRecord.errors,
      changedLines: runRecord.changedLines,
      contextTokens: runRecord.contextTokens,
      contextWindow: runRecord.contextWindow,
      cost: runRecord.cost,
      currency: runRecord.currency,
      inputTokens: runRecord.inputTokens,
      outputTokens: runRecord.outputTokens,
      cacheReadTokens: runRecord.cacheReadTokens,
      cacheWriteTokens: runRecord.cacheWriteTokens,
      tools: runRecord.tools,
      refusals: runRecord.refusals,
      memories: runRecord.memories,
      openedBy: taskHumanAction.openedBy,
      taskOpenedAt: sql<Date | null>`${taskHumanAction.openedAt}`.as(
        'task_opened_at',
      ),
      pullRequest: taskPullRequest.pullRequest,
      pullRequestState: taskPullRequest.state,
      pullRequestOpenedAt: sql<Date | null>`${taskPullRequest.openedAt}`.as(
        'pull_request_opened_at',
      ),
      pullRequestClosedAt: sql<Date | null>`${taskPullRequest.closedAt}`.as(
        'pull_request_closed_at',
      ),
    })
    .from(runRecord)
    .leftJoin(
      taskHumanAction,
      and(
        eq(taskHumanAction.taskId, runRecord.taskId),
        eq(taskHumanAction.workspaceId, runRecord.workspaceId),
      ),
    )
    .leftJoin(
      taskPullRequest,
      and(
        eq(taskPullRequest.taskId, runRecord.taskId),
        eq(taskPullRequest.workspaceId, runRecord.workspaceId),
      ),
    )
    .where(and(ended, where));

const AT_ONCE = 100;

const workspaceKey = (workspaceId: string): string =>
  `run-fact-workspace:${workspaceId}`;

@Injectable()
export class DrizzleRunFactProjection implements RunFactsPort {
  constructor(private readonly context: DrizzleContext) {}

  async refresh(scope: RunFactRefresh): Promise<void> {
    if (isEmpty(scope)) {
      return;
    }

    await this.context.inTransaction(async () => {
      await this.lockFactsOf(scope);
      await this.upsert(within(runRecord, scope));
      await this.dropStale(scope);
    });
  }

  async deleteRuns(owner: RunFactOwner): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.lock('exclusive', [workspaceKey(owner.workspaceId)]);
      await this.dropStale(owner);
    });
  }

  async deleteOpenings(deleted: DeletedTasks): Promise<void> {
    await this.deleteForTasks(deleted, {
      openedBy: null,
      taskOpenedAt: null,
    });
  }

  async deleteTaskPullRequests(deleted: DeletedTasks): Promise<void> {
    await this.deleteForTasks(deleted, {
      pullRequest: null,
      pullRequestState: null,
      pullRequestOpenedAt: null,
      pullRequestClosedAt: null,
    });
  }

  async rebuild(scope: RunFactOwner): Promise<number> {
    let after = '';
    let rebuilt = 0;

    for (;;) {
      const runIds = (
        await this.context.db
          .select({ runId: runRecord.runId })
          .from(runRecord)
          .where(and(within(runRecord, scope), gt(runRecord.runId, after)))
          .orderBy(asc(runRecord.runId))
          .limit(AT_ONCE)
      ).map((each) => each.runId);
      const last = runIds[runIds.length - 1];

      if (last === undefined) {
        break;
      }

      await this.refresh({ kind: 'runs', runIds });
      rebuilt += runIds.length;
      after = last;
    }

    await this.context.inTransaction(() => this.dropStale(scope));

    return rebuilt;
  }

  async repairEndedSince(since: Date): Promise<RunFactsDrift> {
    const recent = gte(runRecord.endedAt, since);
    const fresh = projected(this.context.db, recent);
    const stored = this.context.db
      .select()
      .from(runFact)
      .where(gte(runFact.endedAt, since));
    const differing = await this.context.db
      .select({ runId: sql<string>`differing.run_id` })
      .from(sql`(${fresh.except(stored)}) as differing`);
    const orphaned = await this.context.db
      .select({ runId: runFact.runId })
      .from(runFact)
      .where(
        and(
          gte(runFact.endedAt, since),
          notExists(
            this.context.db
              .select({ one: sql`1` })
              .from(runRecord)
              .where(and(eq(runRecord.runId, runFact.runId), ended)),
          ),
        ),
      );
    const repaired = [
      ...new Set([...differing, ...orphaned].map((each) => each.runId)),
    ];
    const [counted] = await this.context.db
      .select({ checked: sql<number>`count(*)::int` })
      .from(runRecord)
      .where(and(ended, recent));

    for (let at = 0; at < repaired.length; at += AT_ONCE) {
      await this.refresh({
        kind: 'runs',
        runIds: repaired.slice(at, at + AT_ONCE),
      });
    }

    return { checked: counted?.checked ?? 0, repaired };
  }

  private async deleteForTasks(
    deleted: DeletedTasks,
    cleared: Partial<typeof runFact.$inferInsert>,
  ): Promise<void> {
    const inWorkspace = eq(runFact.workspaceId, deleted.workspaceId);

    await this.context.inTransaction(async () => {
      await this.lock('exclusive', [workspaceKey(deleted.workspaceId)]);

      if (deleted.kind === 'workspace') {
        await this.context.db.update(runFact).set(cleared).where(inWorkspace);
        return;
      }

      for (let at = 0; at < deleted.taskIds.length; at += AT_ONCE) {
        await this.context.db
          .update(runFact)
          .set(cleared)
          .where(
            and(
              inWorkspace,
              inArray(runFact.taskId, deleted.taskIds.slice(at, at + AT_ONCE)),
            ),
          );
      }
    });
  }

  private async lockFactsOf(scope: RunFactRefresh): Promise<void> {
    const places = await this.context.db
      .selectDistinct({
        workspaceId: runRecord.workspaceId,
        taskId: nonNull<string>(runRecord.taskId),
      })
      .from(runRecord)
      .where(
        and(
          scope.kind === 'tasks'
            ? inArray(runRecord.taskId, [...scope.taskIds])
            : inArray(runRecord.runId, [...scope.runIds]),
          isNotNull(runRecord.taskId),
        ),
      );
    const facts =
      scope.kind === 'tasks'
        ? await this.context.db
            .selectDistinct({
              workspaceId: runFact.workspaceId,
              taskId: runFact.taskId,
            })
            .from(runFact)
            .where(inArray(runFact.taskId, [...scope.taskIds]))
        : [];
    const targets = [...places, ...facts];

    await this.lock(
      'shared',
      targets.map((each) => workspaceKey(each.workspaceId)),
    );
    await this.lock(
      'exclusive',
      [
        ...(scope.kind === 'tasks' ? scope.taskIds : []),
        ...targets.map((each) => each.taskId),
      ].map((taskId) => `run-fact:${taskId}`),
    );
  }

  private async lock(
    mode: 'shared' | 'exclusive',
    keys: readonly string[],
  ): Promise<void> {
    const distinct = [...new Set(keys)];

    if (distinct.length === 0) {
      return;
    }

    const locking =
      mode === 'shared'
        ? sql`pg_advisory_xact_lock_shared`
        : sql`pg_advisory_xact_lock`;

    await this.context.db.execute(
      sql`select ${locking}(hashtextextended(key, 0)) from (select key from unnest(array[${sql.join(
        distinct.map((key) => sql`${key}`),
        sql`, `,
      )}]::text[]) as key order by key) as ordered`,
    );
  }

  private async upsert(where: SQL): Promise<void> {
    await this.context.db
      .insert(runFact)
      .select(projected(this.context.db, where))
      .onConflictDoUpdate({ target: runFact.runId, set: replaced });
  }

  private async dropStale(scope: RunFactScope): Promise<void> {
    await this.context.db.delete(runFact).where(
      and(
        within(runFact, scope),
        notExists(
          this.context.db
            .select({ one: sql`1` })
            .from(runRecord)
            .where(and(eq(runRecord.runId, runFact.runId), ended)),
        ),
      ),
    );
  }
}
