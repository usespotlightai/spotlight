import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  ArchiveCursor,
  ArchiveDue,
  ArchiveReferencesPort,
  ArchivesDue,
} from '@runs/application/ports/archive-references.port';
import type { ArchiveRemovalCutoffs } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import { run } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import { startingPointHoldRun } from '@runs/infrastructure/persistence/drizzle/schemas/starting-point-hold.schema';
import { workingCopyArchive } from '@runs/infrastructure/persistence/drizzle/schemas/working-copy-archive.schema';
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

const newer = alias(workingCopyArchive, 'newer');

const startedFromIt = eq(run.startedFromArchiveId, workingCopyArchive.id);

const holdsTheRun = and(
  eq(startingPointHoldRun.workspaceId, run.workspaceId),
  eq(startingPointHoldRun.runId, run.id),
);

const sameKey = and(
  eq(newer.workspaceId, workingCopyArchive.workspaceId),
  eq(newer.workingCopyKey, workingCopyArchive.workingCopyKey),
  gt(newer.completedAt, workingCopyArchive.completedAt),
);

const dueOf = (row: {
  readonly id: string;
  readonly workingCopyKey: string;
  readonly grantedAt: Date;
  readonly supersededAt: Date | null;
  readonly lastStartedFromAt: Date | null;
  readonly pinned: boolean;
}): ArchiveDue => ({
  id: WorkingCopyArchiveId.of(row.id),
  workingCopyKey: WorkingCopyKey.parse(row.workingCopyKey),
  grantedAt: row.grantedAt,
  supersededAt: row.supersededAt,
  lastStartedFromAt: row.lastStartedFromAt,
  pinned: row.pinned,
});

const pastCursor = (after: ArchiveCursor | null) =>
  after
    ? or(
        gt(workingCopyArchive.grantedAt, after.grantedAt),
        and(
          eq(workingCopyArchive.grantedAt, after.grantedAt),
          gt(workingCopyArchive.id, after.id.value),
        ),
      )
    : undefined;

@Injectable()
export class DrizzleArchiveReferences implements ArchiveReferencesPort {
  constructor(private readonly context: DrizzleContext) {}

  private get db() {
    return this.context.db;
  }

  async of(id: WorkingCopyArchiveId): Promise<ArchiveDue | null> {
    const [row] = await this.selected()
      .where(eq(workingCopyArchive.id, id.value))
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
              isNull(workingCopyArchive.completedAt),
              lte(workingCopyArchive.grantedAt, grantedIncompleteBy),
            ),
            isNotNull(workingCopyArchive.completedAt),
          ),
        ),
      )
      .orderBy(asc(workingCopyArchive.grantedAt), asc(workingCopyArchive.id))
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
        id: workingCopyArchive.id,
        workingCopyKey: workingCopyArchive.workingCopyKey,
        grantedAt: workingCopyArchive.grantedAt,
        supersededAt: sql<Date | null>`(${this.db
          .select({ at: min(newer.completedAt) })
          .from(newer)
          .where(sameKey)})`.mapWith(workingCopyArchive.completedAt),
        lastStartedFromAt: sql<Date | null>`(${this.db
          .select({ at: max(run.startedFromAt) })
          .from(run)
          .where(startedFromIt)})`.mapWith(run.startedFromAt),
        pinned: exists(this.pinning()).mapWith(Boolean),
      })
      .from(workingCopyArchive);
  }

  private pinning() {
    return this.db
      .select({ one: sql`1` })
      .from(run)
      .innerJoin(startingPointHoldRun, holdsTheRun)
      .where(startedFromIt);
  }
}
