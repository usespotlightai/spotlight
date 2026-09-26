import { randomUUID } from 'node:crypto';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { DrizzleRunEventReader } from '@work/infrastructure/persistence/drizzle/readers/run-event.reader';
import { journalsOfChat } from '@work/infrastructure/persistence/drizzle/readers/run-journals';
import { DrizzleRunDigests } from '@work/infrastructure/persistence/drizzle/repositories/run-digest.repository';
import { DrizzleRunJournal } from '@work/infrastructure/persistence/drizzle/repositories/run-journal.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let held: TestDatabase;
let db: DrizzleDatabase;
let journal: DrizzleRunJournal;
let events: DrizzleRunEventReader;
let digests: DrizzleRunDigests;

beforeAll(async () => {
  held = await openDatabase('run_journal_attempts');
  db = held.db;
  journal = new DrizzleRunJournal(new DrizzleContext(db));
  events = new DrizzleRunEventReader(db, {
    mayView: async () => true,
  } as unknown as WorkspaceAccessPort);
  digests = new DrizzleRunDigests(db);
}, 60_000);

afterAll(async () => {
  await held?.close();
});

const hooks = (...messages: string[]) =>
  messages.map((message, index) => ({
    seq: index + 1,
    type: 'output',
    at: new Date(Date.UTC(2026, 8, 17, 9, 0, index)),
    message,
  }));

const chatRun = async () => {
  const chatId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.chat).values({
    id: chatId,
    workspaceId: 'ws_1',
    teamId: 'team_1',
    startedById: 'user_1',
    title: 'Planning',
    harness: 'dev',
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: 'ws_1',
    harness: 'dev',
    chatId,
    state: 'claimed',
    spec: {},
  });

  return { chatId: ChatId.of(chatId), runId: RunId.of(runId) };
};

const requeued = async (runId: RunId, attempt: number) => {
  await db
    .update(schema.run)
    .set({ attempt, state: 'claimed' })
    .where(eq(schema.run.id, runId.value));
};

const finished = async (runId: RunId) => {
  await db
    .update(schema.run)
    .set({ state: 'completed' })
    .where(eq(schema.run.id, runId.value));
};

describe('journalling a run that was tried again', () => {
  it('keeps every attempt, even where their entries share a place', async () => {
    const { runId } = await chatRun();

    await journal.append(RunAttempt.of(runId, 1), hooks('one-a', 'one-b'));
    await requeued(runId, 2);
    await journal.append(RunAttempt.of(runId, 2), hooks('two-a'));
    await journal.append(RunAttempt.of(runId, 2), hooks('again'));

    const kept = await db
      .select({
        attempt: schema.runJournalEntry.attempt,
        seq: schema.runJournalEntry.seq,
        message: schema.runJournalEntry.message,
      })
      .from(schema.runJournalEntry)
      .where(eq(schema.runJournalEntry.runId, runId.value))
      .orderBy(schema.runJournalEntry.attempt, schema.runJournalEntry.seq);

    expect(kept).toEqual([
      { attempt: 1, seq: 1, message: 'one-a' },
      { attempt: 1, seq: 2, message: 'one-b' },
      { attempt: 2, seq: 1, message: 'two-a' },
    ]);
  });

  it('replays the stream from the attempt asked for', async () => {
    const { runId } = await chatRun();

    await journal.append(RunAttempt.of(runId, 1), hooks('one-a', 'one-b'));
    await requeued(runId, 2);
    await journal.append(RunAttempt.of(runId, 2), hooks('two-a'));

    const backlog = await events.eventsSince(runId, 2, 0, 50);

    expect(backlog.map((each) => [each.attempt, each.message])).toEqual([
      [2, 'two-a'],
    ]);
  });

  it('reads the journal of the attempt the run is on', async () => {
    const { chatId, runId } = await chatRun();

    await journal.append(RunAttempt.of(runId, 1), hooks('one-a', 'one-b'));
    await requeued(runId, 2);
    await journal.append(RunAttempt.of(runId, 2), hooks('two-a'));

    const [read, ...more] = await journalsOfChat(db, chatId);

    expect(more).toEqual([]);
    expect(read?.attempt).toBe(2);
    expect(read?.steps.map((step) => step.text)).toEqual(['two-a']);
  });

  it('digests the attempt that finished, and again when a later one does', async () => {
    const { runId } = await chatRun();

    await journal.append(RunAttempt.of(runId, 1), hooks('one-a', 'one-b'));
    await finished(runId);
    await digests.ensure([runId]);

    expect((await digests.forRuns([runId])).get(runId.value)?.steps).toBe(2);

    await requeued(runId, 2);
    await journal.append(RunAttempt.of(runId, 2), hooks('two-a'));
    await finished(runId);
    await digests.ensure([runId]);

    expect((await digests.forRuns([runId])).get(runId.value)?.steps).toBe(1);
  });
});

describe('journalling aside what happened around a run', () => {
  const aside = (message: string, second: number) => ({
    type: 'hook.called',
    at: new Date(Date.UTC(2026, 8, 17, 9, 0, second)),
    message,
  });

  it('gives each entry its own place below the runner’s, however many arrive at once', async () => {
    const { runId } = await chatRun();
    const attempt = RunAttempt.of(runId, 1);

    await journal.append(attempt, [
      { seq: -1, type: 'provision.failed', at: new Date(), message: 'x' },
    ]);
    const placed = await Promise.all(
      Array.from({ length: 4 }, (_, each) =>
        journal.appendAside(attempt, aside(`hook-${each}`, each)),
      ),
    );

    expect(new Set(placed).size).toBe(4);
    expect(Math.max(...placed)).toBe(-1_000_000);
    expect(Math.min(...placed)).toBe(-1_000_003);

    const kept = await db
      .select({ seq: schema.runJournalEntry.seq })
      .from(schema.runJournalEntry)
      .where(eq(schema.runJournalEntry.runId, runId.value));
    expect(kept).toHaveLength(5);
  });

  it('replays what was kept aside whatever the cursor, in time among the runner’s entries', async () => {
    const { runId } = await chatRun();
    const attempt = RunAttempt.of(runId, 1);

    await journal.append(attempt, hooks('one', 'two', 'three'));
    await journal.appendAside(attempt, aside('between', 1));

    const all = await events.eventsSince(runId, 1, 0, 50);
    expect(all.map((each) => each.message)).toEqual([
      'one',
      'two',
      'between',
      'three',
    ]);

    const later = await events.eventsSince(runId, 1, 3, 50);
    expect(later.map((each) => [each.seq, each.message])).toEqual([
      [-1_000_000, 'between'],
    ]);
  });

  it('replays the newest of what was kept aside on a long run', async () => {
    const { runId } = await chatRun();
    await db.insert(schema.runJournalEntry).values(
      Array.from({ length: 205 }, (_, each) => ({
        runId: runId.value,
        attempt: 1,
        seq: -1_000_000 - each,
        type: 'hook.called',
        at: new Date(Date.UTC(2026, 8, 17, 9, 0, 0, each)),
        message: `hook-${each}`,
      })),
    );

    const replayed = await events.eventsSince(runId, 1, 0, 50);

    expect(replayed).toHaveLength(200);
    expect(replayed[0]?.message).toBe('hook-5');
    expect(replayed[199]?.message).toBe('hook-204');
  });
});
