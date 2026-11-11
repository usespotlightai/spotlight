import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { WorkingCopyArchiveStorePort } from '@runs/application/ports/working-copy-archive-store.port';
import { ArchiveHolders } from '@runs/application/services/archive-holders.service';
import { RemoveReleasedArchives } from '@runs/application/services/remove-released-archives.service';
import {
  type ArchiveFacts,
  type StoredArchive,
  WorkingCopyArchive,
} from '@runs/domain/aggregates/working-copy-archive.aggregate';
import { WorkingCopyArchiveVersionConflictError } from '@runs/domain/exceptions/working-copy-archive-version-conflict.error';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import { DrizzleArchiveReferenceLocks } from '@runs/infrastructure/persistence/drizzle/archive-reference-locks';
import { DrizzleArchiveReferences } from '@runs/infrastructure/persistence/drizzle/readers/archive-references.reader';
import { DrizzleWorkingCopyArchiveRepository } from '@runs/infrastructure/persistence/drizzle/repositories/working-copy-archive.repository';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DrizzleWorkArchiveHolders } from '@work/infrastructure/persistence/drizzle/readers/work-archive-holders.reader';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import { aRunOf } from './support/run-ended';
import { requestedByTask } from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';

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
let archives: DrizzleWorkingCopyArchiveRepository;
let references: DrizzleArchiveReferences;
let holders: ArchiveHolders;
let stationId: string;
let otherStationId: string;

beforeAll(async () => {
  database = await openDatabase('working_copy_archives');
  db = database.db;
  archives = new DrizzleWorkingCopyArchiveRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  references = new DrizzleArchiveReferences(new DrizzleContext(db));
  holders = new ArchiveHolders();
  holders.register(new DrizzleWorkArchiveHolders(db));

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
  await insertStations(db, [
    {
      id: stationId,
      key: 'build',
      workspaceId: 'ws_1',
      lineId,
      name: 'Build',
      position: 0,
    },
    {
      id: otherStationId,
      key: 'ship',
      workspaceId: 'ws_1',
      lineId,
      name: 'Ship',
      position: 1,
    },
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
    branch: `feat/test-${id}`,
    openedFrom: 'person',
    workspaceId: 'ws_1',
    stationId: state.stationId ?? stationId,
    title: 'Archive the working copy',
    sessionId: state.sessionId === undefined ? 'session_1' : state.sessionId,
    finishedAt: state.finishedAt ?? null,
    workingCopyReleasedAt: state.finishedAt ?? null,
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
    workingCopyReleasedAt: sessionId ? null : updatedAt,
    createdAt: updatedAt,
    updatedAt,
  });

  return id;
};

const forTask = (taskId: string): WorkingCopyKey =>
  WorkingCopyKey.of('work', `task-${taskId}`);

const forChat = (chatId: string): WorkingCopyKey =>
  WorkingCopyKey.of('work', `chat-${chatId}`);

const archived = async (
  key: WorkingCopyKey,
  times: { grantedAt: Date; completedAt?: Date },
): Promise<WorkingCopyArchive> => {
  const grantee = await aRunOf(db, { id: randomUUID(), workspaceId: 'ws_1' });
  const granted = WorkingCopyArchive.grant({
    id: WorkingCopyArchiveId.of(randomUUID()),
    workspaceId: WorkspaceId.of('ws_1'),
    workingCopyKey: key,
    held: true,
    grantee: ArchiveGrantee.run(RunId.of(grantee)),
    size: STORED.size,
    digest: STORED.digest,
    at: times.grantedAt,
  });

  await archives.add(granted);

  if (!times.completedAt) {
    return granted;
  }

  await archives.save(granted.complete(STORED, times.completedAt));

  return (await archives.find(granted.id)) as WorkingCopyArchive;
};

const factsNow = async () => {
  const page = await references.due(
    WorkingCopyArchive.removalCutoffs(NOW),
    null,
    500,
  );
  const held = await holders.stateOf(
    page.due.map((each) => each.workingCopyKey),
  );

  return new Map(
    page.due.map((each) => [
      each.id.value,
      {
        holder: held.get(each.workingCopyKey.value) ?? null,
        supersededAt: each.supersededAt,
        lastStartedFromAt: each.lastStartedFromAt,
        pinned: each.pinned,
      },
    ]),
  );
};

const dueNow = async () => {
  const facts = await factsNow();
  const due = new Map<string, ArchiveFacts>();

  for (const [id, each] of facts) {
    const archive = await archives.find(WorkingCopyArchiveId.of(id));

    if (archive?.removableAt(NOW, each)) {
      due.set(id, each);
    }
  }

  return due;
};

describe('storing working copy archives', () => {
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
      forTask(taskId),
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
      WorkingCopyArchiveVersionConflictError,
    );

    const completed = (await archives.find(granted.id)) as WorkingCopyArchive;
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
    const releasedOfAChat = await archived(forChat(leftItsConversation), {
      grantedAt: ago(10 * DAY),
      completedAt: ago(10 * DAY),
    });
    const ofADeletedTask = await archived(forTask(deleted), {
      grantedAt: ago(HOUR),
      completedAt: ago(HOUR),
    });
    const ofADeletedChat = await archived(forChat(deletedChat), {
      grantedAt: ago(HOUR),
      completedAt: ago(HOUR),
    });
    const ofAChat = await archived(forChat(await aChat()), {
      grantedAt: ago(30 * DAY),
      completedAt: ago(30 * DAY),
    });
    const neverCompleted = await archived(forTask(carryingOn), {
      grantedAt: ago(2 * DAY),
    });
    const stillUploading = await archived(forTask(carryingOn), {
      grantedAt: ago(HOUR),
    });

    const due = await dueNow();

    expect(due.get(releasedLongAgo.id.value)?.holder).toEqual({
      released: true,
      changedAt: ago(9 * DAY),
    });
    expect(due.get(releasedOfAChat.id.value)?.holder).toEqual({
      released: true,
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
      const archive = (await archives.find(id.id)) as WorkingCopyArchive;
      const facts = due.get(id.id.value);

      expect(facts && archive.removableAt(NOW, facts)).toBe(true);
    }
  });

  it('retains an archive a task run started from for thirty days after the latest such start', async () => {
    const startedFrom = async (archive: WorkingCopyArchive, at: Date) => {
      await db.insert(schema.run).values({
        id: randomUUID(),
        workspaceId: 'ws_1',
        harness: 'dev',
        state: 'completed',
        endedAt: new Date(),
        ...requestedByTask(randomUUID()),
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
      const found = (await archives.find(archive.id)) as WorkingCopyArchive;
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

  it('removes the archive of a task finished past the retention, and keeps the archive of a task opened again', async () => {
    const removedFromStore: string[] = [];
    const failures: unknown[] = [];
    const store: WorkingCopyArchiveStorePort = {
      grantUpload: async () => {
        throw new Error('nothing is uploaded here');
      },
      stored: async () => null,
      grantDownload: async () => {
        throw new Error('nothing is downloaded here');
      },
      remove: async (archive) => {
        removedFromStore.push(archive.id.value);
      },
    };
    const removal = new RemoveReleasedArchives(
      references,
      new DrizzleArchiveReferenceLocks(new DrizzleContext(db)),
      holders,
      archives,
      store,
      { now: () => NOW, sleep: async () => {} },
      {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: (fields) => failures.push(fields),
      },
    );
    const finished = await archived(
      forTask(
        await aTask({ finishedAt: ago(9 * DAY), updatedAt: ago(9 * DAY) }),
      ),
      { grantedAt: ago(10 * DAY), completedAt: ago(10 * DAY) },
    );
    const reopened = await archived(
      forTask(await aTask({ finishedAt: null, updatedAt: ago(DAY) })),
      { grantedAt: ago(10 * DAY), completedAt: ago(10 * DAY) },
    );

    await removal.processDue();

    expect(failures).toEqual([]);
    expect(await archives.find(finished.id)).toBeNull();
    expect(removedFromStore).toContain(finished.id.value);
    expect(await archives.find(reopened.id)).not.toBeNull();
    expect(removedFromStore).not.toContain(reopened.id.value);
  });
});
