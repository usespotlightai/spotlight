import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import { WorkspaceArchiveVersionConflictError } from '@work/domain/exceptions/workspace-archive-version-conflict.error';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveGrantee } from '@work/domain/value-objects/archive-grantee.vo';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { workspaceArchive } from '@work/infrastructure/persistence/drizzle/schemas/workspace-archive.schema';
import { and, desc, eq, isNotNull } from 'drizzle-orm';

type Row = typeof workspaceArchive.$inferSelect;

const holderOf = (row: Row): ArchiveHolder => {
  if (row.taskId) {
    return { kind: 'task', taskId: TaskId.of(row.taskId) };
  }

  if (row.chatId) {
    return { kind: 'chat', chatId: ChatId.of(row.chatId) };
  }

  throw new InconsistentStateError(
    'workspace archive',
    `belongs to neither a task nor a chat (${row.id})`,
  );
};

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

const toArchive = (row: Row): WorkspaceArchive =>
  WorkspaceArchive.rehydrate({
    id: WorkspaceArchiveId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    resumeKey: ResumeKey.of(row.resumeKey),
    holder: holderOf(row),
    grantedTo: granteeOf(row),
    size: ArchiveSize.of(row.size),
    digest: ArchiveDigest.of(row.sha256),
    grantedAt: row.grantedAt,
    completedAt: row.completedAt,
    version: row.version,
  });

const holderColumns = (holder: ArchiveHolder) =>
  holder.kind === 'task'
    ? { taskId: holder.taskId.value, chatId: null }
    : { taskId: null, chatId: holder.chatId.value };

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
        resumeKey: added.resumeKey.value,
        ...holderColumns(added.holder),
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
    resumeKey: ResumeKey,
  ): Promise<WorkspaceArchive | null> {
    const [row] = await this.context.db
      .select()
      .from(workspaceArchive)
      .where(
        and(
          eq(workspaceArchive.workspaceId, workspaceId.value),
          eq(workspaceArchive.resumeKey, resumeKey.value),
          isNotNull(workspaceArchive.completedAt),
        ),
      )
      .orderBy(desc(workspaceArchive.completedAt))
      .limit(1);

    return row ? toArchive(row) : null;
  }
}
