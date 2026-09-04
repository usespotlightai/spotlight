import type { RunJournalReaderPort } from '@application/ports/run-journal-reader.port';
import type { RunJournal } from '@domain/read-models/journal';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import { Told } from '@infrastructure/acp/told';
import { Reported } from '@infrastructure/otel/reported';
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
      .select({ id: run.id, attempt: run.attempt, createdAt: run.createdAt })
      .from(run)
      .where(eq(run.taskId, taskId.value))
      .orderBy(asc(run.createdAt));

    if (worked.length === 0) {
      return [];
    }

    // Every entry, not only the agent's: what the run was doing before it
    // started talking is where a slow prepare hides.
    const told = await this.db
      .select({
        runId: runEvent.runId,
        attempt: runEvent.attempt,
        type: runEvent.type,
        at: runEvent.at,
        message: runEvent.message,
        data: runEvent.data,
      })
      .from(runEvent)
      .where(
        inArray(
          runEvent.runId,
          worked.map((each) => each.id),
        ),
      )
      .orderBy(asc(runEvent.runId), asc(runEvent.attempt), asc(runEvent.seq));

    const began = new Map(worked.map((each) => [each.id, each.createdAt]));
    const journals = new Map<string, { told: Told; reported: Reported }>();

    for (const row of told) {
      const at = `${row.runId}:${row.attempt}`;
      const reading = journals.get(at) ?? {
        told: new Told(began.get(row.runId) ?? null),
        reported: new Reported(),
      };

      const event = {
        type: row.type,
        at: row.at,
        message: row.message,
        data: row.data,
      };

      // What the agent said, and what the harness said of itself. Two
      // vocabularies, kept apart until something means to read both.
      reading.told.take(event);
      reading.reported.take(event);
      journals.set(at, reading);
    }

    return [...journals.entries()].map(([at, reading]) => {
      const [runId, attempt] = at.split(':');

      return {
        runId: runId ?? '',
        attempt: Number(attempt ?? 1),
        steps: reading.told.steps(),
        spans: reading.reported.spans(),
        ms: reading.told.ms(),
        marks: reading.told.marks(),
        spent: reading.told.spent(),
        readable: reading.told.readable,
      };
    });
  }
}
