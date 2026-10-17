import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { ChangesGuardedElsewhereError } from '@replays/domain/exceptions/changes-guarded-elsewhere.error';
import { ReplaySetVersionConflictError } from '@replays/domain/exceptions/replay-set-version-conflict.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import {
  replaySet,
  replaySetEntry,
} from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, inArray } from 'drizzle-orm';

type SetRow = typeof replaySet.$inferSelect;

type EntryRow = typeof replaySetEntry.$inferSelect;

const GUARDS_CHANGES_INDEX = 'replay_set_guards_changes_idx';

const toSet = (row: SetRow, entries: readonly EntryRow[]): ReplaySet =>
  ReplaySet.rehydrate({
    id: ReplaySetId.of(row.id),
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
    },
    name: ReplaySetName.of(row.name),
    entries: entries
      .filter((each) => each.setId === row.id)
      .map((each) =>
        ReplaySetEntry.of({
          runId: RunId.of(each.runId),
          taskId: TaskId.of(each.taskId),
          addedAt: each.addedAt,
        }),
      ),
    guardsChanges: row.guardsChanges,
    createdAt: row.createdAt,
    stationGoneAt: row.stationGoneAt,
    version: row.version,
  });

@Injectable()
export class DrizzleReplaySetRepository implements ReplaySetRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(id: ReplaySetId): Promise<ReplaySet | null> {
    const [found] = await this.withEntries(eq(replaySet.id, id.value));

    return found ?? null;
  }

  findMany(ids: readonly ReplaySetId[]): Promise<readonly ReplaySet[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.withEntries(
      inArray(replaySet.id, [...new Set(ids.map((each) => each.value))]),
    );
  }

  async locked(id: ReplaySetId): Promise<ReplaySet | null> {
    const [found] = await this.withEntries(eq(replaySet.id, id.value), true);

    return found ?? null;
  }

  ofLine(lineId: string): Promise<readonly ReplaySet[]> {
    return this.withEntries(eq(replaySet.lineId, lineId));
  }

  atStation(stationId: string): Promise<readonly ReplaySet[]> {
    return this.withEntries(eq(replaySet.stationId, stationId));
  }

  async add(added: ReplaySet): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db.insert(replaySet).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        teamId: added.teamId.value,
        lineId: added.station.lineId,
        stationId: added.station.stationId,
        name: added.name.value,
        guardsChanges: added.guardsChanges,
        createdAt: added.createdAt,
        version: added.version,
      });
      await this.writeEntries(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: ReplaySet): Promise<void> {
    await this.context.inTransaction(async () => {
      const at = and(
        eq(replaySet.id, saved.id.value),
        eq(replaySet.version, saved.version),
      );
      const written = saved.isDeleted
        ? await this.context.db
            .delete(replaySet)
            .where(at)
            .returning({ id: replaySet.id })
        : await this.context.db
            .update(replaySet)
            .set({
              name: saved.name.value,
              guardsChanges: saved.guardsChanges,
              stationGoneAt: saved.stationGoneAt,
              version: saved.version + 1,
            })
            .where(at)
            .returning({ id: replaySet.id })
            .catch((error: unknown) => {
              if (violates(error, UNIQUE_VIOLATION, GUARDS_CHANGES_INDEX)) {
                throw new ChangesGuardedElsewhereError(saved.station.stationId);
              }
              throw error;
            });

      if (written.length === 0) {
        throw new ReplaySetVersionConflictError(saved.id.value);
      }

      if (!saved.isDeleted) {
        await this.writeEntries(saved);
      }
      await this.events.dispatch(saved.pullEvents());
    });
  }

  ofTeam(teamId: TeamId): Promise<readonly ReplaySet[]> {
    return this.withEntries(eq(replaySet.teamId, teamId.value));
  }

  private async writeEntries(set: ReplaySet): Promise<void> {
    await this.context.db
      .delete(replaySetEntry)
      .where(eq(replaySetEntry.setId, set.id.value));

    if (set.entries.length > 0) {
      await this.context.db.insert(replaySetEntry).values(
        set.entries.map((each) => ({
          setId: set.id.value,
          runId: each.runId.value,
          taskId: each.taskId.value,
          addedAt: each.addedAt,
        })),
      );
    }
  }

  private async withEntries(
    where: ReturnType<typeof eq>,
    locked = false,
  ): Promise<readonly ReplaySet[]> {
    const query = this.context.db
      .select()
      .from(replaySet)
      .where(where)
      .orderBy(asc(replaySet.createdAt), asc(replaySet.id));
    const rows = locked ? await query.for('update') : await query;

    if (rows.length === 0) {
      return [];
    }

    const entries = await this.context.db
      .select()
      .from(replaySetEntry)
      .where(
        inArray(
          replaySetEntry.setId,
          rows.map((each) => each.id),
        ),
      )
      .orderBy(asc(replaySetEntry.addedAt), asc(replaySetEntry.runId));

    return rows.map((row) => toSet(row, entries));
  }
}
