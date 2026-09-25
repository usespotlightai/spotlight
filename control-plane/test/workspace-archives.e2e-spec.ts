import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type StoredArchive,
  WorkspaceArchive,
} from '@work/domain/aggregates/workspace-archive.aggregate';
import { WorkspaceArchiveMovedOnError } from '@work/domain/exceptions/workspace-archive-moved-on.error';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { DrizzleArchiveStandings } from '@work/infrastructure/persistence/drizzle/readers/archive-standings.reader';
import { DrizzleHeldRunReader } from '@work/infrastructure/persistence/drizzle/readers/held-run.reader';
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

let held: TestDatabase;
let db: DrizzleDatabase;
let archives: DrizzleWorkspaceArchiveRepository;
let standings: DrizzleArchiveStandings;
let runs: DrizzleHeldRunReader;
let stationId: string;
let otherStationId: string;

beforeAll(async () => {
  held = await openDatabase('workspace_archives');
  db = held.db;
  archives = new DrizzleWorkspaceArchiveRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  standings = new DrizzleArchiveStandings(db);
  runs = new DrizzleHeldRunReader(db);

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
  await held?.close();
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
    workspaceId: 'ws_1',
    stationId: state.stationId ?? stationId,
    title: 'Keep the workspace',
    sessionId: state.sessionId === undefined ? 'session_1' : state.sessionId,
    finishedAt: state.finishedAt ?? null,
    updatedAt: state.updatedAt ?? ago(DAY),
  });

  return id;
};

const aChat = async (sessionId: string | null = 'session_1') => {
  const id = randomUUID();

  await db.insert(schema.chat).values({
    id,
    workspaceId: 'ws_1',
    teamId: 'team_1',
    startedById: 'user_1',
    title: 'Planning',
    harness: 'dev',
    sessionId,
  });

  return id;
};

const forTask = (taskId: string): ArchiveHolder => ({
  kind: 'task',
  taskId: TaskId.of(taskId),
  stationId: StationId.of(stationId),
});

const kept = async (
  holder: ArchiveHolder,
  times: { grantedAt: Date; sealedAt?: Date },
): Promise<WorkspaceArchive> => {
  const continuity =
    holder.kind === 'task'
      ? ContinuityKey.for({
          taskId: holder.taskId.value,
          stationId: holder.stationId.value,
        })
      : ContinuityKey.forChat(holder.chatId.value);
  const granted = WorkspaceArchive.granted({
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

  await archives.save(granted.sealed(STORED, times.sealedAt));

  return (await archives.find(granted.id)) as WorkspaceArchive;
};

const dueNow = async () =>
  new Map(
    (await standings.due(NOW, 500)).map((each) => [each.id.value, each.facts]),
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
      ContinuityKey.for({ taskId, stationId }),
    );

    expect(found?.id.value).toBe(newer.id.value);
    expect(found?.sealedAt).toEqual(ago(2 * HOUR));
    expect(found?.id.value).not.toBe(older.id.value);
  });

  it('writes an archive over only the version it read, and forgets one removed', async () => {
    const taskId = await aTask();
    const granted = await kept(forTask(taskId), { grantedAt: ago(HOUR) });

    await archives.save(granted.sealed(STORED, ago(HOUR)));

    await expect(archives.save(granted.sealed(STORED, NOW))).rejects.toThrow(
      WorkspaceArchiveMovedOnError,
    );

    const sealed = (await archives.find(granted.id)) as WorkspaceArchive;
    await archives.save(sealed.removed());

    await expect(archives.find(granted.id)).resolves.toBeNull();
  });

  it('lets go of archives no later run will restore, and keeps the rest', async () => {
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
    const movedStillTalking = await aTask({
      stationId: otherStationId,
      sessionId: 'session_2',
      updatedAt: ago(8 * DAY),
    });
    const deleted = randomUUID();
    const deletedChat = randomUUID();

    const stillHeld = await kept(forTask(carryingOn), {
      grantedAt: ago(30 * DAY),
      sealedAt: ago(30 * DAY),
    });
    const letGoLongAgo = await kept(forTask(finishedLongAgo), {
      grantedAt: ago(10 * DAY),
      sealedAt: ago(10 * DAY),
    });
    const letGoLately = await kept(forTask(finishedLately), {
      grantedAt: ago(10 * DAY),
      sealedAt: ago(10 * DAY),
    });
    const leftAtAnotherStation = await kept(forTask(movedOn), {
      grantedAt: ago(10 * DAY),
      sealedAt: ago(10 * DAY),
    });
    const leftStillTalking = await kept(forTask(movedStillTalking), {
      grantedAt: ago(10 * DAY),
      sealedAt: ago(10 * DAY),
    });
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

    expect(due.get(letGoLongAgo.id.value)?.holder).toEqual({
      stationId: StationId.of(stationId),
      conversing: true,
      finished: true,
      changedAt: ago(9 * DAY),
    });
    expect(due.get(leftAtAnotherStation.id.value)?.holder).toEqual({
      stationId: StationId.of(otherStationId),
      conversing: false,
      finished: false,
      changedAt: ago(8 * DAY),
    });
    expect(due.get(ofADeletedTask.id.value)?.holder).toBeNull();
    expect(due.get(ofADeletedChat.id.value)?.holder).toBeNull();
    expect(due.has(neverSealed.id.value)).toBe(true);

    expect(due.has(stillHeld.id.value)).toBe(false);
    expect(due.has(letGoLately.id.value)).toBe(false);
    expect(due.has(ofAChat.id.value)).toBe(false);
    expect(due.has(stillUploading.id.value)).toBe(false);

    for (const id of [
      letGoLongAgo,
      leftAtAnotherStation,
      leftStillTalking,
      ofADeletedTask,
      ofADeletedChat,
      neverSealed,
    ]) {
      const archive = (await archives.find(id.id)) as WorkspaceArchive;
      const facts = due.get(id.id.value);

      expect(facts && archive.removableAt(NOW, facts)).toBe(true);
    }
  });

  it('lets go of an archive an hour after a newer one of the same work is sealed', async () => {
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

describe('the continuity of a held run', () => {
  const aRun = async (claimedBy: string, spec: unknown, taskId?: string) => {
    const id = randomUUID();

    await db.insert(schema.run).values({
      id,
      workspaceId: 'ws_1',
      harness: 'dev',
      taskId: taskId ?? null,
      stationId: taskId ? stationId : null,
      state: 'claimed',
      claimedBy,
      spec,
    });

    return RunId.of(id);
  };

  it('tells the runner holding a run which work it carries on, and whether its conversation does', async () => {
    const taskId = await aTask();
    const key = ContinuityKey.for({ taskId, stationId }).value;
    const continuing = await aRun(
      'runner_1',
      { continuity: { key, sessionId: 'session_1', keep: true } },
      taskId,
    );
    const afresh = await aRun(
      'runner_1',
      { continuity: { key, keep: true } },
      taskId,
    );

    await expect(
      runs.continuityOf(continuing, RunnerId.of('runner_1')),
    ).resolves.toEqual({
      workspaceId: WorkspaceId.of('ws_1'),
      continuity: ContinuityKey.of(key),
      holder: forTask(taskId),
      continuing: true,
    });
    await expect(
      runs.continuityOf(afresh, RunnerId.of('runner_1')),
    ).resolves.toMatchObject({ continuing: false });
    await expect(
      runs.continuityOf(continuing, RunnerId.of('runner_2')),
    ).resolves.toBeNull();
  });
});
