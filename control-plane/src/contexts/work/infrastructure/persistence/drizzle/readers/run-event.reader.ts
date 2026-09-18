import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  RunEventReaderPort,
  WatchableRun,
} from '@work/application/ports/run-event-reader.port';
import type { RunEventView } from '@work/application/ports/run-stream.port';
import {
  run,
  runJournalEntry,
} from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, desc, eq, gt } from 'drizzle-orm';

@Injectable()
export class DrizzleRunEventReader implements RunEventReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(WORKSPACE_ACCESS) private readonly access: WorkspaceAccessPort,
  ) {}

  async findForViewer(
    runId: RunId,
    viewerId: UserId,
  ): Promise<WatchableRun | null> {
    const [found] = await this.db
      .select({
        id: run.id,
        attempt: run.attempt,
        workspaceId: run.workspaceId,
      })
      .from(run)
      .where(eq(run.id, runId.value))
      .limit(1);

    return found &&
      (await this.access.mayView(viewerId, WorkspaceId.of(found.workspaceId)))
      ? { id: found.id, attempt: found.attempt }
      : null;
  }

  async eventsSince(
    runId: RunId,
    attempt: number,
    afterSeq: number,
    most: number,
  ): Promise<RunEventView[]> {
    const rows = await this.db
      .select({
        attempt: runJournalEntry.attempt,
        seq: runJournalEntry.seq,
        type: runJournalEntry.type,
        at: runJournalEntry.at,
        message: runJournalEntry.message,
        data: runJournalEntry.data,
      })
      .from(runJournalEntry)
      .where(
        and(
          eq(runJournalEntry.runId, runId.value),
          eq(runJournalEntry.attempt, attempt),
          gt(runJournalEntry.seq, afterSeq),
        ),
      )
      .orderBy(desc(runJournalEntry.seq))
      .limit(most);

    return rows.reverse().map((row) => ({
      attempt: row.attempt,
      seq: row.seq,
      type: row.type,
      at: row.at.toISOString(),
      message: row.message ?? undefined,
      data: row.data ?? undefined,
    }));
  }
}
