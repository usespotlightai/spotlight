import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunState } from '@work/domain/value-objects/run-state';
import { DrizzleHeldRunReader } from '@work/infrastructure/persistence/drizzle/readers/held-run.reader';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let held: TestDatabase;
let db: DrizzleDatabase;
let reader: DrizzleHeldRunReader;

beforeAll(async () => {
  held = await openDatabase('held_run_attachment');
  db = held.db;
  reader = new DrizzleHeldRunReader(db);
}, 60_000);

afterAll(async () => {
  await held?.close();
});

const RUNNER = 'runner_1';

const chatRun = async (state: RunState) => {
  const chatId = randomUUID();
  const runId = randomUUID();
  const attachmentId = randomUUID();

  await db.insert(schema.chat).values({
    id: chatId,
    workspaceId: 'ws_1',
    teamId: 'team_1',
    startedById: 'user_1',
    title: 'Planning',
    harness: 'dev',
  });
  await db.insert(schema.chatAttachment).values({
    id: attachmentId,
    chatId,
    messagePosition: 1,
    place: 0,
    name: 'screen.png',
    contentType: 'image/png',
    size: 10,
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: 'ws_1',
    harness: 'dev',
    chatId,
    state,
    claimedBy: RUNNER,
    spec: {},
  });

  return { runId: RunId.of(runId), attachmentId };
};

describe('reading a file given to a held run', () => {
  it('hands the runner holding the run a file its chat was given', async () => {
    const { runId, attachmentId } = await chatRun('claimed');

    const given = await reader.attachmentFor(
      runId,
      RunnerId.of(RUNNER),
      attachmentId,
    );

    expect(given?.attachment.id.value).toBe(attachmentId);
    expect(given?.workspaceId.value).toBe('ws_1');
  });

  it('refuses the runner of a run that has finished', async () => {
    const { runId, attachmentId } = await chatRun('completed');

    await expect(
      reader.attachmentFor(runId, RunnerId.of(RUNNER), attachmentId),
    ).resolves.toBeNull();
  });

  it('refuses another runner, and a file the run was not given', async () => {
    const { runId, attachmentId } = await chatRun('claimed');
    const other = await chatRun('claimed');

    await expect(
      reader.attachmentFor(runId, RunnerId.of('runner_2'), attachmentId),
    ).resolves.toBeNull();
    await expect(
      reader.attachmentFor(runId, RunnerId.of(RUNNER), other.attachmentId),
    ).resolves.toBeNull();
  });
});
