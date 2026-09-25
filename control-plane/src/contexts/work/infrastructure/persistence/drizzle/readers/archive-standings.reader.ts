import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  ArchiveDue,
  ArchiveStandingsPort,
} from '@work/application/ports/archive-standings.port';
import type { HolderState } from '@work/domain/value-objects/archive-holder.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workspaceArchive } from '@work/infrastructure/persistence/drizzle/schemas/workspace-archive.schema';
import {
  and,
  asc,
  eq,
  exists,
  gt,
  isNotNull,
  isNull,
  lte,
  min,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

const newer = alias(workspaceArchive, 'newer');

const sameContinuity = and(
  eq(newer.workspaceId, workspaceArchive.workspaceId),
  eq(newer.continuityKey, workspaceArchive.continuityKey),
  gt(newer.sealedAt, workspaceArchive.sealedAt),
);

const taskLetGo = or(
  isNotNull(task.finishedAt),
  ne(task.stationId, workspaceArchive.stationId),
  isNull(task.sessionId),
);

interface HolderRow {
  readonly taskId: string | null;
  readonly heldTask: string | null;
  readonly taskStation: string | null;
  readonly taskSession: string | null;
  readonly taskFinishedAt: Date | null;
  readonly taskUpdatedAt: Date | null;
  readonly heldChat: string | null;
  readonly chatSession: string | null;
  readonly chatUpdatedAt: Date | null;
}

const holderOf = (row: HolderRow): HolderState | null => {
  if (row.taskId) {
    return row.heldTask && row.taskStation && row.taskUpdatedAt
      ? {
          stationId: StationId.of(row.taskStation),
          conversing: row.taskSession !== null,
          finished: row.taskFinishedAt !== null,
          changedAt: row.taskUpdatedAt,
        }
      : null;
  }

  return row.heldChat && row.chatUpdatedAt
    ? {
        stationId: null,
        conversing: row.chatSession !== null,
        finished: false,
        changedAt: row.chatUpdatedAt,
      }
    : null;
};

@Injectable()
export class DrizzleArchiveStandings implements ArchiveStandingsPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async due(now: Date, limit: number): Promise<readonly ArchiveDue[]> {
    const hourAgo = new Date(now.getTime() - HOUR_MS);
    const dayAgo = new Date(now.getTime() - DAY_MS);
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

    const rows = await this.db
      .select({
        id: workspaceArchive.id,
        taskId: workspaceArchive.taskId,
        heldTask: task.id,
        taskStation: task.stationId,
        taskSession: task.sessionId,
        taskFinishedAt: task.finishedAt,
        taskUpdatedAt: task.updatedAt,
        heldChat: chat.id,
        chatSession: chat.sessionId,
        chatUpdatedAt: chat.updatedAt,
        supersededAt: sql<Date | null>`(${this.db
          .select({ at: min(newer.sealedAt) })
          .from(newer)
          .where(sameContinuity)})`.mapWith(workspaceArchive.sealedAt),
      })
      .from(workspaceArchive)
      .leftJoin(task, eq(task.id, workspaceArchive.taskId))
      .leftJoin(chat, eq(chat.id, workspaceArchive.chatId))
      .where(
        or(
          and(
            isNull(workspaceArchive.sealedAt),
            lte(workspaceArchive.grantedAt, dayAgo),
          ),
          and(
            isNotNull(workspaceArchive.sealedAt),
            or(
              exists(
                this.db
                  .select({ one: sql`1` })
                  .from(newer)
                  .where(and(sameContinuity, lte(newer.sealedAt, hourAgo))),
              ),
              and(isNotNull(workspaceArchive.taskId), isNull(task.id)),
              and(isNotNull(workspaceArchive.chatId), isNull(chat.id)),
              and(
                isNotNull(task.id),
                taskLetGo,
                lte(task.updatedAt, weekAgo),
                lte(workspaceArchive.sealedAt, weekAgo),
              ),
              and(
                isNotNull(chat.id),
                isNull(chat.sessionId),
                lte(chat.updatedAt, weekAgo),
                lte(workspaceArchive.sealedAt, weekAgo),
              ),
            ),
          ),
        ),
      )
      .orderBy(asc(workspaceArchive.grantedAt))
      .limit(limit);

    return rows.map((row) => ({
      id: WorkspaceArchiveId.of(row.id),
      facts: { holder: holderOf(row), supersededAt: row.supersededAt },
    }));
  }
}
