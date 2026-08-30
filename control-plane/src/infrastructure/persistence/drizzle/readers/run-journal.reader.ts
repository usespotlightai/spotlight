import type {
  RunJournal,
  RunJournalReaderPort,
} from '@application/ports/run-journal-reader.port';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import { Told } from '@infrastructure/acp/told';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  run,
  runEvent,
} from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { task } from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { workspaceMember } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleRunJournalReader implements RunJournalReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listForTask(
    taskId: TaskId,
    viewerId: UserId,
  ): Promise<RunJournal[] | null> {
    const [visible] = await this.db
      .select({ id: task.id })
      .from(task)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, task.workspaceId),
          eq(workspaceMember.userId, viewerId.value),
        ),
      )
      .where(eq(task.id, taskId.value))
      .limit(1);

    if (!visible) {
      return null;
    }

    const worked = await this.db
      .select({ id: run.id, attempt: run.attempt })
      .from(run)
      .where(eq(run.taskId, taskId.value))
      .orderBy(asc(run.createdAt));

    if (worked.length === 0) {
      return [];
    }

    const told = await this.db
      .select({
        runId: runEvent.runId,
        attempt: runEvent.attempt,
        at: runEvent.at,
        data: runEvent.data,
      })
      .from(runEvent)
      .where(
        and(
          inArray(
            runEvent.runId,
            worked.map((each) => each.id),
          ),
          eq(runEvent.type, 'output'),
        ),
      )
      .orderBy(asc(runEvent.runId), asc(runEvent.attempt), asc(runEvent.seq));

    const journals = new Map<string, Told>();
    for (const row of told) {
      const at = `${row.runId}:${row.attempt}`;
      const reading = journals.get(at) ?? new Told();
      reading.take(row.data, row.at);
      journals.set(at, reading);
    }

    return [...journals.entries()].map(([at, reading]) => {
      const [runId, attempt] = at.split(':');

      return {
        runId: runId ?? '',
        attempt: Number(attempt ?? 1),
        steps: reading.steps(),
        ms: reading.ms(),
        spent: reading.spent(),
        readable: reading.readable,
      };
    });
  }
}
