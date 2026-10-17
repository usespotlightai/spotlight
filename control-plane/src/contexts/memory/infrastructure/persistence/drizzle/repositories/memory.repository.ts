import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryVersionConflictError } from '@memory/domain/exceptions/memory-version-conflict.error';
import type {
  MemoryCriteria,
  MemoryRepository,
} from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryRetirement } from '@memory/domain/value-objects/memory-retirement.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { RunSite } from '@memory/domain/value-objects/run-site';
import { memory } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';

type Row = typeof memory.$inferSelect;

const MAX_LISTED = 500;

const groundsOf = (row: Row): MemoryGrounds | null => {
  const { taskId, runId, steps, notes } = row;

  if (taskId && runId && steps && notes) {
    return MemoryGrounds.of({
      taskId: TaskId.of(taskId),
      runId: RunId.of(runId),
      steps,
      notes,
    });
  }

  if (taskId || runId || steps || notes) {
    throw new InconsistentStateError(
      'memory',
      'rests on part of a run, but not all of what it cites',
    );
  }

  return null;
};

const toMemory = (row: Row): Memory => {
  if ((row.standing === 'retired') !== (row.retiredAt !== null)) {
    throw new InconsistentStateError(
      'memory',
      'stands while retired, or is retired without saying when',
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
      lineId: row.lineId,
      stationId: row.stationId,
      repository: row.repository ? Repository.of(row.repository) : null,
      paths: row.paths.map(MemoryPath.of),
    }),
    grounds: groundsOf(row),
    source: row.source,
    supersedes: row.supersedes ? MemoryId.of(row.supersedes) : null,
    approval: MemoryDecision.of({
      by: UserId.of(row.approvedBy),
      at: row.approvedAt,
    }),
    retirement: row.retiredAt
      ? MemoryRetirement.rehydrate({
          at: row.retiredAt,
          by: row.retiredBy ? UserId.of(row.retiredBy) : null,
          reason: row.retireReason,
          supersededBy: row.supersededBy ? MemoryId.of(row.supersededBy) : null,
        })
      : null,
    version: row.version,
  });
};

const changedColumnsOf = (held: Memory) => ({
  standing: held.standing,
  retiredAt: held.retirement?.at ?? null,
  retiredBy: held.retirement?.by?.value ?? null,
  retireReason: held.retirement?.reason ?? null,
  supersededBy: held.retirement?.supersededBy?.value ?? null,
});

export const standingWhen = (at: Date | null) =>
  at
    ? and(
        lte(memory.approvedAt, at),
        or(isNull(memory.retiredAt), gt(memory.retiredAt, at)),
      )
    : eq(memory.standing, 'stands');

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
          lineId: added.scope.lineId,
          stationId: added.scope.stationId,
          repository: added.scope.repository?.value ?? null,
          paths: added.scope.paths.map((each) => each.value),
          taskId: added.grounds?.taskId.value ?? null,
          runId: added.grounds?.runId.value ?? null,
          steps: added.grounds ? [...added.grounds.steps] : null,
          notes: added.grounds ? [...added.grounds.notes] : null,
          source: added.source,
          supersedes: added.supersedes?.value ?? null,
          approvedBy: added.approval.by.value,
          approvedAt: added.approval.at,
          version: added.version,
          ...changedColumnsOf(added),
        })
        .onConflictDoNothing({ target: memory.supersedes })
        .returning({ id: memory.id });

      if (written.length === 0) {
        throw new MemoryVersionConflictError(
          added.supersedes?.value ?? added.id.value,
        );
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Memory): Promise<void> {
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

  async ofTeam(
    teamId: TeamId,
    criteria: MemoryCriteria,
  ): Promise<readonly Memory[]> {
    const rows = await this.context.db
      .select()
      .from(memory)
      .where(
        and(
          eq(memory.teamId, teamId.value),
          eq(memory.standing, criteria.standing),
          criteria.kind ? eq(memory.kind, criteria.kind) : undefined,
          criteria.lineId ? eq(memory.lineId, criteria.lineId) : undefined,
          criteria.stationId
            ? eq(memory.stationId, criteria.stationId)
            : undefined,
          criteria.repository
            ? eq(memory.repository, criteria.repository)
            : undefined,
          criteria.path
            ? sql`exists (select 1 from jsonb_array_elements_text(${memory.paths}) as held(path) where starts_with(held.path, ${criteria.path}))`
            : undefined,
        ),
      )
      .orderBy(
        criteria.standing === 'retired'
          ? desc(memory.retiredAt)
          : desc(memory.approvedAt),
      )
      .limit(MAX_LISTED);

    return rows.map(toMemory);
  }

  async nextHandle(): Promise<MemoryHandle> {
    const result = await this.context.db.execute<{ next: string }>(
      sql`select nextval('memory_handle_seq') as next`,
    );

    const [row] = result.rows;

    if (!row) {
      throw new Error('The memory handle sequence gave no number');
    }

    return MemoryHandle.of(Number(row.next));
  }

  async mayReach(
    site: RunSite,
    standingAt: Date | null = null,
  ): Promise<readonly Memory[]> {
    const repositories = site.repositories.map((each) => each.value);
    const rows = await this.context.db
      .select()
      .from(memory)
      .where(
        and(
          eq(memory.teamId, site.teamId.value),
          standingWhen(standingAt),
          site.lineId
            ? or(isNull(memory.lineId), eq(memory.lineId, site.lineId))
            : isNull(memory.lineId),
          site.stationId
            ? or(isNull(memory.stationId), eq(memory.stationId, site.stationId))
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
      const held = found.get(each.value);
      return held ? [held] : [];
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
