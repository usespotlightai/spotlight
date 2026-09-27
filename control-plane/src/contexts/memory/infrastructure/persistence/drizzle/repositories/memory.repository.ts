import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryMovedOnError } from '@memory/domain/exceptions/memory-moved-on.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
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
import { and, eq } from 'drizzle-orm';

type Row = typeof memory.$inferSelect;

const toMemory = (row: Row): Memory => {
  if ((row.standing === 'retired') !== (row.retiredAt !== null)) {
    throw new InconsistentStateError(
      'memory',
      'stands while retired, or is retired without saying when',
    );
  }

  return Memory.rehydrate({
    id: MemoryId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    kind: row.kind,
    body: row.body,
    scope: MemoryScope.of({
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
      repository: row.repository ? Repository.of(row.repository) : null,
      paths: row.paths.map(MemoryPath.of),
    }),
    grounds: MemoryGrounds.of({
      taskId: TaskId.of(row.taskId),
      runId: RunId.of(row.runId),
      steps: row.steps,
      notes: row.notes,
    }),
    source: row.source,
    supersedes: row.supersedes ? MemoryId.of(row.supersedes) : null,
    approval: MemoryDecision.of({
      by: UserId.of(row.approvedBy),
      at: row.approvedAt,
    }),
    retirement: row.retiredAt
      ? {
          at: row.retiredAt,
          supersededBy: row.supersededBy ? MemoryId.of(row.supersededBy) : null,
        }
      : null,
    version: row.version,
  });
};

const changedColumnsOf = (held: Memory) => ({
  standing: held.standing,
  retiredAt: held.retirement?.at ?? null,
  supersededBy: held.retirement?.supersededBy?.value ?? null,
});

@Injectable()
export class DrizzleMemoryRepository implements MemoryRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Memory): Promise<void> {
    await this.context.run(async () => {
      await this.context.db.insert(memory).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        kind: added.kind,
        body: added.body,
        teamId: added.scope.teamId.value,
        lineId: added.scope.lineId,
        stationId: added.scope.stationId,
        repository: added.scope.repository?.value ?? null,
        paths: added.scope.paths.map((each) => each.value),
        taskId: added.grounds.taskId.value,
        runId: added.grounds.runId.value,
        steps: [...added.grounds.steps],
        notes: [...added.grounds.notes],
        source: added.source,
        supersedes: added.supersedes?.value ?? null,
        approvedBy: added.approval.by.value,
        approvedAt: added.approval.at,
        version: added.version,
        ...changedColumnsOf(added),
      });
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Memory): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .update(memory)
        .set({ version: saved.version + 1, ...changedColumnsOf(saved) })
        .where(
          and(eq(memory.id, saved.id.value), eq(memory.version, saved.version)),
        )
        .returning({ id: memory.id });

      if (written.length === 0) {
        throw new MemoryMovedOnError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
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
