import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type {
  RunChanges,
  RunJournal,
} from '@work/application/contracts/run-journal.contract';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChangedPaths } from '@work/infrastructure/acp/changed-paths';
import { Told } from '@work/infrastructure/acp/told';
import { Reported } from '@work/infrastructure/otel/reported';
import {
  run,
  runJournalEntry,
} from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

const keptAttempt = or(
  eq(run.attempt, runJournalEntry.attempt),
  sql`${runJournalEntry.attempt} = any(${run.parkedAttempts})`,
);

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

export async function changesOfTask(
  db: DrizzleDatabase,
  taskId: TaskId,
): Promise<RunChanges[]> {
  const spoken = await db
    .select({ runId: runJournalEntry.runId, data: runJournalEntry.data })
    .from(runJournalEntry)
    .innerJoin(run, and(eq(run.id, runJournalEntry.runId), keptAttempt))
    .where(
      and(
        eq(run.taskId, taskId.value),
        eq(runJournalEntry.type, 'output'),
        isNull(runJournalEntry.message),
        isNotNull(runJournalEntry.data),
      ),
    )
    .orderBy(
      asc(run.createdAt),
      asc(run.id),
      asc(runJournalEntry.attempt),
      asc(runJournalEntry.seq),
    );

  const changed = new Map<string, ChangedPaths>();

  for (const row of spoken) {
    const paths = changed.get(row.runId) ?? new ChangedPaths();
    paths.take(row.data ?? '');
    changed.set(row.runId, paths);
  }

  const touching = [...changed].flatMap(([runId, paths]) => {
    const taken = paths.paths();
    return taken.length > 0 ? [{ runId, paths: taken }] : [];
  });

  if (touching.length === 0) {
    return [];
  }

  const checkouts = new Map(
    (
      await db
        .select({
          id: run.id,
          checkouts: sql<unknown>`${run.spec} -> 'checkouts'`,
        })
        .from(run)
        .where(
          inArray(
            run.id,
            touching.map((each) => each.runId),
          ),
        )
    ).map((each) => [
      each.id,
      RunSpecContract.checkoutFoldersIn(each.checkouts),
    ]),
  );

  return touching.map((each) => ({
    ...each,
    checkouts: checkouts.get(each.runId) ?? [],
  }));
}

export function journalsOfRuns(
  db: DrizzleDatabase,
  runIds: readonly string[],
): Promise<RunJournal[]> {
  return runIds.length === 0
    ? Promise.resolve([])
    : journalsOf(db, inArray(run.id, [...runIds]));
}

export async function journalOfRun(
  db: DrizzleDatabase,
  runId: RunId,
): Promise<RunJournal | null> {
  const [journal] = await journalsOf(db, eq(run.id, runId.value));
  return journal ?? null;
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
    .innerJoin(run, and(eq(run.id, runJournalEntry.runId), keptAttempt))
    .where(
      inArray(
        runJournalEntry.runId,
        runs.map((each) => each.id),
      ),
    )
    .orderBy(
      asc(runJournalEntry.runId),
      asc(runJournalEntry.attempt),
      asc(runJournalEntry.seq),
    );

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
