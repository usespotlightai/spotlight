import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  ArchiveDue,
  ArchiveReferencesPort,
} from '@work/application/ports/archive-references.port';
import type { ArchiveRemovalCutoffs } from '@work/domain/aggregates/workspace-archive.aggregate';
import type { HolderState } from '@work/domain/value-objects/archive-holder.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { startingPointHold } from '@work/infrastructure/persistence/drizzle/schemas/starting-point-hold.schema';
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
  max,
  min,
  not,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const newer = alias(workspaceArchive, 'newer');

const startedFromIt = eq(run.startedFromArchiveId, workspaceArchive.id);

const holdsTheRun = and(
  eq(startingPointHold.workspaceId, run.workspaceId),
  sql`${startingPointHold.runIds} @> ARRAY[${run.id}]`,
);

const sameResume = and(
  eq(newer.workspaceId, workspaceArchive.workspaceId),
  eq(newer.resumeKey, workspaceArchive.resumeKey),
  gt(newer.completedAt, workspaceArchive.completedAt),
);

interface HolderRow {
  readonly taskId: string | null;
  readonly liveTask: string | null;
  readonly taskFinishedAt: Date | null;
  readonly taskUpdatedAt: Date | null;
  readonly liveChat: string | null;
  readonly chatSession: string | null;
  readonly chatUpdatedAt: Date | null;
}

const holderOf = (row: HolderRow): HolderState | null => {
  if (row.taskId) {
    return row.liveTask && row.taskUpdatedAt
      ? {
          kind: 'task',
          finished: row.taskFinishedAt !== null,
          changedAt: row.taskUpdatedAt,
        }
      : null;
  }

  return row.liveChat && row.chatUpdatedAt
    ? {
        kind: 'chat',
        conversing: row.chatSession !== null,
        changedAt: row.chatUpdatedAt,
      }
    : null;
};

@Injectable()
export class DrizzleArchiveReferences implements ArchiveReferencesPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async due(
    {
      grantedIncompleteBy,
      supersededBy,
      releasedBy,
      startedFromBy,
    }: ArchiveRemovalCutoffs,
    limit: number,
  ): Promise<readonly ArchiveDue[]> {
    const rows = await this.db
      .select({
        id: workspaceArchive.id,
        taskId: workspaceArchive.taskId,
        liveTask: task.id,
        taskFinishedAt: task.finishedAt,
        taskUpdatedAt: task.updatedAt,
        liveChat: chat.id,
        chatSession: chat.sessionId,
        chatUpdatedAt: chat.updatedAt,
        supersededAt: sql<Date | null>`(${this.db
          .select({ at: min(newer.completedAt) })
          .from(newer)
          .where(sameResume)})`.mapWith(workspaceArchive.completedAt),
        lastStartedFromAt: sql<Date | null>`(${this.db
          .select({ at: max(run.startedFromAt) })
          .from(run)
          .where(startedFromIt)})`.mapWith(run.startedFromAt),
        pinned: exists(this.pinning()).mapWith(Boolean),
      })
      .from(workspaceArchive)
      .leftJoin(task, eq(task.id, workspaceArchive.taskId))
      .leftJoin(chat, eq(chat.id, workspaceArchive.chatId))
      .where(
        or(
          and(
            isNull(workspaceArchive.completedAt),
            lte(workspaceArchive.grantedAt, grantedIncompleteBy),
          ),
          and(
            isNotNull(workspaceArchive.completedAt),
            or(
              and(isNotNull(workspaceArchive.taskId), isNull(task.id)),
              and(isNotNull(workspaceArchive.chatId), isNull(chat.id)),
            ),
          ),
          and(
            isNotNull(workspaceArchive.completedAt),
            not(
              exists(
                this.db
                  .select({ one: sql`1` })
                  .from(run)
                  .where(
                    and(startedFromIt, gt(run.startedFromAt, startedFromBy)),
                  ),
              ),
            ),
            not(exists(this.pinning())),
            or(
              exists(
                this.db
                  .select({ one: sql`1` })
                  .from(newer)
                  .where(and(sameResume, lte(newer.completedAt, supersededBy))),
              ),
              and(
                isNotNull(task.finishedAt),
                lte(task.updatedAt, releasedBy),
                lte(workspaceArchive.completedAt, releasedBy),
              ),
              and(
                isNotNull(chat.id),
                isNull(chat.sessionId),
                lte(chat.updatedAt, releasedBy),
                lte(workspaceArchive.completedAt, releasedBy),
              ),
            ),
          ),
        ),
      )
      .orderBy(asc(workspaceArchive.grantedAt))
      .limit(limit);

    return rows.map((row) => ({
      id: WorkspaceArchiveId.of(row.id),
      facts: {
        holder: holderOf(row),
        supersededAt: row.supersededAt,
        lastStartedFromAt: row.lastStartedFromAt,
        pinned: row.pinned,
      },
    }));
  }

  private pinning() {
    return this.db
      .select({ one: sql`1` })
      .from(run)
      .innerJoin(startingPointHold, holdsTheRun)
      .where(startedFromIt);
  }
}
