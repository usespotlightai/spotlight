import type {
  HistoryRepositories,
  PullRequestRepositories,
} from '@insights/application/ports/insights-reader.fake-spec';
import type {
  RunListing,
  TeamWindow,
} from '@insights/domain/repositories/run-record.repository';
import type { RunPage } from '@insights/domain/runs.fake-spec';
import type {
  Narrowing,
  RunFilter,
} from '@insights/domain/services/run-filter';
import { inEndOrder } from '@insights/domain/services/run-order';
import type { Window } from '@insights/domain/value-objects/insights-period.vo';
import type { DrizzleChatRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/chat-record.repository';
import type { DrizzlePullRequestRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import type { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import type { DrizzleTaskChangeShapeRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-change-shape.repository';
import type { DrizzleTaskFailuresRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-failures.repository';
import type { DrizzleTaskHumanActionsRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-human-actions.repository';
import type { DrizzleTaskPullRequestRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-pull-request.repository';
import {
  chatRecord,
  pullRequestRecord,
  runRecord,
  startOrderColumns,
  taskFailures,
  taskHumanAction,
  taskPullRequest,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  type SQL,
  type SQLWrapper,
  sql,
} from 'drizzle-orm';

export interface ReferenceRepositories {
  readonly db: DrizzleDatabase;
  readonly runs: DrizzleRunRecordRepository;
  readonly taskPullRequests: DrizzleTaskPullRequestRepository;
  readonly humanActions: DrizzleTaskHumanActionsRepository;
  readonly failures: DrizzleTaskFailuresRepository;
  readonly chats: DrizzleChatRecordRepository;
  readonly pullRequests: DrizzlePullRequestRecordRepository;
  readonly shapes: DrizzleTaskChangeShapeRepository;
}

const inKeyOrder = <T>(
  keys: readonly string[],
  found: readonly T[],
  keyOf: (each: T) => string,
): readonly T[] => {
  const byKey = new Map(found.map((each) => [keyOf(each), each]));

  return keys.flatMap((key) => {
    const each = byKey.get(key);

    return each ? [each] : [];
  });
};

const humanActionsOf = async (
  humanActions: DrizzleTaskHumanActionsRepository,
  taskIds: readonly TaskId[],
) => {
  const found = await Promise.all(taskIds.map((each) => humanActions.of(each)));

  return found.flatMap((each) => (each ? [each] : []));
};

const ranInWindow = (db: DrizzleDatabase, window: TeamWindow) =>
  db
    .selectDistinct({ taskId: runRecord.taskId })
    .from(runRecord)
    .where(
      and(
        eq(runRecord.workspaceId, window.workspaceId.value),
        eq(runRecord.teamId, window.teamId.value),
        gte(runRecord.endedAt, window.from),
        lt(runRecord.endedAt, window.to),
      ),
    );

const endedInWindow = (window: TeamWindow): SQL | undefined =>
  and(
    eq(runRecord.workspaceId, window.workspaceId.value),
    eq(runRecord.teamId, window.teamId.value),
    gte(runRecord.endedAt, window.from),
    lt(runRecord.endedAt, window.to),
  );

const modelWhere = (model: Narrowing): SQL | undefined => {
  if (model.kind === 'any') {
    return undefined;
  }

  return model.kind === 'none'
    ? isNull(runRecord.model)
    : eq(runRecord.model, model.value);
};

const repositoryWhere = (repository: Narrowing): SQL | undefined => {
  if (repository.kind === 'any') {
    return undefined;
  }

  return repository.kind === 'none'
    ? sql`coalesce(jsonb_array_length(${runRecord.repositories}), 0) = 0`
    : sql`${runRecord.repositories} @> ${JSON.stringify([repository.value])}::jsonb`;
};

const endedWithin = (window: Window | null): SQL | undefined =>
  window === null
    ? undefined
    : and(
        gte(runRecord.endedAt, window.from),
        lt(runRecord.endedAt, window.to),
      );

const containing = (column: SQLWrapper, value: unknown): SQL =>
  sql`${column} @> ${JSON.stringify(value)}::jsonb`;

const ranWhere = sql`${runRecord.ending}::text <> 'cancelled'`;

const refusedServerOf = (server: Narrowing): { server?: string | null } => {
  if (server.kind === 'any') {
    return {};
  }

  return { server: server.kind === 'none' ? null : server.value };
};

const refusalWhere = (filter: RunFilter): SQL | undefined =>
  filter.refusedTool === null && filter.refusedServer.kind === 'any'
    ? undefined
    : containing(runRecord.refusals, [
        {
          ...(filter.refusedTool === null ? {} : { tool: filter.refusedTool }),
          ...refusedServerOf(filter.refusedServer),
        },
      ]);

const toolsWhere = (filter: RunFilter): (SQL | undefined)[] => {
  const narrowed = [
    filter.skillEnabled === null
      ? undefined
      : containing(runRecord.skills, [filter.skillEnabled]),
    filter.skillUsed === null
      ? undefined
      : containing(sql`${runRecord.tools}->'skillsRead'`, [filter.skillUsed]),
    filter.server === null
      ? undefined
      : containing(sql`${runRecord.tools}->'servers'`, [
          { server: filter.server },
        ]),
    filter.serverFailed === null
      ? undefined
      : sql`exists (select 1 from jsonb_array_elements(${runRecord.tools}->'servers') as called where called->>'server' = ${filter.serverFailed} and (called->>'failed')::int > 0)`,
    filter.failedAfter === null
      ? undefined
      : and(
          sql`${runRecord.ending}::text = 'failed'`,
          isNull(runRecord.supersededAt),
          containing(sql`${runRecord.tools}->'servers'`, [
            { server: filter.failedAfter, lastCallFailed: true },
          ]),
        ),
    refusalWhere(filter),
  ].filter((each) => each !== undefined);

  return [
    endedWithin(filter.week),
    ...narrowed,
    narrowed.length > 0 ? ranWhere : undefined,
  ];
};

const filtered = (
  db: DrizzleDatabase,
  window: TeamWindow,
  filter: RunFilter,
): (SQL | undefined)[] => {
  const workspace = window.workspaceId.value;

  return [
    filter.lineId === null ? undefined : eq(runRecord.lineId, filter.lineId),
    filter.stationId === null
      ? undefined
      : eq(runRecord.stationId, filter.stationId),
    filter.outcome === null
      ? undefined
      : sql`${runRecord.ending}::text = ${filter.outcome}`,
    filter.harness === null ? undefined : eq(runRecord.harness, filter.harness),
    modelWhere(filter.model),
    repositoryWhere(filter.repository),
    filter.fingerprint === null
      ? undefined
      : eq(runRecord.fingerprint, filter.fingerprint),
    filter.taskIds === null
      ? undefined
      : filter.taskIds.length === 0
        ? sql`false`
        : inArray(runRecord.taskId, [...filter.taskIds]),
    endedWithin(filter.day),
    ...toolsWhere(filter),
    filter.humanAction === null
      ? undefined
      : sql`${runRecord.firstHumanAction}::text = ${filter.humanAction}`,
    filter.personId === null
      ? undefined
      : inArray(
          runRecord.taskId,
          db
            .select({ taskId: taskHumanAction.taskId })
            .from(taskHumanAction)
            .where(
              and(
                eq(taskHumanAction.workspaceId, workspace),
                eq(taskHumanAction.openedBy, filter.personId),
              ),
            ),
        ),
    filter.pullRequestState === null
      ? undefined
      : inArray(
          runRecord.taskId,
          db
            .select({ taskId: taskPullRequest.taskId })
            .from(taskPullRequest)
            .where(
              and(
                eq(taskPullRequest.workspaceId, workspace),
                sql`${taskPullRequest.state}::text = ${filter.pullRequestState}`,
              ),
            ),
        ),
    filter.askedWithin === null
      ? undefined
      : inArray(
          runRecord.taskId,
          db
            .select({ taskId: taskHumanAction.taskId })
            .from(taskHumanAction)
            .where(
              and(
                eq(taskHumanAction.workspaceId, workspace),
                sql`exists (select 1 from jsonb_array_elements(${taskHumanAction.asks}) as ask where (ask->>'at')::timestamptz >= ${filter.askedWithin.from.toISOString()}::timestamptz and (ask->>'at')::timestamptz < ${filter.askedWithin.to.toISOString()}::timestamptz)`,
              ),
            ),
        ),
  ];
};

export const historyRepositoriesOf = ({
  db,
  runs,
  taskPullRequests,
  humanActions,
  failures,
  chats,
}: ReferenceRepositories): HistoryRepositories => ({
  records: {
    endedForTeam: async (window, max) => {
      const keys = await db
        .select({ runId: runRecord.runId })
        .from(runRecord)
        .where(endedInWindow(window))
        .orderBy(
          ...startOrderColumns(runRecord).map((each) => sql`${each} desc`),
        )
        .limit(max);

      return [
        ...(await runs.ofRuns(keys.map((each) => RunId.of(each.runId)))),
      ].sort(inEndOrder);
    },
    listedForTeam: async (listing: RunListing): Promise<RunPage> => {
      const where = and(
        endedInWindow(listing.window),
        ...filtered(db, listing.window, listing.filter),
      );
      const [counted] = await db
        .select({ total: count() })
        .from(runRecord)
        .where(where);
      const keys = (
        await db
          .select({ runId: runRecord.runId })
          .from(runRecord)
          .where(where)
          .orderBy(
            desc(runRecord.endedAt),
            sql`${runRecord.runId} collate "C" desc`,
          )
          .offset(listing.offset)
          .limit(listing.limit)
      ).map((each) => each.runId);

      return {
        records: inKeyOrder(
          keys,
          await runs.ofRuns(keys.map(RunId.of)),
          (each) => each.runId.value,
        ),
        total: counted?.total ?? 0,
      };
    },
    lastConfigRunsBefore: (teamId, stations) =>
      runs.lastConfigRunsBefore(teamId, stations),
    ofTasks: (taskIds) => runs.ofTasks(taskIds),
  },
  taskPullRequests: {
    forTasks: (taskIds) => taskPullRequests.forTasks(taskIds),
    ofTeamBetween: async (window, max) => {
      const keys = (
        await db
          .select({ taskId: taskPullRequest.taskId })
          .from(taskPullRequest)
          .where(
            and(
              eq(taskPullRequest.workspaceId, window.workspaceId.value),
              or(
                and(
                  eq(taskPullRequest.teamId, window.teamId.value),
                  lt(taskPullRequest.openedAt, window.to),
                  or(
                    and(
                      isNull(taskPullRequest.closedAt),
                      or(
                        gte(taskPullRequest.openedAt, window.from),
                        gte(taskPullRequest.firstReviewAt, window.from),
                      ),
                    ),
                    gte(taskPullRequest.closedAt, window.from),
                  ),
                ),
                inArray(taskPullRequest.taskId, ranInWindow(db, window)),
              ),
            ),
          )
          .orderBy(desc(taskPullRequest.openedAt), desc(taskPullRequest.taskId))
          .limit(max)
      ).map((each) => each.taskId);

      return inKeyOrder(
        keys,
        await taskPullRequests.forTasks(keys.map(TaskId.of)),
        (each) => each.taskId.value,
      );
    },
  },
  taskHumanActions: {
    forTasks: (taskIds) => humanActionsOf(humanActions, taskIds),
    ofTeamBetween: async (window, max) => {
      const keys = (
        await db
          .select({ taskId: taskHumanAction.taskId })
          .from(taskHumanAction)
          .where(
            and(
              eq(taskHumanAction.workspaceId, window.workspaceId.value),
              or(
                and(
                  eq(taskHumanAction.teamId, window.teamId.value),
                  gte(taskHumanAction.lastActionAt, window.from),
                  lt(taskHumanAction.openedAt, window.to),
                ),
                inArray(taskHumanAction.taskId, ranInWindow(db, window)),
              ),
            ),
          )
          .orderBy(
            desc(taskHumanAction.lastActionAt),
            desc(taskHumanAction.taskId),
          )
          .limit(max)
      ).map((each) => each.taskId);

      return humanActionsOf(humanActions, keys.map(TaskId.of));
    },
  },
  failures: {
    ofTeamBetween: async (window, max) => {
      const keys = await db
        .select({ taskId: taskFailures.taskId })
        .from(taskFailures)
        .where(
          and(
            eq(taskFailures.workspaceId, window.workspaceId.value),
            eq(taskFailures.teamId, window.teamId.value),
            gte(taskFailures.lastAt, window.from),
          ),
        )
        .orderBy(desc(taskFailures.lastAt), desc(taskFailures.taskId))
        .limit(max);
      const found = await Promise.all(
        keys.map((each) => failures.of(TaskId.of(each.taskId))),
      );

      return found.flatMap((each) => (each ? [each] : []));
    },
  },
  chats: {
    ofTeamBetween: async (window, max) => {
      const keys = await db
        .select({ chatId: chatRecord.chatId })
        .from(chatRecord)
        .where(
          and(
            eq(chatRecord.workspaceId, window.workspaceId.value),
            eq(chatRecord.teamId, window.teamId.value),
            gte(chatRecord.startedAt, window.from),
            lt(chatRecord.startedAt, window.to),
          ),
        )
        .orderBy(desc(chatRecord.startedAt), desc(chatRecord.chatId))
        .limit(max);
      const found = await Promise.all(
        keys.map((each) => chats.of(each.chatId)),
      );

      return found.flatMap((each) => (each ? [each] : []));
    },
  },
});

export const pullRequestRepositoriesOf = ({
  db,
  pullRequests,
  shapes,
}: ReferenceRepositories): PullRequestRepositories => ({
  records: {
    seenForTeamBetween: async (window, max) => {
      const repositories = window.repositories.map((each) =>
        each.toLowerCase(),
      );
      const keys = await db
        .select({ pullRequest: pullRequestRecord.pullRequest })
        .from(pullRequestRecord)
        .where(
          and(
            eq(pullRequestRecord.workspaceId, window.workspaceId.value),
            isNotNull(pullRequestRecord.seenVersion),
            or(
              eq(pullRequestRecord.ownerTeamId, window.teamId.value),
              repositories.length > 0
                ? inArray(pullRequestRecord.repository, repositories)
                : sql`false`,
            ),
            lt(pullRequestRecord.openedAt, window.to),
            or(
              isNull(pullRequestRecord.closedAt),
              gte(pullRequestRecord.closedAt, window.from),
            ),
          ),
        )
        .orderBy(
          desc(pullRequestRecord.openedAt),
          sql`${pullRequestRecord.pullRequest} collate "C" desc`,
        )
        .limit(max);
      const found = await Promise.all(
        keys.map((each) =>
          pullRequests.at(
            window.workspaceId,
            PullRequestUrl.of(each.pullRequest),
          ),
        ),
      );

      return found.flatMap((each) => (each ? [each] : []));
    },
  },
  shapes: {
    forTasks: async (taskIds) => {
      const found = await Promise.all(
        taskIds.map((each) => shapes.forTask(each)),
      );

      return found.flatMap((each) => (each ? [each] : []));
    },
  },
});
