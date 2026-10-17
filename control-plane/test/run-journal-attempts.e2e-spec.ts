import { randomUUID } from 'node:crypto';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { DrizzleRunDigests } from '@work/infrastructure/persistence/drizzle/ledgers/run-digests.ledger';
import { DrizzleRunJournal } from '@work/infrastructure/persistence/drizzle/ledgers/run-journal.ledger';
import { DrizzleRunEventReader } from '@work/infrastructure/persistence/drizzle/readers/run-event.reader';
import { journalsOfChat } from '@work/infrastructure/persistence/drizzle/readers/run-journals';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let database: TestDatabase;
let db: DrizzleDatabase;
let journal: DrizzleRunJournal;
let events: DrizzleRunEventReader;
let digests: DrizzleRunDigests;

beforeAll(async () => {
  database = await openDatabase('run_journal_attempts');
  db = database.db;
  journal = new DrizzleRunJournal(new DrizzleContext(db));
  events = new DrizzleRunEventReader(db, {
    mayView: async () => true,
  } as unknown as WorkspaceAccessPort);
  digests = new DrizzleRunDigests(db, {
    skillHomes: () => ['.claude/skills'],
  } as unknown as HarnessLaunchPort);
}, 60_000);

afterAll(async () => {
  await database?.close();
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

describe('digesting a run that paused for a person', () => {
  const spoken = (seq: number, second: number) => ({
    seq,
    type: 'output',
    at: new Date(Date.UTC(2026, 8, 17, 9, 0, second)),
    data: Buffer.from(
      JSON.stringify({
        sessionId: 'session_1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: `said at ${second}` },
        },
      }),
    ).toString('base64'),
  });

  it('counts every attempt it kept, and none of the time it waited', async () => {
    const { runId } = await chatRun();

    await journal.append(RunAttempt.of(runId, 1), [spoken(1, 0), spoken(2, 4)]);
    await journal.appendAside(RunAttempt.of(runId, 1), {
      type: 'run.paused',
      at: new Date(Date.UTC(2026, 8, 17, 9, 0, 5)),
      message: 'Waiting for a person',
    });
    await db
      .update(schema.run)
      .set({ attempt: 2, parkedAttempts: [1], state: 'claimed' })
      .where(eq(schema.run.id, runId.value));
    await journal.append(RunAttempt.of(runId, 2), [
      spoken(1, 50),
      spoken(2, 53),
    ]);
    await finished(runId);
    await digests.ensure([runId]);

    const digest = (await digests.forRuns([runId])).get(runId.value);

    expect(digest?.steps).toBe(2);
    expect(digest?.ms).toBe(7_000);
  });
});

describe('digesting the tokens a run took', () => {
  const turned = (seq: number, usage: Record<string, number>) => ({
    seq,
    type: 'usage',
    at: new Date(Date.UTC(2026, 8, 17, 9, 0, seq)),
    data: Buffer.from(JSON.stringify(usage)).toString('base64'),
  });

  it('adds up the turns of every attempt it kept, count by count', async () => {
    const { runId } = await chatRun();

    await journal.append(RunAttempt.of(runId, 1), [
      turned(1, {
        inputTokens: 10,
        outputTokens: 20,
        cachedReadTokens: 3_000,
        cachedWriteTokens: 400,
        totalTokens: 3_430,
      }),
    ]);
    await db
      .update(schema.run)
      .set({ attempt: 2, parkedAttempts: [1], state: 'claimed' })
      .where(eq(schema.run.id, runId.value));
    await journal.append(RunAttempt.of(runId, 2), [
      turned(1, {
        inputTokens: 5,
        outputTokens: 7,
        cachedReadTokens: 2_000,
        cachedWriteTokens: 0,
        totalTokens: 2_012,
      }),
    ]);
    await finished(runId);
    await digests.ensure([runId]);

    const digest = (await digests.forRuns([runId])).get(runId.value);

    expect(digest?.tokens).toMatchObject({
      input: 15,
      output: 27,
      cacheRead: 5_000,
      cacheWrite: 400,
    });
  });

  it('stores what the harness never reported as unknown, not zero', async () => {
    const { runId } = await chatRun();

    await journal.append(RunAttempt.of(runId, 1), [
      turned(1, { inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
    ]);
    await finished(runId);
    await digests.ensure([runId]);

    const [stored] = await db
      .select({
        inputTokens: schema.runDigest.inputTokens,
        outputTokens: schema.runDigest.outputTokens,
        cacheReadTokens: schema.runDigest.cacheReadTokens,
        cacheWriteTokens: schema.runDigest.cacheWriteTokens,
      })
      .from(schema.runDigest)
      .where(eq(schema.runDigest.runId, runId.value));

    expect(stored).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    });
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
