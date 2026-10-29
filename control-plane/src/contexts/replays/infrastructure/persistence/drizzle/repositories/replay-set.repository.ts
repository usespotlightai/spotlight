import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  ReplaySet,
  type ReplaySetRefresh,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplaySetVersionConflictError } from '@replays/domain/exceptions/replay-set-version-conflict.error';
import { StationHasReplaySetError } from '@replays/domain/exceptions/station-has-replay-set.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { RefreshCutoff } from '@replays/domain/services/kept-set-refresh';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { DISPATCHING_REPLAY_STATES } from '@replays/domain/value-objects/replay-state';
import { ACTIVE_SEARCH_STATES } from '@replays/domain/value-objects/search-state';
import {
  replay,
  replayCheck,
  replaySearch,
  replaySet,
  replaySetEntry,
  type StoredSetRefresh,
} from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lt,
  notExists,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

type SetRow = typeof replaySet.$inferSelect;

type EntryRow = typeof replaySetEntry.$inferSelect;

const STATION_INDEX = 'replay_set_station_idx';

const refreshOf = (stored: StoredSetRefresh | null): ReplaySetRefresh | null =>
  stored && {
    at: new Date(stored.at),
    added: stored.added.map((each) => RunId.of(each)),
    removed: stored.removed.map((each) => RunId.of(each)),
  };

const storedRefreshOf = (
  refresh: ReplaySetRefresh | null,
): StoredSetRefresh | null =>
  refresh && {
    at: refresh.at.toISOString(),
    added: refresh.added.map((each) => each.value),
    removed: refresh.removed.map((each) => each.value),
  };

const toSet = (row: SetRow, entries: readonly EntryRow[]): ReplaySet =>
  ReplaySet.rehydrate({
    id: ReplaySetId.of(row.id),
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
    },
    entries: entries
      .filter((each) => each.setId === row.id)
      .map((each) =>
        ReplaySetEntry.of({
          runId: RunId.of(each.runId),
          taskId: TaskId.of(each.taskId),
          endedAt: each.endedAt,
          addedAt: each.addedAt,
        }),
      ),
    createdAt: row.createdAt,
    refreshedAt: row.refreshedAt,
    lastRefresh: refreshOf(row.lastRefresh),
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

  async ofStation(stationId: string): Promise<ReplaySet | null> {
    const [found] = await this.withEntries(eq(replaySet.stationId, stationId));

    return found ?? null;
  }

  async dueForRefresh(
    cutoff: RefreshCutoff,
    limit: number,
  ): Promise<readonly ReplaySet[]> {
    const db = this.context.db;
    const entries = sql`(select count(*) from ${replaySetEntry} where ${replaySetEntry.setId} = ${replaySet.id})`;
    const rows = await db
      .select()
      .from(replaySet)
      .where(
        and(
          isNull(replaySet.stationGoneAt),
          or(
            isNull(replaySet.refreshedAt),
            lt(replaySet.refreshedAt, cutoff.before),
            and(
              lt(replaySet.refreshedAt, cutoff.unfilledBefore),
              sql`${entries} < ${cutoff.size}`,
            ),
          ),
          notExists(
            db
              .select({ id: replaySearch.id })
              .from(replaySearch)
              .where(
                and(
                  eq(replaySearch.setId, replaySet.id),
                  inArray(replaySearch.state, [...ACTIVE_SEARCH_STATES]),
                ),
              ),
          ),
          notExists(
            db
              .select({ id: replay.id })
              .from(replay)
              .where(
                and(
                  eq(replay.setId, replaySet.id),
                  inArray(replay.state, [...DISPATCHING_REPLAY_STATES]),
                ),
              ),
          ),
          notExists(
            db
              .select({ id: replayCheck.id })
              .from(replayCheck)
              .where(
                and(
                  eq(replayCheck.setId, replaySet.id),
                  eq(replayCheck.baseline, 'awaiting'),
                ),
              ),
          ),
        ),
      )
      .orderBy(sql`${replaySet.refreshedAt} asc nulls first`, asc(replaySet.id))
      .limit(limit);

    return this.setsOf(rows);
  }

  async add(added: ReplaySet): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context
        .inSavepoint(() =>
          this.context.db.insert(replaySet).values({
            id: added.id.value,
            workspaceId: added.workspaceId.value,
            teamId: added.teamId.value,
            lineId: added.station.lineId,
            stationId: added.station.stationId,
            createdAt: added.createdAt,
            refreshedAt: added.refreshedAt,
            lastRefresh: storedRefreshOf(added.lastRefresh),
            version: added.version,
          }),
        )
        .catch((error: unknown) => {
          if (violates(error, UNIQUE_VIOLATION, STATION_INDEX)) {
            throw new StationHasReplaySetError(added.station.stationId);
          }
          throw error;
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
              refreshedAt: saved.refreshedAt,
              lastRefresh: storedRefreshOf(saved.lastRefresh),
              stationGoneAt: saved.stationGoneAt,
              version: saved.version + 1,
            })
            .where(at)
            .returning({ id: replaySet.id });

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
          endedAt: each.endedAt,
          addedAt: each.addedAt,
        })),
      );
    }
  }

  private async withEntries(
    where: SQL | undefined,
    locked = false,
  ): Promise<readonly ReplaySet[]> {
    const query = this.context.db
      .select()
      .from(replaySet)
      .where(where)
      .orderBy(asc(replaySet.createdAt), asc(replaySet.id));

    return this.setsOf(locked ? await query.for('update') : await query);
  }

  private async setsOf(rows: readonly SetRow[]): Promise<readonly ReplaySet[]> {
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
