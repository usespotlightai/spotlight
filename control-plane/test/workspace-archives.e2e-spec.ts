import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type StoredArchive,
  WorkspaceArchive,
} from '@work/domain/aggregates/workspace-archive.aggregate';
import { WorkspaceArchiveVersionConflictError } from '@work/domain/exceptions/workspace-archive-version-conflict.error';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { DrizzleArchiveReferences } from '@work/infrastructure/persistence/drizzle/readers/archive-references.reader';
import { DrizzleWorkspaceArchiveRepository } from '@work/infrastructure/persistence/drizzle/repositories/workspace-archive.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-09-25T12:00:00.000Z');
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);

const SHA256 = 'c'.repeat(64);
const STORED: StoredArchive = {
  size: ArchiveSize.of(4_096),
  digest: ArchiveDigest.of(SHA256),
};

let database: TestDatabase;
let db: DrizzleDatabase;
let archives: DrizzleWorkspaceArchiveRepository;
let references: DrizzleArchiveReferences;
let stationId: string;
let otherStationId: string;

beforeAll(async () => {
  database = await openDatabase('workspace_archives');
  db = database.db;
  archives = new DrizzleWorkspaceArchiveRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  references = new DrizzleArchiveReferences(db);

  const lineId = randomUUID();
  stationId = randomUUID();
  otherStationId = randomUUID();

  await db.insert(schema.line).values({
    id: lineId,
    key: 'delivery',
    workspaceId: 'ws_1',
    teamId: 'team_1',
    name: 'Delivery',
  });
  await db.insert(schema.station).values([
    { id: stationId, key: 'build', lineId, name: 'Build', position: 0 },
    { id: otherStationId, key: 'ship', lineId, name: 'Ship', position: 1 },
  ]);
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const aTask = async (
  state: {
    stationId?: string;
    sessionId?: string | null;
    finishedAt?: Date | null;
    updatedAt?: Date;
  } = {},
): Promise<string> => {
  const id = randomUUID();

  await db.insert(schema.task).values({
    id,
    openedFrom: 'person',
    workspaceId: 'ws_1',
    stationId: state.stationId ?? stationId,
    title: 'Keep the workspace',
    sessionId: state.sessionId === undefined ? 'session_1' : state.sessionId,
    finishedAt: state.finishedAt ?? null,
    updatedAt: state.updatedAt ?? ago(DAY),
  });

  return id;
};

const aChat = async (
  sessionId: string | null = 'session_1',
  updatedAt: Date = NOW,
) => {
  const id = randomUUID();

  await db.insert(schema.chat).values({
    id,
    workspaceId: 'ws_1',
    teamId: 'team_1',
    startedById: 'user_1',
    title: 'Planning',
    harness: 'dev',
    sessionId,
    updatedAt,
  });

  return id;
};

const forTask = (taskId: string): ArchiveHolder => ({
  kind: 'task',
  taskId: TaskId.of(taskId),
});

const kept = async (
  holder: ArchiveHolder,
  times: { grantedAt: Date; sealedAt?: Date },
): Promise<WorkspaceArchive> => {
  const continuity =
    holder.kind === 'task'
      ? ContinuityKey.forTask(holder.taskId.value)
      : ContinuityKey.forChat(holder.chatId.value);
  const granted = WorkspaceArchive.grant({
    id: WorkspaceArchiveId.of(randomUUID()),
    workspaceId: WorkspaceId.of('ws_1'),
    continuity,
    holder,
    run: RunId.of(randomUUID()),
    size: STORED.size,
    digest: STORED.digest,
    at: times.grantedAt,
  });

  await archives.add(granted);

  if (!times.sealedAt) {
    return granted;
  }

  await archives.save(granted.seal(STORED, times.sealedAt));

  return (await archives.find(granted.id)) as WorkspaceArchive;
};

const dueNow = async () =>
  new Map(
    (await references.due(WorkspaceArchive.removalCutoffs(NOW), 500)).map(
      (each) => [each.id.value, each.facts],
    ),
  );

describe('keeping workspace archives', () => {
  it('finds the newest sealed archive of a piece of work, and nothing unsealed', async () => {
    const taskId = await aTask();
    const older = await kept(forTask(taskId), {
      grantedAt: ago(3 * HOUR),
      sealedAt: ago(3 * HOUR),
    });
    const newer = await kept(forTask(taskId), {
      grantedAt: ago(2 * HOUR),
      sealedAt: ago(2 * HOUR),
    });
    await kept(forTask(taskId), { grantedAt: ago(HOUR) });

    const found = await archives.newestSealed(
      WorkspaceId.of('ws_1'),
      ContinuityKey.forTask(taskId),
    );

    expect(found?.id.value).toBe(newer.id.value);
    expect(found?.sealedAt).toEqual(ago(2 * HOUR));
    expect(found?.id.value).not.toBe(older.id.value);
  });

  it('writes an archive over only the version it read, and forgets one removed', async () => {
    const taskId = await aTask();
    const granted = await kept(forTask(taskId), { grantedAt: ago(HOUR) });

    await archives.save(granted.seal(STORED, ago(HOUR)));

    await expect(archives.save(granted.seal(STORED, NOW))).rejects.toThrow(
      WorkspaceArchiveVersionConflictError,
    );

    const sealed = (await archives.find(granted.id)) as WorkspaceArchive;
    await archives.save(
      sealed.remove(NOW, {
        holder: null,
        supersededAt: null,
        lastStartedFromAt: null,
        pinned: false,
      }),
    );

    await expect(archives.find(granted.id)).resolves.toBeNull();
  });

  it('releases archives no later run will restore, and keeps the rest', async () => {
    const carryingOn = await aTask();
    const finishedLongAgo = await aTask({
      finishedAt: ago(9 * DAY),
      updatedAt: ago(9 * DAY),
    });
    const finishedLately = await aTask({
      finishedAt: ago(2 * DAY),
      updatedAt: ago(2 * DAY),
    });
    const movedOn = await aTask({
      stationId: otherStationId,
      sessionId: null,
      updatedAt: ago(8 * DAY),
    });
    const leftItsConversation = await aChat(null, ago(8 * DAY));
    const deleted = randomUUID();
    const deletedChat = randomUUID();

    const stillKept = await kept(forTask(carryingOn), {
      grantedAt: ago(30 * DAY),
      sealedAt: ago(30 * DAY),
    });
    const releasedLongAgo = await kept(forTask(finishedLongAgo), {
      grantedAt: ago(10 * DAY),
      sealedAt: ago(10 * DAY),
    });
    const releasedLately = await kept(forTask(finishedLately), {
      grantedAt: ago(10 * DAY),
      sealedAt: ago(10 * DAY),
    });
    const keptAtAnotherStation = await kept(forTask(movedOn), {
      grantedAt: ago(10 * DAY),
      sealedAt: ago(10 * DAY),
    });
    const releasedOfAChat = await kept(
      { kind: 'chat', chatId: ChatId.of(leftItsConversation) },
      { grantedAt: ago(10 * DAY), sealedAt: ago(10 * DAY) },
    );
    const ofADeletedTask = await kept(forTask(deleted), {
      grantedAt: ago(HOUR),
      sealedAt: ago(HOUR),
    });
    const ofADeletedChat = await kept(
      { kind: 'chat', chatId: ChatId.of(deletedChat) },
      { grantedAt: ago(HOUR), sealedAt: ago(HOUR) },
    );
    const ofAChat = await kept(
      { kind: 'chat', chatId: ChatId.of(await aChat()) },
      { grantedAt: ago(30 * DAY), sealedAt: ago(30 * DAY) },
    );
    const neverSealed = await kept(forTask(carryingOn), {
      grantedAt: ago(2 * DAY),
    });
    const stillUploading = await kept(forTask(carryingOn), {
      grantedAt: ago(HOUR),
    });

    const due = await dueNow();

    expect(due.get(releasedLongAgo.id.value)?.holder).toEqual({
      kind: 'task',
      finished: true,
      changedAt: ago(9 * DAY),
    });
    expect(due.get(releasedOfAChat.id.value)?.holder).toEqual({
      kind: 'chat',
      conversing: false,
      changedAt: ago(8 * DAY),
    });
    expect(due.get(ofADeletedTask.id.value)?.holder).toBeNull();
    expect(due.get(ofADeletedChat.id.value)?.holder).toBeNull();
    expect(due.has(neverSealed.id.value)).toBe(true);

    expect(due.has(stillKept.id.value)).toBe(false);
    expect(due.has(keptAtAnotherStation.id.value)).toBe(false);
    expect(due.has(releasedLately.id.value)).toBe(false);
    expect(due.has(ofAChat.id.value)).toBe(false);
    expect(due.has(stillUploading.id.value)).toBe(false);

    for (const id of [
      releasedLongAgo,
      releasedOfAChat,
      ofADeletedTask,
      ofADeletedChat,
      neverSealed,
    ]) {
      const archive = (await archives.find(id.id)) as WorkspaceArchive;
      const facts = due.get(id.id.value);

      expect(facts && archive.removableAt(NOW, facts)).toBe(true);
    }
  });

  it('keeps an archive a task run started from for thirty days after the latest such start', async () => {
    const startedFrom = async (archive: WorkspaceArchive, at: Date) => {
      await db.insert(schema.run).values({
        id: randomUUID(),
        workspaceId: 'ws_1',
        harness: 'dev',
        state: 'completed',
        spec: {},
        startedFromArchiveId: archive.id.value,
        startedFromCheckouts: [],
        startedFromAttempt: 1,
        startedFromAt: at,
      });
    };
    const finished = { finishedAt: ago(40 * DAY), updatedAt: ago(40 * DAY) };

    const startedLately = await kept(forTask(await aTask(finished)), {
      grantedAt: ago(40 * DAY),
      sealedAt: ago(40 * DAY),
    });
    await startedFrom(startedLately, ago(35 * DAY));
    await startedFrom(startedLately, ago(5 * DAY));

    const startedLongAgo = await kept(forTask(await aTask(finished)), {
      grantedAt: ago(40 * DAY),
      sealedAt: ago(40 * DAY),
    });
    await startedFrom(startedLongAgo, ago(31 * DAY));

    const superseding = await aTask();
    const supersededButStarted = await kept(forTask(superseding), {
      grantedAt: ago(3 * HOUR),
      sealedAt: ago(3 * HOUR),
    });
    await kept(forTask(superseding), {
      grantedAt: ago(2 * HOUR),
      sealedAt: ago(2 * HOUR),
    });
    await startedFrom(supersededButStarted, ago(DAY));

    const ofADeletedTask = await kept(forTask(randomUUID()), {
      grantedAt: ago(2 * DAY),
      sealedAt: ago(2 * DAY),
    });
    await startedFrom(ofADeletedTask, ago(DAY));

    const due = await dueNow();

    expect(due.has(startedLately.id.value)).toBe(false);
    expect(due.has(supersededButStarted.id.value)).toBe(false);
    expect(due.get(startedLongAgo.id.value)?.lastStartedFromAt).toEqual(
      ago(31 * DAY),
    );
    expect(due.get(ofADeletedTask.id.value)).toEqual({
      holder: null,
      supersededAt: null,
      lastStartedFromAt: ago(DAY),
      pinned: false,
    });

    for (const archive of [startedLongAgo, ofADeletedTask]) {
      const found = (await archives.find(archive.id)) as WorkspaceArchive;
      const facts = due.get(archive.id.value);

      expect(facts && found.removableAt(NOW, facts)).toBe(true);
    }
  });

  it('releases an archive an hour after a newer one of the same work is sealed', async () => {
    const taskId = await aTask();
    const superseded = await kept(forTask(taskId), {
      grantedAt: ago(3 * HOUR),
      sealedAt: ago(3 * HOUR),
    });
    const current = await kept(forTask(taskId), {
      grantedAt: ago(2 * HOUR),
      sealedAt: ago(2 * HOUR),
    });
    const lately = await aTask();
    const justSuperseded = await kept(forTask(lately), {
      grantedAt: ago(HOUR),
      sealedAt: ago(HOUR),
    });
    await kept(forTask(lately), {
      grantedAt: ago(10 * 60_000),
      sealedAt: ago(10 * 60_000),
    });

    const due = await dueNow();

    expect(due.get(superseded.id.value)?.supersededAt).toEqual(ago(2 * HOUR));
    expect(due.has(current.id.value)).toBe(false);
    expect(due.has(justSuperseded.id.value)).toBe(false);
  });
});
