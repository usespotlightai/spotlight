import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import { WorkingCopyArchiveVersionConflictError } from '@runs/domain/exceptions/working-copy-archive-version-conflict.error';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import { workingCopyArchive } from '@runs/infrastructure/persistence/drizzle/schemas/working-copy-archive.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';

type Row = typeof workingCopyArchive.$inferSelect;

const granteeOf = (row: Row): ArchiveGrantee => {
  if (row.grantedToRunId) {
    return ArchiveGrantee.run(RunId.of(row.grantedToRunId));
  }

  if (row.grantedToSandboxId) {
    return ArchiveGrantee.sandbox(SandboxId.of(row.grantedToSandboxId));
  }

  throw new InconsistentStateError(
    'working copy archive',
    `was granted to neither a run nor a sandbox (${row.id})`,
  );
};

export const toArchive = (row: Row): WorkingCopyArchive =>
  WorkingCopyArchive.rehydrate({
    id: WorkingCopyArchiveId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    workingCopyKey: WorkingCopyKey.parse(row.workingCopyKey),
    grantedTo: granteeOf(row),
    size: ArchiveSize.of(row.size),
    digest: ArchiveDigest.of(row.sha256),
    grantedAt: row.grantedAt,
    completedAt: row.completedAt,
    version: row.version,
  });

@Injectable()
export class DrizzleWorkingCopyArchiveRepository
  implements WorkingCopyArchiveRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: WorkingCopyArchive): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db.insert(workingCopyArchive).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        workingCopyKey: added.workingCopyKey.value,
        grantedToRunId: added.grantedTo.runId?.value ?? null,
        grantedToSandboxId: added.grantedTo.sandboxId?.value ?? null,
        size: added.size.bytes,
        sha256: added.digest.sha256,
        grantedAt: added.grantedAt,
        completedAt: added.completedAt,
        version: added.version,
      });

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: WorkingCopyArchive): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        eq(workingCopyArchive.id, saved.id.value),
        eq(workingCopyArchive.version, saved.version),
      );
      const written = saved.isDiscarded
        ? await this.context.db
            .delete(workingCopyArchive)
            .where(matching)
            .returning({ id: workingCopyArchive.id })
        : await this.context.db
            .update(workingCopyArchive)
            .set({ completedAt: saved.completedAt, version: saved.version + 1 })
            .where(matching)
            .returning({ id: workingCopyArchive.id });

      if (written.length === 0) {
        throw new WorkingCopyArchiveVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: WorkingCopyArchiveId): Promise<WorkingCopyArchive | null> {
    const [row] = await this.context.db
      .select()
      .from(workingCopyArchive)
      .where(eq(workingCopyArchive.id, id.value))
      .limit(1);

    return row ? toArchive(row) : null;
  }

  async newestCompleted(
    workspaceId: WorkspaceId,
    workingCopyKey: WorkingCopyKey,
  ): Promise<WorkingCopyArchive | null> {
    const [row] = await this.context.db
      .select()
      .from(workingCopyArchive)
      .where(
        and(
          eq(workingCopyArchive.workspaceId, workspaceId.value),
          eq(workingCopyArchive.workingCopyKey, workingCopyKey.value),
          isNotNull(workingCopyArchive.completedAt),
        ),
      )
      .orderBy(desc(workingCopyArchive.completedAt))
      .limit(1);

    return row ? toArchive(row) : null;
  }

  async completedKeysAmong(
    workspaceId: WorkspaceId,
    keys: readonly WorkingCopyKey[],
  ): Promise<readonly WorkingCopyKey[]> {
    const among = [...new Set(keys.map((each) => each.value))];

    if (among.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .selectDistinct({ key: workingCopyArchive.workingCopyKey })
      .from(workingCopyArchive)
      .where(
        and(
          eq(workingCopyArchive.workspaceId, workspaceId.value),
          inArray(workingCopyArchive.workingCopyKey, among),
          isNotNull(workingCopyArchive.completedAt),
        ),
      );

    return rows.map((row) => WorkingCopyKey.parse(row.key));
  }
}
