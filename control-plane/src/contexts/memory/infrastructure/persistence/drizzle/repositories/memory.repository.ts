import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryAlreadySupersededError } from '@memory/domain/exceptions/memory-already-superseded.error';
import { MemoryVersionConflictError } from '@memory/domain/exceptions/memory-version-conflict.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryRetirement } from '@memory/domain/value-objects/memory-retirement.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { RunContext } from '@memory/domain/value-objects/run-context';
import { activeAsOf } from '@memory/infrastructure/persistence/drizzle/memory-prefilters';
import { memory } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';

type Row = typeof memory.$inferSelect;

const provenanceOf = (row: Row): MemoryProvenance | null => {
  const { taskId, runId, steps, notes } = row;

  if (taskId && runId && steps && notes) {
    return MemoryProvenance.of({
      taskId: TaskId.of(taskId),
      runId: RunId.of(runId),
      steps,
      notes,
    });
  }

  if (taskId || runId || steps || notes) {
    throw new InconsistentStateError(
      'memory',
      'has part of its provenance, but not all of it',
    );
  }

  return null;
};

const toMemory = (row: Row): Memory => {
  if ((row.status === 'retired') !== (row.retiredAt !== null)) {
    throw new InconsistentStateError(
      'memory',
      'has a retirement date but is not retired, or is retired without a date',
    );
  }

  return Memory.rehydrate({
    id: MemoryId.of(row.id),
    handle: MemoryHandle.of(row.handle),
    workspaceId: WorkspaceId.of(row.workspaceId),
    kind: row.kind,
    body: MemoryBody.of(row.body),
    scope: MemoryScope.of({
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId === null ? null : LineId.of(row.lineId),
      stationId: row.stationId === null ? null : StationId.of(row.stationId),
      repository: row.repository ? Repository.of(row.repository) : null,
      paths: row.paths.map(MemoryPath.of),
    }),
    provenance: provenanceOf(row),
    source: row.source,
    supersedes: row.supersedes ? MemoryId.of(row.supersedes) : null,
    approval: MemoryDecision.of({
      by: UserId.of(row.approvedById),
      at: row.approvedAt,
    }),
    retirement: row.retiredAt
      ? MemoryRetirement.rehydrate({
          at: row.retiredAt,
          by: row.retiredById ? UserId.of(row.retiredById) : null,
          reason: row.retireReason,
          supersededBy: row.supersededBy ? MemoryId.of(row.supersededBy) : null,
        })
      : null,
    version: row.version,
  });
};

const changedColumnsOf = (stored: Memory) =>
  ({
    status: stored.status,
    retiredAt: stored.retirement?.at ?? null,
    retiredById: stored.retirement?.by?.value ?? null,
    retireReason: stored.retirement?.reason ?? null,
    supersededBy: stored.retirement?.supersededBy?.value ?? null,
    supersedes: stored.supersedes?.value ?? null,
  }) satisfies Partial<typeof memory.$inferInsert>;

@Injectable()
export class DrizzleMemoryRepository implements MemoryRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Memory): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(memory)
        .values({
          id: added.id.value,
          handle: added.handle.number,
          workspaceId: added.workspaceId.value,
          kind: added.kind,
          body: added.body.value,
          teamId: added.scope.teamId.value,
          lineId: added.scope.lineId?.value ?? null,
          stationId: added.scope.stationId?.value ?? null,
          repository: added.scope.repository?.value ?? null,
          paths: added.scope.paths.map((each) => each.value),
          taskId: added.provenance?.taskId.value ?? null,
          runId: added.provenance?.runId.value ?? null,
          steps: added.provenance ? [...added.provenance.steps] : null,
          notes: added.provenance ? [...added.provenance.notes] : null,
          source: added.source,
          approvedById: added.approval.by.value,
          approvedAt: added.approval.at,
          version: added.version,
          ...changedColumnsOf(added),
        })
        .onConflictDoNothing({ target: memory.supersedes })
        .returning({ id: memory.id });

      if (written.length === 0) {
        throw new MemoryAlreadySupersededError(
          added.supersedes?.value ?? added.id.value,
        );
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Memory): Promise<void> {
    if (saved.isDeleted) {
      return this.removed(saved);
    }

    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(memory)
        .set({ version: saved.version + 1, ...changedColumnsOf(saved) })
        .where(
          and(eq(memory.id, saved.id.value), eq(memory.version, saved.version)),
        )
        .returning({ id: memory.id });

      if (written.length === 0) {
        throw new MemoryVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async removed(removed: Memory): Promise<void> {
    const gone = await this.context.db
      .delete(memory)
      .where(
        and(
          eq(memory.id, removed.id.value),
          eq(memory.version, removed.version),
        ),
      )
      .returning({ id: memory.id });

    if (gone.length === 0) {
      throw new MemoryVersionConflictError(removed.id.value);
    }
  }

  async ofTeam(teamId: TeamId): Promise<readonly Memory[]> {
    const rows = await this.context.db
      .select()
      .from(memory)
      .where(eq(memory.teamId, teamId.value));

    return rows.map(toMemory);
  }

  async nextHandle(): Promise<MemoryHandle> {
    const result = await this.context.db.execute<{ next: string }>(
      sql`select nextval('memory_handle_seq') as next`,
    );

    const [row] = result.rows;

    if (!row) {
      throw new Error('The memory handle sequence returned no number');
    }

    return MemoryHandle.of(Number(row.next));
  }

  async mayApplyAt(
    runContext: RunContext,
    asOf: Date | null = null,
  ): Promise<readonly Memory[]> {
    const repositories = runContext.repositories.map((each) => each.value);
    const rows = await this.context.db
      .select()
      .from(memory)
      .where(
        and(
          eq(memory.teamId, runContext.teamId.value),
          activeAsOf(asOf),
          runContext.lineId
            ? or(
                isNull(memory.lineId),
                eq(memory.lineId, runContext.lineId.value),
              )
            : isNull(memory.lineId),
          runContext.stationId
            ? or(
                isNull(memory.stationId),
                eq(memory.stationId, runContext.stationId.value),
              )
            : isNull(memory.stationId),
          repositories.length > 0
            ? or(
                isNull(memory.repository),
                inArray(memory.repository, repositories),
              )
            : isNull(memory.repository),
        ),
      );

    return rows.map(toMemory);
  }

  async withHandle(
    teamId: TeamId,
    handle: MemoryHandle,
  ): Promise<Memory | null> {
    const [row] = await this.context.db
      .select()
      .from(memory)
      .where(
        and(eq(memory.teamId, teamId.value), eq(memory.handle, handle.number)),
      )
      .limit(1);

    return row ? toMemory(row) : null;
  }

  async withHandles(
    teamId: TeamId,
    handles: readonly MemoryHandle[],
  ): Promise<readonly Memory[]> {
    if (handles.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(memory)
      .where(
        and(
          eq(memory.teamId, teamId.value),
          inArray(
            memory.handle,
            handles.map((each) => each.number),
          ),
        ),
      );

    return rows.map(toMemory);
  }

  async successorsOf(ids: readonly MemoryId[]): Promise<readonly Memory[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(memory)
      .where(
        inArray(
          memory.supersedes,
          ids.map((each) => each.value),
        ),
      );

    return rows.map(toMemory);
  }

  async findAll(ids: readonly MemoryId[]): Promise<readonly Memory[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(memory)
      .where(
        inArray(
          memory.id,
          ids.map((each) => each.value),
        ),
      );
    const found = new Map(rows.map((row) => [row.id, toMemory(row)]));

    return ids.flatMap((each) => {
      const match = found.get(each.value);
      return match ? [match] : [];
    });
  }

  async find(id: MemoryId): Promise<Memory | null> {
    const [row] = await this.context.db
      .select()
      .from(memory)
      .where(eq(memory.id, id.value))
      .limit(1);

    return row ? toMemory(row) : null;
  }
}
