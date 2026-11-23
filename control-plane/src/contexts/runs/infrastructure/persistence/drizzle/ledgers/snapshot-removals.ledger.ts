import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  SnapshotRemoval,
  SnapshotRemovalsPort,
} from '@runs/application/ports/snapshot-removals.port';
import { snapshotRemoval } from '@runs/infrastructure/persistence/drizzle/schemas/snapshot-removal.schema';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleSnapshotRemovals implements SnapshotRemovalsPort {
  constructor(private readonly context: DrizzleContext) {}

  async queue(removal: SnapshotRemoval): Promise<void> {
    await this.context.db
      .insert(snapshotRemoval)
      .values({
        archiveId: removal.archiveId,
        workspaceId: removal.workspaceId.value,
        store: removal.store,
        snapshot: removal.snapshot,
        queuedAt: removal.queuedAt,
      })
      .onConflictDoNothing();
  }

  async due(
    workspaceId: WorkspaceId,
    store: string,
    limit: number,
  ): Promise<readonly SnapshotRemoval[]> {
    const rows = await this.context.db
      .select()
      .from(snapshotRemoval)
      .where(
        and(
          eq(snapshotRemoval.workspaceId, workspaceId.value),
          eq(snapshotRemoval.store, store),
        ),
      )
      .orderBy(asc(snapshotRemoval.queuedAt), asc(snapshotRemoval.archiveId))
      .limit(limit);

    return rows.map((row) => ({
      archiveId: row.archiveId,
      workspaceId: WorkspaceId.of(row.workspaceId),
      store: row.store,
      snapshot: row.snapshot,
      queuedAt: row.queuedAt,
    }));
  }

  async forget(
    workspaceId: WorkspaceId,
    store: string,
    archiveId: string,
  ): Promise<boolean> {
    const forgotten = await this.context.db
      .delete(snapshotRemoval)
      .where(
        and(
          eq(snapshotRemoval.archiveId, archiveId),
          eq(snapshotRemoval.workspaceId, workspaceId.value),
          eq(snapshotRemoval.store, store),
        ),
      )
      .returning({ archiveId: snapshotRemoval.archiveId });

    return forgotten.length > 0;
  }
}
