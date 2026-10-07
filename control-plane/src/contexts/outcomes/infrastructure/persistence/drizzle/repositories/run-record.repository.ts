import { Inject, Injectable } from '@nestjs/common';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { RunRecordMovedOnError } from '@outcomes/domain/exceptions/run-record-moved-on.error';
import type {
  RunListing,
  RunPage,
  RunRecordRepository,
  StationRecords,
  TeamWindow,
} from '@outcomes/domain/repositories/run-record.repository';
import {
  earliestBounds,
  type StretchBound,
} from '@outcomes/domain/services/config-stretches';
import type {
  Narrowing,
  RunFilter,
} from '@outcomes/domain/services/run-filter';
import { inEndOrder } from '@outcomes/domain/services/run-order';
import { HandedOn } from '@outcomes/domain/value-objects/handed-on.vo';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import {
  NEXT_ACTS,
  NextAct,
  type NextActKind,
} from '@outcomes/domain/value-objects/next-act.vo';
import { Refusal } from '@outcomes/domain/value-objects/refusal.vo';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { RunSetup } from '@outcomes/domain/value-objects/run-setup.vo';
import { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import {
  ranAConfig,
  runRecord,
  type StoredTools,
  startOrderColumns,
  taskDelivery,
  taskTouches,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
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
  lte,
  ne,
  type SQL,
  type SQLWrapper,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

type RecordRow = typeof runRecord.$inferSelect;

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

const holding = (column: SQLWrapper, value: unknown): SQL =>
  sql`${column} @> ${JSON.stringify(value)}::jsonb`;

const ranWhere = sql`${runRecord.ending}::text <> 'withdrawn'`;

const refusedServerOf = (server: Narrowing): { server?: string | null } => {
  if (server.kind === 'any') {
    return {};
  }

  return { server: server.kind === 'none' ? null : server.value };
};

const refusalWhere = (filter: RunFilter): SQL | undefined =>
  filter.refusedTool === null && filter.refusedServer.kind === 'any'
    ? undefined
    : holding(runRecord.refusals, [
        {
          ...(filter.refusedTool === null ? {} : { tool: filter.refusedTool }),
          ...refusedServerOf(filter.refusedServer),
        },
      ]);

const toolsWhere = (filter: RunFilter): (SQL | undefined)[] => {
  const narrowed = [
    filter.skillGiven === null
      ? undefined
      : holding(runRecord.skills, [filter.skillGiven]),
    filter.skillUsed === null
      ? undefined
      : holding(sql`${runRecord.tools}->'skillsRead'`, [filter.skillUsed]),
    filter.server === null
      ? undefined
      : holding(sql`${runRecord.tools}->'servers'`, [
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
          holding(sql`${runRecord.tools}->'servers'`, [
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

const endOf = (row: RecordRow): RunEnd | null => {
  if (!row.endedAt) {
    return null;
  }
  if (
    !row.teamId ||
    !row.lineId ||
    !row.stationId ||
    !row.taskId ||
    !row.ending ||
    !row.harness ||
    !row.repositories ||
    !row.skills ||
    row.round === null
  ) {
    throw new InconsistentStateError(
      'run record',
      'ended without saying where, how, or in which round',
    );
  }

  return RunEnd.of({
    place: RunPlace.of({
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
      taskId: TaskId.of(row.taskId),
    }),
    fingerprint: row.fingerprint,
    setup: RunSetup.of({
      harness: row.harness,
      model: row.model,
      effort: row.effort,
      profileKey: row.profileKey,
      repositories: row.repositories,
      skills: row.skills,
    }),
    queuedAt: row.queuedAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    ending: row.ending,
    failure: row.failure,
    round: row.round,
    asked: row.asked,
  });
};

const nextOf = (row: RecordRow): NextAct | null => {
  if ((row.nextAct === null) !== (row.nextAt === null)) {
    throw new InconsistentStateError(
      'run record',
      'was acted on without saying when, or says when without the act',
    );
  }

  if (!row.nextAct || !row.nextAt) {
    return null;
  }

  return NextAct.of(row.nextAct, row.nextAt);
};

const nextActColumnOf = (next: NextAct | null): NextActKind | null => {
  if (!next) {
    return null;
  }

  const kind = NEXT_ACTS.find((each) => each === next.act);

  if (!kind) {
    throw new InconsistentStateError(
      'run record',
      'was decided by answering an approval',
    );
  }

  return kind;
};

const costOf = (row: RecordRow): RunCost | null => {
  if (!row.digested) {
    return null;
  }
  if (row.steps === null || row.faults === null || row.changedLines === null) {
    throw new InconsistentStateError(
      'run record',
      'was digested without counting its steps, faults or changed lines',
    );
  }

  return RunCost.of({
    ms: row.ms,
    steps: row.steps,
    faults: row.faults,
    changedLines: row.changedLines,
    used: row.used,
    size: row.size,
    amount: row.cost,
    currency: row.currency,
    tokens: {
      input: row.inputTokens,
      output: row.outputTokens,
      cacheRead: row.cacheReadTokens,
      cacheWrite: row.cacheWriteTokens,
    },
  });
};

const toolsOf = (row: RecordRow): RunTools | null => {
  if (!row.digested) {
    return null;
  }

  return row.tools
    ? RunTools.of({
        servers: row.tools.servers.map((each) => ({
          ...each,
          latency: LatencyHistogram.of(each.latency),
        })),
        skillsRead: row.tools.skillsRead,
      })
    : RunTools.NONE;
};

const storedToolsOf = (tools: RunTools): StoredTools => ({
  servers: tools.servers.map((each) => ({
    server: each.server,
    calls: each.calls,
    failed: each.failed,
    latency: [...each.latency.counts],
    lastCallFailed: each.lastCallFailed,
  })),
  skillsRead: [...tools.skillsRead],
});

const refusalsOf = (row: RecordRow): readonly Refusal[] =>
  row.refusals.map((each) =>
    Refusal.of({ tool: each.tool, server: each.server, at: new Date(each.at) }),
  );

const handedOnOf = (row: RecordRow): HandedOn | null => {
  if ((row.handedOnTo === null) !== (row.handedOnAt === null)) {
    throw new InconsistentStateError(
      'run record',
      'was handed on without saying where or when',
    );
  }

  return row.handedOnTo && row.handedOnAt
    ? HandedOn.of(row.handedOnTo, row.handedOnAt)
    : null;
};

const toRecord = (row: RecordRow): RunRecord =>
  RunRecord.rehydrate({
    runId: RunId.of(row.runId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    taskId: row.taskId ? TaskId.of(row.taskId) : null,
    end: endOf(row),
    supersededAt: row.supersededAt,
    checks: row.checks,
    checkedAt: row.checkedAt,
    next: nextOf(row),
    approvalAnsweredAt: row.approvalAnsweredAt,
    cost: costOf(row),
    handedOn: handedOnOf(row),
    tools: toolsOf(row),
    refusals: refusalsOf(row),
    version: row.version,
  });

const columnsOf = (record: RunRecord) => {
  const end = record.end;

  return {
    teamId: end?.place.teamId.value ?? null,
    lineId: end?.place.lineId ?? null,
    stationId: end?.place.stationId ?? null,
    taskId: record.taskId?.value ?? null,
    fingerprint: end?.fingerprint ?? null,
    harness: end?.setup.harness ?? null,
    model: end?.setup.model ?? null,
    effort: end?.setup.effort ?? null,
    profileKey: end?.setup.profileKey ?? null,
    repositories: end ? [...end.setup.repositories] : null,
    skills: end ? [...end.setup.skills] : null,
    queuedAt: end?.queuedAt ?? null,
    startedAt: end?.startedAt ?? null,
    endedAt: end?.endedAt ?? null,
    ending: end?.ending ?? null,
    failure: end?.failure ?? null,
    round: end?.round ?? null,
    asked: end?.asked ?? false,
    supersededAt: record.supersededAt,
    checks: record.checks,
    checkedAt: record.checkedAt,
    nextAct: nextActColumnOf(record.next),
    nextAt: record.next?.at ?? null,
    approvalAnsweredAt: record.approvalAnsweredAt,
    handedOnTo: record.handedOn?.to ?? null,
    handedOnAt: record.handedOn?.at ?? null,
    digested: record.cost !== null,
    ms: record.cost?.ms ?? null,
    steps: record.cost?.steps ?? null,
    faults: record.cost?.faults ?? null,
    changedLines: record.cost?.changedLines ?? null,
    used: record.cost?.used ?? null,
    size: record.cost?.size ?? null,
    cost: record.cost?.spend?.amount ?? null,
    currency: record.cost?.spend?.currency ?? null,
    inputTokens: record.cost?.tokens.input ?? null,
    outputTokens: record.cost?.tokens.output ?? null,
    cacheReadTokens: record.cost?.tokens.cacheRead ?? null,
    cacheWriteTokens: record.cost?.tokens.cacheWrite ?? null,
    tools: record.tools ? storedToolsOf(record.tools) : null,
    refusals: record.refusals.map((each) => ({
      tool: each.tool,
      server: each.server,
      at: each.at.toISOString(),
    })),
  };
};

const boundsOf = (earliest: readonly StretchBound[]): SQL => {
  const stationIds = sql.join(
    earliest.map(({ stationId }) => sql`${stationId}`),
    sql`, `,
  );
  const froms = sql.join(
    earliest.map(({ from }) => sql`${from.toISOString()}`),
    sql`, `,
  );
  const fromRuns = sql.join(
    earliest.map(({ fromRun }) => sql`${fromRun?.value ?? ''}`),
    sql`, `,
  );

  return sql`unnest(array[${stationIds}]::text[], array[${froms}]::timestamp[], array[${fromRuns}]::text[]) as bound(station_id, from_at, from_run)`;
};

const beforeBound = (began: SQL, inRunOrder: SQL): SQL =>
  sql`(${began} < bound.from_at or (${began} = bound.from_at and ${inRunOrder} < bound.from_run collate "C"))`;

const lastConfigRunBefore = (teamId: TeamId): SQL => {
  const seed = alias(runRecord, 'seed');
  const [seedBegan, seedInRunOrder] = startOrderColumns(seed);

  return sql`(
    select ${seed.runId} as run_id, ${seed.fingerprint} as fingerprint
    from ${runRecord} ${seed}
    where ${seed.teamId} = ${teamId.value}
      and ${seed.stationId} = bound.station_id
      and ${ranAConfig(seed)}
      and ${beforeBound(seedBegan, seedInRunOrder)}
    order by ${seedBegan} desc, ${seedInRunOrder} desc
    limit 1
  )`;
};

const atStation = (criteria: StationRecords): SQL | undefined =>
  and(
    eq(runRecord.workspaceId, criteria.workspaceId.value),
    eq(runRecord.teamId, criteria.teamId.value),
    eq(runRecord.stationId, criteria.stationId),
    criteria.lineId === null
      ? undefined
      : eq(runRecord.lineId, criteria.lineId),
    isNotNull(runRecord.endedAt),
  );

@Injectable()
export class DrizzleRunRecordRepository implements RunRecordRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: RunRecord): Promise<void> {
    const written = await this.context.db
      .insert(runRecord)
      .values({
        runId: added.runId.value,
        workspaceId: added.workspaceId.value,
        version: added.version,
        ...columnsOf(added),
      })
      .onConflictDoNothing({ target: runRecord.runId })
      .returning({ runId: runRecord.runId });

    if (written.length === 0) {
      throw new RunRecordMovedOnError(added.runId.value);
    }

    await this.events.dispatch(added.pullEvents());
  }

  async save(saved: RunRecord): Promise<void> {
    const written = await this.context.db
      .update(runRecord)
      .set({ version: saved.version + 1, ...columnsOf(saved) })
      .where(
        and(
          eq(runRecord.runId, saved.runId.value),
          eq(runRecord.version, saved.version),
        ),
      )
      .returning({ runId: runRecord.runId });

    if (written.length === 0) {
      throw new RunRecordMovedOnError(saved.runId.value);
    }

    await this.events.dispatch(saved.pullEvents());
  }

  async of(runId: RunId): Promise<RunRecord | null> {
    const [row] = await this.context.db
      .select()
      .from(runRecord)
      .where(eq(runRecord.runId, runId.value))
      .limit(1);

    return row ? toRecord(row) : null;
  }

  async ofRuns(runIds: readonly RunId[]): Promise<readonly RunRecord[]> {
    if (runIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(runRecord)
      .where(
        inArray(
          runRecord.runId,
          runIds.map((each) => each.value),
        ),
      );

    return rows.map(toRecord);
  }

  async ofTasks(taskIds: readonly TaskId[]): Promise<readonly RunRecord[]> {
    if (taskIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(runRecord)
      .where(
        inArray(
          runRecord.taskId,
          taskIds.map((each) => each.value),
        ),
      );

    return rows.map(toRecord);
  }

  async lastEndedOfTaskAt(
    taskId: TaskId,
    stationId: string,
    by: Date,
  ): Promise<RunRecord | null> {
    const [row] = await this.context.db
      .select()
      .from(runRecord)
      .where(
        and(
          eq(runRecord.taskId, taskId.value),
          eq(runRecord.stationId, stationId),
          ne(runRecord.ending, 'withdrawn'),
          lte(runRecord.endedAt, by),
        ),
      )
      .orderBy(desc(runRecord.endedAt))
      .limit(1);

    return row ? toRecord(row) : null;
  }

  async lastConfigRunsBefore(
    teamId: TeamId,
    bounds: readonly StretchBound[],
  ): Promise<readonly RunRecord[]> {
    const earliest = [...earliestBounds(bounds).values()];

    if (earliest.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(runRecord)
      .where(
        sql`${runRecord.runId} in (
          select previous.run_id
          from ${boundsOf(earliest)}
          join lateral ${lastConfigRunBefore(teamId)} previous on true
        )`,
      );

    return rows.map(toRecord);
  }

  async lastAtStation(criteria: StationRecords): Promise<readonly RunRecord[]> {
    const rows = await this.context.db
      .select()
      .from(runRecord)
      .where(atStation(criteria))
      .orderBy(desc(runRecord.endedAt))
      .limit(criteria.last);

    return rows.map(toRecord);
  }

  async latestStartedAtStation(
    criteria: StationRecords,
  ): Promise<readonly RunRecord[]> {
    const rows = await this.context.db
      .select()
      .from(runRecord)
      .where(atStation(criteria))
      .orderBy(...startOrderColumns(runRecord).map((each) => sql`${each} desc`))
      .limit(criteria.last);

    return rows.map(toRecord);
  }

  async endedForTeam(
    window: TeamWindow,
    most: number,
  ): Promise<readonly RunRecord[]> {
    const rows = await this.context.db
      .select()
      .from(runRecord)
      .where(endedInWindow(window))
      .orderBy(...startOrderColumns(runRecord).map((each) => sql`${each} desc`))
      .limit(most);

    return rows.map(toRecord).sort(inEndOrder);
  }

  async listedForTeam(listing: RunListing): Promise<RunPage> {
    const where = and(
      endedInWindow(listing.window),
      ...this.filtered(listing.window, listing.filter),
    );
    const { counted, rows } = await this.context.db.transaction(
      async (tx) => {
        const [counted] = await tx
          .select({ total: count() })
          .from(runRecord)
          .where(where);
        const rows = await tx
          .select()
          .from(runRecord)
          .where(where)
          .orderBy(desc(runRecord.endedAt), desc(runRecord.runId))
          .offset(listing.offset)
          .limit(listing.limit);

        return { counted, rows };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );

    return { records: rows.map(toRecord), total: counted?.total ?? 0 };
  }

  private filtered(window: TeamWindow, filter: RunFilter): (SQL | undefined)[] {
    const workspace = window.workspaceId.value;

    return [
      filter.lineId === null ? undefined : eq(runRecord.lineId, filter.lineId),
      filter.stationId === null
        ? undefined
        : eq(runRecord.stationId, filter.stationId),
      filter.outcome === null
        ? undefined
        : sql`${runRecord.ending}::text = ${filter.outcome}`,
      filter.harness === null
        ? undefined
        : eq(runRecord.harness, filter.harness),
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
      filter.next === null
        ? undefined
        : sql`${runRecord.nextAct}::text = ${filter.next}`,
      filter.personId === null
        ? undefined
        : inArray(
            runRecord.taskId,
            this.context.db
              .select({ taskId: taskTouches.taskId })
              .from(taskTouches)
              .where(
                and(
                  eq(taskTouches.workspaceId, workspace),
                  eq(taskTouches.openedBy, filter.personId),
                ),
              ),
          ),
      filter.delivery === null
        ? undefined
        : inArray(
            runRecord.taskId,
            this.context.db
              .select({ taskId: taskDelivery.taskId })
              .from(taskDelivery)
              .where(
                and(
                  eq(taskDelivery.workspaceId, workspace),
                  sql`${taskDelivery.state}::text = ${filter.delivery}`,
                ),
              ),
          ),
      filter.askedWithin === null
        ? undefined
        : inArray(
            runRecord.taskId,
            this.context.db
              .select({ taskId: taskTouches.taskId })
              .from(taskTouches)
              .where(
                and(
                  eq(taskTouches.workspaceId, workspace),
                  sql`exists (select 1 from jsonb_array_elements(${taskTouches.asks}) as ask where (ask->>'at')::timestamptz >= ${filter.askedWithin.from.toISOString()}::timestamptz and (ask->>'at')::timestamptz < ${filter.askedWithin.to.toISOString()}::timestamptz)`,
                ),
              ),
          ),
    ];
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(runRecord)
      .where(eq(runRecord.taskId, taskId.value));
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(runRecord)
      .where(
        and(
          eq(runRecord.workspaceId, workspaceId.value),
          eq(runRecord.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(runRecord)
      .where(eq(runRecord.workspaceId, workspaceId.value));
  }
}
