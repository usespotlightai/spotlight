import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { RunRecordVersionConflictError } from '@insights/domain/exceptions/run-record-version-conflict.error';
import type {
  RunRecordRepository,
  StationRecords,
} from '@insights/domain/repositories/run-record.repository';
import {
  type ConfigIntervalBound,
  earliestBounds,
} from '@insights/domain/services/config-intervals';
import { Dismissal } from '@insights/domain/value-objects/dismissal.vo';
import {
  HumanAction,
  TASK_ACTIONS,
  type TaskAction,
} from '@insights/domain/value-objects/human-action.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { RunMemories } from '@insights/domain/value-objects/run-memories.vo';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import { DrizzleRunFactProjection } from '@insights/infrastructure/persistence/drizzle/projections/run-fact.projection';
import {
  ranAConfig,
  runRecord,
  type StoredTools,
  startOrderColumns,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { inList } from '@platform/persistence/drizzle/in-list';
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
  desc,
  eq,
  inArray,
  isNotNull,
  lte,
  ne,
  type SQL,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

type RecordRow = typeof runRecord.$inferSelect;

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
    row.visit === null
  ) {
    throw new InconsistentStateError(
      'run record',
      'ended without saying where, how, or in which visit',
    );
  }

  return RunEnd.of({
    location: RunLocation.of({
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
      taskId: TaskId.of(row.taskId),
    }),
    fingerprint: row.fingerprint,
    agentConfig: RunAgentConfig.of({
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
    visit: row.visit,
    asked: row.asked,
  });
};

const firstHumanActionOf = (row: RecordRow): HumanAction | null => {
  if ((row.firstHumanAction === null) !== (row.firstHumanActionAt === null)) {
    throw new InconsistentStateError(
      'run record',
      'has a first human action without a time, or a time without the action',
    );
  }

  if (!row.firstHumanAction || !row.firstHumanActionAt) {
    return null;
  }

  return HumanAction.of(row.firstHumanAction, row.firstHumanActionAt);
};

const firstHumanActionColumnOf = (
  action: HumanAction | null,
): TaskAction | null => {
  if (!action) {
    return null;
  }

  const kind = TASK_ACTIONS.find((each) => each === action.kind);

  if (!kind) {
    throw new InconsistentStateError(
      'run record',
      'was decided by answering an approval',
    );
  }

  return kind;
};

const usageOf = (row: RecordRow): RunUsage | null => {
  if (!row.usageRecorded) {
    return null;
  }
  if (row.steps === null || row.errors === null || row.changedLines === null) {
    throw new InconsistentStateError(
      'run record',
      'recorded its usage without counting its steps, errors or changed lines',
    );
  }

  return RunUsage.of({
    ms: row.ms,
    steps: row.steps,
    errors: row.errors,
    changedLines: row.changedLines,
    contextTokens: row.contextTokens,
    contextWindow: row.contextWindow,
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
  if (!row.usageRecorded) {
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

const dismissalsOf = (row: RecordRow): readonly Dismissal[] =>
  row.dismissals.map((each) =>
    Dismissal.of({
      tool: each.tool,
      server: each.server,
      at: new Date(each.at),
    }),
  );

const memoriesOf = (row: RecordRow): RunMemories =>
  RunMemories.of({
    briefed: row.memories.briefed,
    recalled: row.memories.recalled,
  });

const passOf = (row: RecordRow): StationPass | null => {
  if ((row.passedTo === null) !== (row.passedAt === null)) {
    throw new InconsistentStateError(
      'run record',
      'was passed on without saying where or when',
    );
  }

  return row.passedTo && row.passedAt
    ? StationPass.of(row.passedTo, row.passedAt)
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
    firstHumanAction: firstHumanActionOf(row),
    approvalAnsweredAt: row.approvalAnsweredAt,
    usage: usageOf(row),
    passed: passOf(row),
    tools: toolsOf(row),
    dismissals: dismissalsOf(row),
    memories: memoriesOf(row),
    version: row.version,
  });

const columnsOf = (record: RunRecord) => {
  const end = record.end;

  return {
    teamId: end?.location.teamId.value ?? null,
    lineId: end?.location.lineId ?? null,
    stationId: end?.location.stationId ?? null,
    taskId: record.taskId?.value ?? null,
    fingerprint: end?.fingerprint ?? null,
    harness: end?.agentConfig.harness ?? null,
    model: end?.agentConfig.model ?? null,
    effort: end?.agentConfig.effort ?? null,
    profileKey: end?.agentConfig.profileKey ?? null,
    repositories: end ? [...end.agentConfig.repositories] : null,
    skills: end ? [...end.agentConfig.skills] : null,
    queuedAt: end?.queuedAt ?? null,
    startedAt: end?.startedAt ?? null,
    endedAt: end?.endedAt ?? null,
    ending: end?.ending ?? null,
    failure: end?.failure ?? null,
    visit: end?.visit ?? null,
    asked: end?.asked ?? false,
    supersededAt: record.supersededAt,
    checks: record.checks,
    checkedAt: record.checkedAt,
    firstHumanAction: firstHumanActionColumnOf(record.firstHumanAction),
    firstHumanActionAt: record.firstHumanAction?.at ?? null,
    approvalAnsweredAt: record.approvalAnsweredAt,
    passedTo: record.passed?.to ?? null,
    passedAt: record.passed?.at ?? null,
    usageRecorded: record.usage !== null,
    ms: record.usage?.ms ?? null,
    steps: record.usage?.steps ?? null,
    errors: record.usage?.errors ?? null,
    changedLines: record.usage?.changedLines ?? null,
    contextTokens: record.usage?.contextTokens ?? null,
    contextWindow: record.usage?.contextWindow ?? null,
    cost: record.usage?.spend?.amount ?? null,
    currency: record.usage?.spend?.currency ?? null,
    inputTokens: record.usage?.tokens.input ?? null,
    outputTokens: record.usage?.tokens.output ?? null,
    cacheReadTokens: record.usage?.tokens.cacheRead ?? null,
    cacheWriteTokens: record.usage?.tokens.cacheWrite ?? null,
    tools: record.tools ? storedToolsOf(record.tools) : null,
    dismissals: record.dismissals.map((each) => ({
      tool: each.tool,
      server: each.server,
      at: each.at.toISOString(),
    })),
    memories: {
      briefed: [...record.memories.briefed],
      recalled: [...record.memories.recalled],
    },
  };
};

const boundsOf = (earliest: readonly ConfigIntervalBound[]): SQL => {
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
    private readonly facts: DrizzleRunFactProjection,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: RunRecord): Promise<void> {
    await this.context.inTransaction(async () => {
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
        throw new RunRecordVersionConflictError(added.runId.value);
      }

      await this.facts.refresh({ kind: 'runs', runIds: [added.runId.value] });

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: RunRecord): Promise<void> {
    await this.context.inTransaction(async () => {
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
        throw new RunRecordVersionConflictError(saved.runId.value);
      }

      await this.facts.refresh({ kind: 'runs', runIds: [saved.runId.value] });

      await this.events.dispatch(saved.pullEvents());
    });
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
        inList(
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
          ne(runRecord.ending, 'cancelled'),
          lte(runRecord.endedAt, by),
        ),
      )
      .orderBy(desc(runRecord.endedAt))
      .limit(1);

    return row ? toRecord(row) : null;
  }

  async lastConfigRunsBefore(
    teamId: TeamId,
    bounds: readonly ConfigIntervalBound[],
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

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .delete(runRecord)
        .where(eq(runRecord.taskId, taskId.value));

      await this.facts.refresh({ kind: 'tasks', taskIds: [taskId.value] });
    });
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .delete(runRecord)
        .where(
          and(
            eq(runRecord.workspaceId, workspaceId.value),
            eq(runRecord.teamId, teamId.value),
          ),
        );

      await this.facts.deleteRuns({
        kind: 'team',
        workspaceId: workspaceId.value,
        teamId: teamId.value,
      });
    });
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .delete(runRecord)
        .where(eq(runRecord.workspaceId, workspaceId.value));

      await this.facts.deleteRuns({
        kind: 'workspace',
        workspaceId: workspaceId.value,
      });
    });
  }
}
