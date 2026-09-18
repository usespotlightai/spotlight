import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { Told } from '@work/infrastructure/acp/told';
import { Reported } from '@work/infrastructure/otel/reported';
import {
  run,
  runJournalEntry,
} from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';

export function journalsOfTask(
  db: DrizzleDatabase,
  taskId: TaskId,
): Promise<RunJournal[]> {
  return journalsOf(db, eq(run.taskId, taskId.value));
}

export function journalsOfChat(
  db: DrizzleDatabase,
  chatId: ChatId,
): Promise<RunJournal[]> {
  return journalsOf(db, eq(run.chatId, chatId.value));
}

async function journalsOf(
  db: DrizzleDatabase,
  which: SQL,
): Promise<RunJournal[]> {
  const runs = await db
    .select({ id: run.id, attempt: run.attempt, createdAt: run.createdAt })
    .from(run)
    .where(which)
    .orderBy(asc(run.createdAt));

  if (runs.length === 0) {
    return [];
  }

  const told = await db
    .select({
      runId: runJournalEntry.runId,
      attempt: runJournalEntry.attempt,
      type: runJournalEntry.type,
      at: runJournalEntry.at,
      message: runJournalEntry.message,
      data: runJournalEntry.data,
    })
    .from(runJournalEntry)
    .innerJoin(
      run,
      and(
        eq(run.id, runJournalEntry.runId),
        eq(run.attempt, runJournalEntry.attempt),
      ),
    )
    .where(
      inArray(
        runJournalEntry.runId,
        runs.map((each) => each.id),
      ),
    )
    .orderBy(asc(runJournalEntry.runId), asc(runJournalEntry.seq));

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
