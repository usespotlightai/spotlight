import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  ArchiveCursor,
  ArchiveDue,
  ArchiveReferencesPort,
  ArchivesDue,
} from '@runs/application/ports/archive-references.port';
import type { ArchiveRemovalCutoffs } from '@runs/domain/aggregates/workspace-archive.aggregate';
import { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import { WorkspaceKey } from '@runs/domain/value-objects/workspace-key.vo';
import { run } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import { startingPointHoldRun } from '@runs/infrastructure/persistence/drizzle/schemas/starting-point-hold.schema';
import { workspaceArchive } from '@runs/infrastructure/persistence/drizzle/schemas/workspace-archive.schema';
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

const dueOf = (row: {
  readonly id: string;
  readonly workspaceKey: string;
  readonly grantedAt: Date;
  readonly supersededAt: Date | null;
  readonly lastStartedFromAt: Date | null;
  readonly pinned: boolean;
}): ArchiveDue => ({
  id: WorkspaceArchiveId.of(row.id),
  workspaceKey: WorkspaceKey.parse(row.workspaceKey),
  grantedAt: row.grantedAt,
  supersededAt: row.supersededAt,
  lastStartedFromAt: row.lastStartedFromAt,
  pinned: row.pinned,
});

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
  constructor(private readonly context: DrizzleContext) {}

  private get db() {
    return this.context.db;
  }

  async of(id: WorkspaceArchiveId): Promise<ArchiveDue | null> {
    const [row] = await this.selected()
      .where(eq(workspaceArchive.id, id.value))
      .limit(1);

    return row ? dueOf(row) : null;
  }

  async due(
    { grantedIncompleteBy }: ArchiveRemovalCutoffs,
    after: ArchiveCursor | null,
    limit: number,
  ): Promise<ArchivesDue> {
    const rows = await this.selected()
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

    const due = rows.map(dueOf);
    const last = due[due.length - 1];

    return {
      due,
      next:
        due.length === limit && last
          ? { grantedAt: last.grantedAt, id: last.id }
          : null,
    };
  }

  private selected() {
    return this.db
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
      .from(workspaceArchive);
  }

  private pinning() {
    return this.db
      .select({ one: sql`1` })
      .from(run)
      .innerJoin(startingPointHoldRun, holdsTheRun)
      .where(startedFromIt);
  }
}
