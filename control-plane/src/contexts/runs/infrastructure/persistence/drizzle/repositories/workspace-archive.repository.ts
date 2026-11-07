import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { WorkspaceArchive } from '@runs/domain/aggregates/workspace-archive.aggregate';
import { WorkspaceArchiveVersionConflictError } from '@runs/domain/exceptions/workspace-archive-version-conflict.error';
import type { WorkspaceArchiveRepository } from '@runs/domain/repositories/workspace-archive.repository';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import { WorkspaceKey } from '@runs/domain/value-objects/workspace-key.vo';
import { workspaceArchive } from '@runs/infrastructure/persistence/drizzle/schemas/workspace-archive.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq, isNotNull } from 'drizzle-orm';

type Row = typeof workspaceArchive.$inferSelect;

const granteeOf = (row: Row): ArchiveGrantee => {
  if (row.grantedToRunId) {
    return ArchiveGrantee.run(RunId.of(row.grantedToRunId));
  }

  if (row.grantedToSandboxId) {
    return ArchiveGrantee.sandbox(row.grantedToSandboxId);
  }

  throw new InconsistentStateError(
    'workspace archive',
    `was granted to neither a run nor a sandbox (${row.id})`,
  );
};

export const toArchive = (row: Row): WorkspaceArchive =>
  WorkspaceArchive.rehydrate({
    id: WorkspaceArchiveId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    workspaceKey: WorkspaceKey.parse(row.workspaceKey),
    grantedTo: granteeOf(row),
    size: ArchiveSize.of(row.size),
    digest: ArchiveDigest.of(row.sha256),
    grantedAt: row.grantedAt,
    completedAt: row.completedAt,
    version: row.version,
  });

@Injectable()
export class DrizzleWorkspaceArchiveRepository
  implements WorkspaceArchiveRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: WorkspaceArchive): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db.insert(workspaceArchive).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        workspaceKey: added.workspaceKey.value,
        grantedToRunId: added.grantedTo.runId?.value ?? null,
        grantedToSandboxId: added.grantedTo.sandboxId,
        size: added.size.bytes,
        sha256: added.digest.sha256,
        grantedAt: added.grantedAt,
        completedAt: added.completedAt,
        version: added.version,
      });

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: WorkspaceArchive): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        eq(workspaceArchive.id, saved.id.value),
        eq(workspaceArchive.version, saved.version),
      );
      const written = saved.isDiscarded
        ? await this.context.db
            .delete(workspaceArchive)
            .where(matching)
            .returning({ id: workspaceArchive.id })
        : await this.context.db
            .update(workspaceArchive)
            .set({ completedAt: saved.completedAt, version: saved.version + 1 })
            .where(matching)
            .returning({ id: workspaceArchive.id });

      if (written.length === 0) {
        throw new WorkspaceArchiveVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: WorkspaceArchiveId): Promise<WorkspaceArchive | null> {
    const [row] = await this.context.db
      .select()
      .from(workspaceArchive)
      .where(eq(workspaceArchive.id, id.value))
      .limit(1);

    return row ? toArchive(row) : null;
  }

  async newestCompleted(
    workspaceId: WorkspaceId,
    workspaceKey: WorkspaceKey,
  ): Promise<WorkspaceArchive | null> {
    const [row] = await this.context.db
      .select()
      .from(workspaceArchive)
      .where(
        and(
          eq(workspaceArchive.workspaceId, workspaceId.value),
          eq(workspaceArchive.workspaceKey, workspaceKey.value),
          isNotNull(workspaceArchive.completedAt),
        ),
      )
      .orderBy(desc(workspaceArchive.completedAt))
      .limit(1);

    return row ? toArchive(row) : null;
  }
}
