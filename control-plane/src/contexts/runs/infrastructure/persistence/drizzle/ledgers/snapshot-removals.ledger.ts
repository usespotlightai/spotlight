import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { SnapshotRemovalsPort } from '@runs/application/ports/snapshot-removals.port';
import { SnapshotRemoval } from '@runs/domain/value-objects/snapshot-removal.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { snapshotRemoval } from '@runs/infrastructure/persistence/drizzle/schemas/snapshot-removal.schema';
import { WorkingCopyStoreName } from '@shared-kernel/domain/value-objects/working-copy-names.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleSnapshotRemovals implements SnapshotRemovalsPort {
  constructor(private readonly context: DrizzleContext) {}

  async queue(removal: SnapshotRemoval): Promise<void> {
    await this.context.db
      .insert(snapshotRemoval)
      .values({
        archiveId: removal.archiveId.value,
        workspaceId: removal.workspaceId.value,
        store: removal.store.value,
        queuedAt: removal.queuedAt,
      })
      .onConflictDoNothing();
  }

  async due(
    workspaceId: WorkspaceId,
    store: WorkingCopyStoreName,
    limit: number,
  ): Promise<readonly SnapshotRemoval[]> {
    const rows = await this.context.db
      .select()
      .from(snapshotRemoval)
      .where(
        and(
          eq(snapshotRemoval.workspaceId, workspaceId.value),
          eq(snapshotRemoval.store, store.value),
        ),
      )
      .orderBy(asc(snapshotRemoval.queuedAt), asc(snapshotRemoval.archiveId))
      .limit(limit);

    return rows.map((row) =>
      SnapshotRemoval.of({
        archiveId: WorkingCopyArchiveId.of(row.archiveId),
        workspaceId: WorkspaceId.of(row.workspaceId),
        store: WorkingCopyStoreName.of(row.store),
        queuedAt: row.queuedAt,
      }),
    );
  }

  async forget(
    workspaceId: WorkspaceId,
    store: WorkingCopyStoreName,
    archiveId: WorkingCopyArchiveId,
  ): Promise<boolean> {
    const forgotten = await this.context.db
      .delete(snapshotRemoval)
      .where(
        and(
          eq(snapshotRemoval.archiveId, archiveId.value),
          eq(snapshotRemoval.workspaceId, workspaceId.value),
          eq(snapshotRemoval.store, store.value),
        ),
      )
      .returning({ archiveId: snapshotRemoval.archiveId });

    return forgotten.length > 0;
  }
}
