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
import { ArchiveGrantee } from '@work/domain/value-objects/archive-grantee.vo';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
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
    title: 'Archive the workspace',
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

const archived = async (
  holder: ArchiveHolder,
  times: { grantedAt: Date; completedAt?: Date },
): Promise<WorkspaceArchive> => {
  const key =
    holder.kind === 'task'
      ? ResumeKey.forTask(holder.taskId.value)
      : ResumeKey.forChat(holder.chatId.value);
  const granted = WorkspaceArchive.grant({
    id: WorkspaceArchiveId.of(randomUUID()),
    workspaceId: WorkspaceId.of('ws_1'),
    resumeKey: key,
    holder,
    grantee: ArchiveGrantee.run(RunId.of(randomUUID())),
    size: STORED.size,
    digest: STORED.digest,
    at: times.grantedAt,
  });

  await archives.add(granted);

  if (!times.completedAt) {
    return granted;
  }

  await archives.save(granted.complete(STORED, times.completedAt));

  return (await archives.find(granted.id)) as WorkspaceArchive;
};

const dueNow = async () =>
  new Map(
    (await references.due(WorkspaceArchive.removalCutoffs(NOW), 500)).map(
      (each) => [each.id.value, each.facts],
    ),
  );

describe('storing workspace archives', () => {
  it('finds the newest completed archive of a piece of work, and nothing incomplete', async () => {
    const taskId = await aTask();
    const older = await archived(forTask(taskId), {
      grantedAt: ago(3 * HOUR),
      completedAt: ago(3 * HOUR),
    });
    const newer = await archived(forTask(taskId), {
      grantedAt: ago(2 * HOUR),
      completedAt: ago(2 * HOUR),
    });
    await archived(forTask(taskId), { grantedAt: ago(HOUR) });

    const found = await archives.newestCompleted(
      WorkspaceId.of('ws_1'),
      ResumeKey.forTask(taskId),
    );

    expect(found?.id.value).toBe(newer.id.value);
    expect(found?.completedAt).toEqual(ago(2 * HOUR));
    expect(found?.id.value).not.toBe(older.id.value);
  });

  it('writes an archive over only the version it read, and deletes one removed', async () => {
    const taskId = await aTask();
    const granted = await archived(forTask(taskId), { grantedAt: ago(HOUR) });

    await archives.save(granted.complete(STORED, ago(HOUR)));

    await expect(archives.save(granted.complete(STORED, NOW))).rejects.toThrow(
      WorkspaceArchiveVersionConflictError,
    );

    const completed = (await archives.find(granted.id)) as WorkspaceArchive;
    await archives.save(
      completed.remove(NOW, {
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

    const stillArchived = await archived(forTask(carryingOn), {
      grantedAt: ago(30 * DAY),
      completedAt: ago(30 * DAY),
    });
    const releasedLongAgo = await archived(forTask(finishedLongAgo), {
      grantedAt: ago(10 * DAY),
      completedAt: ago(10 * DAY),
    });
    const releasedLately = await archived(forTask(finishedLately), {
      grantedAt: ago(10 * DAY),
      completedAt: ago(10 * DAY),
    });
    const archivedAtAnotherStation = await archived(forTask(movedOn), {
      grantedAt: ago(10 * DAY),
      completedAt: ago(10 * DAY),
    });
    const releasedOfAChat = await archived(
      { kind: 'chat', chatId: ChatId.of(leftItsConversation) },
      { grantedAt: ago(10 * DAY), completedAt: ago(10 * DAY) },
    );
    const ofADeletedTask = await archived(forTask(deleted), {
      grantedAt: ago(HOUR),
      completedAt: ago(HOUR),
    });
    const ofADeletedChat = await archived(
      { kind: 'chat', chatId: ChatId.of(deletedChat) },
      { grantedAt: ago(HOUR), completedAt: ago(HOUR) },
    );
    const ofAChat = await archived(
      { kind: 'chat', chatId: ChatId.of(await aChat()) },
      { grantedAt: ago(30 * DAY), completedAt: ago(30 * DAY) },
    );
    const neverCompleted = await archived(forTask(carryingOn), {
      grantedAt: ago(2 * DAY),
    });
    const stillUploading = await archived(forTask(carryingOn), {
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
    expect(due.has(neverCompleted.id.value)).toBe(true);

    expect(due.has(stillArchived.id.value)).toBe(false);
    expect(due.has(archivedAtAnotherStation.id.value)).toBe(false);
    expect(due.has(releasedLately.id.value)).toBe(false);
    expect(due.has(ofAChat.id.value)).toBe(false);
    expect(due.has(stillUploading.id.value)).toBe(false);

    for (const id of [
      releasedLongAgo,
      releasedOfAChat,
      ofADeletedTask,
      ofADeletedChat,
      neverCompleted,
    ]) {
      const archive = (await archives.find(id.id)) as WorkspaceArchive;
      const facts = due.get(id.id.value);

      expect(facts && archive.removableAt(NOW, facts)).toBe(true);
    }
  });

  it('retains an archive a task run started from for thirty days after the latest such start', async () => {
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

    const startedLately = await archived(forTask(await aTask(finished)), {
      grantedAt: ago(40 * DAY),
      completedAt: ago(40 * DAY),
    });
    await startedFrom(startedLately, ago(35 * DAY));
    await startedFrom(startedLately, ago(5 * DAY));

    const startedLongAgo = await archived(forTask(await aTask(finished)), {
      grantedAt: ago(40 * DAY),
      completedAt: ago(40 * DAY),
    });
    await startedFrom(startedLongAgo, ago(31 * DAY));

    const superseding = await aTask();
    const supersededButStarted = await archived(forTask(superseding), {
      grantedAt: ago(3 * HOUR),
      completedAt: ago(3 * HOUR),
    });
    await archived(forTask(superseding), {
      grantedAt: ago(2 * HOUR),
      completedAt: ago(2 * HOUR),
    });
    await startedFrom(supersededButStarted, ago(DAY));

    const ofADeletedTask = await archived(forTask(randomUUID()), {
      grantedAt: ago(2 * DAY),
      completedAt: ago(2 * DAY),
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

  it('releases an archive an hour after a newer one of the same work is completed', async () => {
    const taskId = await aTask();
    const superseded = await archived(forTask(taskId), {
      grantedAt: ago(3 * HOUR),
      completedAt: ago(3 * HOUR),
    });
    const current = await archived(forTask(taskId), {
      grantedAt: ago(2 * HOUR),
      completedAt: ago(2 * HOUR),
    });
    const lately = await aTask();
    const justSuperseded = await archived(forTask(lately), {
      grantedAt: ago(HOUR),
      completedAt: ago(HOUR),
    });
    await archived(forTask(lately), {
      grantedAt: ago(10 * 60_000),
      completedAt: ago(10 * 60_000),
    });

    const due = await dueNow();

    expect(due.get(superseded.id.value)?.supersededAt).toEqual(ago(2 * HOUR));
    expect(due.has(current.id.value)).toBe(false);
    expect(due.has(justSuperseded.id.value)).toBe(false);
  });
});
