import type {
  RunEventReaderPort,
  WatchableRun,
} from '@application/ports/run-event-reader.port';
import type { RunEventView } from '@application/ports/run-stream.port';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  run,
  runEvent,
} from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { workspaceMember } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt } from 'drizzle-orm';

@Injectable()
export class DrizzleRunEventReader implements RunEventReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findForViewer(
    runId: RunId,
    viewerId: UserId,
  ): Promise<WatchableRun | null> {
    const [found] = await this.db
      .select({ id: run.id, attempt: run.attempt })
      .from(run)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, run.workspaceId),
          eq(workspaceMember.userId, viewerId.value),
        ),
      )
      .where(eq(run.id, runId.value))
      .limit(1);

    return found ?? null;
  }

  async eventsSince(
    runId: RunId,
    attempt: number,
    afterSeq: number,
    most: number,
  ): Promise<RunEventView[]> {
    const rows = await this.db
      .select({
        seq: runEvent.seq,
        type: runEvent.type,
        at: runEvent.at,
        message: runEvent.message,
        data: runEvent.data,
        offset: runEvent.offset,
      })
      .from(runEvent)
      .where(
        and(
          eq(runEvent.runId, runId.value),
          eq(runEvent.attempt, attempt),
          gt(runEvent.seq, afterSeq),
        ),
      )
      .orderBy(desc(runEvent.seq))
      .limit(most);

    return rows.reverse().map((row) => ({
      seq: row.seq,
      type: row.type,
      at: row.at.toISOString(),
      message: row.message ?? undefined,
      data: row.data ?? undefined,
      offset: row.offset ?? undefined,
    }));
  }
}
