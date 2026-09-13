import type { RunJournal } from '@application/contracts/run-journal.contract';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import { Told } from '@infrastructure/acp/told';
import { Reported } from '@infrastructure/otel/reported';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import {
  run,
  runEvent,
} from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { asc, eq, inArray } from 'drizzle-orm';

export async function journalsOfTask(
  db: DrizzleDatabase,
  taskId: TaskId,
): Promise<RunJournal[]> {
  const runs = await db
    .select({ id: run.id, attempt: run.attempt, createdAt: run.createdAt })
    .from(run)
    .where(eq(run.taskId, taskId.value))
    .orderBy(asc(run.createdAt));

  if (runs.length === 0) {
    return [];
  }

  const told = await db
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
        runs.map((each) => each.id),
      ),
    )
    .orderBy(asc(runEvent.runId), asc(runEvent.attempt), asc(runEvent.seq));

  const began = new Map(runs.map((each) => [each.id, each.createdAt]));
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
    };
  });
}
