import { Inject, Injectable } from '@nestjs/common';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { RunRecordVersionConflictError } from '@outcomes/domain/exceptions/run-record-version-conflict.error';
import type {
  RunRecordRepository,
  StationRecords,
} from '@outcomes/domain/repositories/run-record.repository';
import {
  earliestBounds,
  type StretchBound,
} from '@outcomes/domain/services/config-stretches';
import {
  NEXT_ACTS,
  NextAct,
  type NextActKind,
} from '@outcomes/domain/value-objects/next-act.vo';
import { Refusal } from '@outcomes/domain/value-objects/refusal.vo';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import { RunMemories } from '@outcomes/domain/value-objects/run-memories.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { RunSetup } from '@outcomes/domain/value-objects/run-setup.vo';
import { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import { StationPass } from '@outcomes/domain/value-objects/station-pass.vo';
import { DrizzleRunFactProjection } from '@outcomes/infrastructure/persistence/drizzle/projections/run-fact.projection';
import {
  ranAConfig,
  runRecord,
  type StoredTools,
  startOrderColumns,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
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
    next: nextOf(row),
    approvalAnsweredAt: row.approvalAnsweredAt,
    cost: costOf(row),
    passed: passOf(row),
    tools: toolsOf(row),
    refusals: refusalsOf(row),
    memories: memoriesOf(row),
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
    passedTo: record.passed?.to ?? null,
    passedAt: record.passed?.at ?? null,
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
    memories: {
      briefed: [...record.memories.briefed],
      recalled: [...record.memories.recalled],
    },
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
