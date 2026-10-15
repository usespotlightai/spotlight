import type {
  ListedRun,
  RunsListed,
} from '@outcomes/application/ports/insights-reader.port';
import type {
  RunListing,
  TeamWindow,
} from '@outcomes/domain/repositories/run-record.repository';
import type {
  Narrowing,
  RunFilter,
} from '@outcomes/domain/services/run-filter';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import { msOf } from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  runFact,
  taskTouches,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import {
  and,
  count,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNull,
  lt,
  type SQL,
  type SQLWrapper,
  sql,
} from 'drizzle-orm';

const inWindow = (window: TeamWindow): SQL | undefined =>
  and(
    eq(runFact.workspaceId, window.workspaceId.value),
    eq(runFact.teamId, window.teamId.value),
    gte(runFact.endedAt, window.from),
    lt(runFact.endedAt, window.to),
  );

const endedWithin = (window: Window | null): SQL | undefined =>
  window === null
    ? undefined
    : and(gte(runFact.endedAt, window.from), lt(runFact.endedAt, window.to));

const modelWhere = (model: Narrowing): SQL | undefined => {
  if (model.kind === 'any') {
    return undefined;
  }

  return model.kind === 'none'
    ? isNull(runFact.model)
    : eq(runFact.model, model.value);
};

const repositoryWhere = (repository: Narrowing): SQL | undefined => {
  if (repository.kind === 'any') {
    return undefined;
  }

  return repository.kind === 'none'
    ? sql`jsonb_array_length(${runFact.repositories}) = 0`
    : holding(runFact.repositories, [repository.value]);
};

const holding = (column: SQLWrapper, value: unknown): SQL =>
  sql`${column} @> ${JSON.stringify(value)}::jsonb`;

const refusedServerOf = (server: Narrowing): { server?: string | null } => {
  if (server.kind === 'any') {
    return {};
  }

  return { server: server.kind === 'none' ? null : server.value };
};

const refusalWhere = (filter: RunFilter): SQL | undefined =>
  filter.refusedTool === null && filter.refusedServer.kind === 'any'
    ? undefined
    : holding(runFact.refusals, [
        {
          ...(filter.refusedTool === null ? {} : { tool: filter.refusedTool }),
          ...refusedServerOf(filter.refusedServer),
        },
      ]);

const toolsWhere = (filter: RunFilter): (SQL | undefined)[] => {
  const narrowed = [
    filter.skillGiven === null
      ? undefined
      : holding(runFact.skills, [filter.skillGiven]),
    filter.skillUsed === null
      ? undefined
      : holding(sql`${runFact.tools}->'skillsRead'`, [filter.skillUsed]),
    filter.server === null
      ? undefined
      : holding(sql`${runFact.tools}->'servers'`, [{ server: filter.server }]),
    filter.serverFailed === null
      ? undefined
      : sql`exists (select 1 from jsonb_array_elements(${runFact.tools}->'servers') as called where called->>'server' = ${filter.serverFailed} and (called->>'failed')::int > 0)`,
    filter.failedAfter === null
      ? undefined
      : and(
          sql`${runFact.ending}::text = 'failed'`,
          isNull(runFact.supersededAt),
          holding(sql`${runFact.tools}->'servers'`, [
            { server: filter.failedAfter, lastCallFailed: true },
          ]),
        ),
    refusalWhere(filter),
  ].filter((each) => each !== undefined);

  return [
    endedWithin(filter.week),
    ...narrowed,
    narrowed.length > 0 ? sql`${runFact.ran}` : undefined,
  ];
};

const askedWithin = (window: TeamWindow, asked: Window | null) =>
  asked === null
    ? undefined
    : inArray(
        runFact.taskId,
        sql`(select ${taskTouches.taskId} from ${taskTouches} where ${taskTouches.workspaceId} = ${window.workspaceId.value} and exists (select 1 from jsonb_array_elements(${taskTouches.asks}) as ask where (ask->>'at')::timestamptz >= ${asked.from.toISOString()}::timestamptz and (ask->>'at')::timestamptz < ${asked.to.toISOString()}::timestamptz))`,
      );

const filtered = (window: TeamWindow, filter: RunFilter): SQL | undefined =>
  and(
    inWindow(window),
    filter.lineId === null ? undefined : eq(runFact.lineId, filter.lineId),
    filter.stationId === null
      ? undefined
      : eq(runFact.stationId, filter.stationId),
    filter.outcome === null
      ? undefined
      : sql`${runFact.ending}::text = ${filter.outcome}`,
    filter.harness === null ? undefined : eq(runFact.harness, filter.harness),
    modelWhere(filter.model),
    repositoryWhere(filter.repository),
    filter.fingerprint === null
      ? undefined
      : eq(runFact.fingerprint, filter.fingerprint),
    filter.taskIds === null
      ? undefined
      : filter.taskIds.length === 0
        ? sql`false`
        : inArray(runFact.taskId, [...filter.taskIds]),
    endedWithin(filter.day),
    ...toolsWhere(filter),
    filter.next === null
      ? undefined
      : sql`${runFact.nextAct}::text = ${filter.next}`,
    filter.personId === null
      ? undefined
      : eq(runFact.openedBy, filter.personId),
    filter.delivery === null
      ? undefined
      : sql`${runFact.deliveryState}::text = ${filter.delivery}`,
    askedWithin(window, filter.askedWithin),
  );

type FactRow = typeof runFact.$inferSelect & {
  readonly queuedMs: number | null;
  readonly runningMs: number | null;
};

const listedOf = (row: FactRow): ListedRun => ({
  runId: row.runId,
  taskId: row.taskId,
  lineId: row.lineId,
  stationId: row.stationId,
  fingerprint: row.fingerprint,
  harness: row.harness,
  model: row.model,
  effort: row.effort,
  profileKey: row.profileKey,
  repositories: row.repositories,
  openedBy: row.openedBy,
  queuedAt: row.queuedAt,
  startedAt: row.startedAt,
  endedAt: row.endedAt,
  queuedMs: row.queuedMs,
  runningMs: row.runningMs,
  ms: row.digested ? row.ms : null,
  cost:
    row.digested && row.cost !== null && row.currency
      ? { amount: row.cost, currency: row.currency }
      : null,
  tokens: row.digested
    ? {
        input: row.inputTokens,
        output: row.outputTokens,
        cacheRead: row.cacheReadTokens,
        cacheWrite: row.cacheWriteTokens,
      }
    : null,
  ending: row.supersededAt === null ? row.ending : 'superseded',
  failure: row.failure,
  checks: row.checks,
  next: row.nextAct && row.nextAt ? { act: row.nextAct, at: row.nextAt } : null,
  handedOn:
    row.handedOnTo && row.handedOnAt
      ? { to: row.handedOnTo, at: row.handedOnAt }
      : null,
  delivery: row.deliveryState,
});

export const runPageIn = async (
  db: DrizzleDatabase,
  listing: RunListing,
): Promise<RunsListed> => {
  const where = filtered(listing.window, listing.filter);
  const [counted] = await db
    .select({ total: count() })
    .from(runFact)
    .where(where);
  const rows = await db
    .select({
      ...getTableColumns(runFact),
      queuedMs: sql<
        number | null
      >`${msOf(sql`${runFact.startedAt} - ${runFact.queuedAt}`)}`,
      runningMs: sql<
        number | null
      >`${msOf(sql`${runFact.endedAt} - ${runFact.startedAt}`)}`,
    })
    .from(runFact)
    .where(where)
    .orderBy(sql`${runFact.endedAt} desc, ${runFact.runId} collate "C" desc`)
    .offset(listing.offset)
    .limit(listing.limit);

  return { total: counted?.total ?? 0, runs: rows.map(listedOf) };
};
