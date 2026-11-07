import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  ArchiveCursor,
  ArchiveReferencesPort,
  ArchivesDue,
} from '@work/application/ports/archive-references.port';
import type { ArchiveRemovalCutoffs } from '@work/domain/aggregates/workspace-archive.aggregate';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { WorkspaceKey } from '@work/domain/value-objects/workspace-key.vo';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { startingPointHoldRun } from '@work/infrastructure/persistence/drizzle/schemas/starting-point-hold.schema';
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
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const newer = alias(workspaceArchive, 'newer');

const startedFromIt = eq(run.startedFromArchiveId, workspaceArchive.id);

const holdsTheRun = and(
  eq(startingPointHoldRun.workspaceId, run.workspaceId),
  eq(startingPointHoldRun.runId, run.id),
);

const sameKey = and(
  eq(newer.workspaceId, workspaceArchive.workspaceId),
  eq(newer.workspaceKey, workspaceArchive.workspaceKey),
  gt(newer.completedAt, workspaceArchive.completedAt),
);

const pastCursor = (after: ArchiveCursor | null) =>
  after
    ? or(
        gt(workspaceArchive.grantedAt, after.grantedAt),
        and(
          eq(workspaceArchive.grantedAt, after.grantedAt),
          gt(workspaceArchive.id, after.id.value),
        ),
      )
    : undefined;

@Injectable()
export class DrizzleArchiveReferences implements ArchiveReferencesPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async due(
    { grantedIncompleteBy }: ArchiveRemovalCutoffs,
    after: ArchiveCursor | null,
    limit: number,
  ): Promise<ArchivesDue> {
    const rows = await this.db
      .select({
        id: workspaceArchive.id,
        workspaceKey: workspaceArchive.workspaceKey,
        grantedAt: workspaceArchive.grantedAt,
        supersededAt: sql<Date | null>`(${this.db
          .select({ at: min(newer.completedAt) })
          .from(newer)
          .where(sameKey)})`.mapWith(workspaceArchive.completedAt),
        lastStartedFromAt: sql<Date | null>`(${this.db
          .select({ at: max(run.startedFromAt) })
          .from(run)
          .where(startedFromIt)})`.mapWith(run.startedFromAt),
        pinned: exists(this.pinning()).mapWith(Boolean),
      })
      .from(workspaceArchive)
      .where(
        and(
          pastCursor(after),
          or(
            and(
              isNull(workspaceArchive.completedAt),
              lte(workspaceArchive.grantedAt, grantedIncompleteBy),
            ),
            isNotNull(workspaceArchive.completedAt),
          ),
        ),
      )
      .orderBy(asc(workspaceArchive.grantedAt), asc(workspaceArchive.id))
      .limit(limit);

    const due = rows.map((row) => ({
      id: WorkspaceArchiveId.of(row.id),
      workspaceKey: WorkspaceKey.parse(row.workspaceKey),
      grantedAt: row.grantedAt,
      supersededAt: row.supersededAt,
      lastStartedFromAt: row.lastStartedFromAt,
      pinned: row.pinned,
    }));
    const last = due[due.length - 1];

    return {
      due,
      next:
        due.length === limit && last
          ? { grantedAt: last.grantedAt, id: last.id }
          : null,
    };
  }

  private pinning() {
    return this.db
      .select({ one: sql`1` })
      .from(run)
      .innerJoin(startingPointHoldRun, holdsTheRun)
      .where(startedFromIt);
  }
}
