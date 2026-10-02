import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ImprovedStation } from '@work/domain/value-objects/improved-station.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import type { RunState } from '@work/domain/value-objects/run-state';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { DrizzleRunReader } from '@work/infrastructure/persistence/drizzle/readers/run.reader';
import { DrizzleStationRunReader } from '@work/infrastructure/persistence/drizzle/readers/station-run.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let held: TestDatabase;
let db: DrizzleDatabase;
let runs: DrizzleRunRepository;
let stationRuns: DrizzleStationRunReader;
let runReader: DrizzleRunReader;
let chats: DrizzleChatRepository;

beforeAll(async () => {
  held = await openDatabase('station_configs');
  db = held.db;
  runs = new DrizzleRunRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  stationRuns = new DrizzleStationRunReader(db);
  runReader = new DrizzleRunReader(
    db,
    {
      mayView: async () => true,
      viewableBy: async (_viewer: UserId, workspaces: readonly WorkspaceId[]) =>
        new Set(workspaces.map((each) => each.value)),
    } as never,
    { named: async () => new Map() } as never,
  );
  chats = new DrizzleChatRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
}, 60_000);

afterAll(async () => {
  await held?.close();
});

const PARTS: StationConfigParts = {
  prompt: 'Implement it.',
  harness: 'dev',
  model: null,
  effort: 'high',
  profile: { key: 'careful', settings: { rules: [], native: {} } },
  image: null,
  repositories: [{ name: 'api', setup: 'npm ci' }],
  skills: [{ key: 'handing-over', digest: 'd'.repeat(64) }],
  tools: [],
  decisions: false,
  memories: true,
};

const SPEC = {
  command: { executable: 'sh', args: [] },
  briefing: 'do the thing',
  handover: { options: [], noteLimit: 0 },
  continuity: { key: 'task:station' },
};

const lineOf = async (teamId: string, key = 'delivery') => {
  const lineId = randomUUID();
  const stationId = randomUUID();

  await db.insert(schema.line).values({
    id: lineId,
    key,
    workspaceId: 'ws_1',
    teamId,
    name: 'Delivery',
  });
  await db.insert(schema.station).values({
    id: stationId,
    key: 'implementation',
    lineId,
    name: 'Implementation',
    position: 1,
  });

  return { lineId, stationId };
};

const ran = async (
  stationId: string,
  {
    fingerprint = 'a'.repeat(64),
    parts = PARTS,
    state = 'completed',
    at,
  }: {
    fingerprint?: string | null;
    parts?: StationConfigParts;
    state?: RunState;
    at: Date;
  },
) => {
  const taskId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.task).values({
    id: taskId,
    workspaceId: 'ws_1',
    stationId,
    title: `Task ${runId.slice(0, 4)}`,
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: 'ws_1',
    harness: 'dev',
    taskId,
    taskRevision: 0,
    stationId,
    state,
    spec: SPEC,
    stationFingerprint: fingerprint,
    stationConfig: fingerprint ? parts : null,
    createdAt: at,
    updatedAt: at,
    endedAt: ['completed', 'failed', 'superseded'].includes(state) ? at : null,
  });

  return { runId, taskId };
};

describe('the station config a run ran with', () => {
  it('comes back with the run it was recorded on', async () => {
    const { stationId } = await lineOf('team_1');
    const { runId } = await ran(stationId, { at: new Date() });

    const found = await runs.findById(RunId.of(runId));

    expect(found?.configuredAs?.fingerprint).toBe('a'.repeat(64));
    expect(found?.configuredAs?.parts).toEqual(PARTS);
  });

  it('tells the team, line, station and fingerprint of a run that ended', async () => {
    const { lineId, stationId } = await lineOf('team_2');
    const { runId, taskId } = await ran(stationId, { at: new Date() });

    expect(await stationRuns.endedRun(runId)).toMatchObject({
      runId,
      teamId: 'team_2',
      lineId,
      stationId,
      taskId,
      fingerprint: 'a'.repeat(64),
    });
  });

  it('tells the states of the task’s earlier runs at the station, to count its rounds by', async () => {
    const { stationId } = await lineOf('team_9');
    const first = await ran(stationId, {
      at: new Date('2026-09-01T00:00:00Z'),
    });
    const superseded = randomUUID();
    const second = randomUUID();

    for (const [id, state, at] of [
      [superseded, 'superseded', '2026-09-02T00:00:00Z'],
      [second, 'failed', '2026-09-03T00:00:00Z'],
    ] as const) {
      await db.insert(schema.run).values({
        id,
        workspaceId: 'ws_1',
        harness: 'dev',
        taskId: first.taskId,
        taskRevision: 0,
        stationId,
        state,
        spec: SPEC,
        createdAt: new Date(at),
        endedAt: new Date(at),
      });
    }

    expect((await stationRuns.endedRun(first.runId))?.earlier).toEqual([]);
    expect((await stationRuns.endedRun(second))?.earlier).toEqual([
      'completed',
      'superseded',
    ]);
  });

  it('tells nothing of a run still being worked', async () => {
    const { stationId } = await lineOf('team_3');
    const { runId } = await ran(stationId, {
      state: 'claimed',
      at: new Date(),
    });

    expect(await stationRuns.endedRun(runId)).toBeNull();
  });

  it('names each config by its fingerprint', async () => {
    const { stationId } = await lineOf('team_4');
    await ran(stationId, { fingerprint: 'b'.repeat(64), at: new Date() });
    await ran(stationId, { fingerprint: 'b'.repeat(64), at: new Date() });

    expect(await stationRuns.configsNamed(['b'.repeat(64)])).toEqual([
      { fingerprint: 'b'.repeat(64), parts: PARTS },
    ]);
  });

  it('finds a station by its key only among the team’s own lines', async () => {
    await lineOf('team_5', 'delivery');
    await lineOf('team_6', 'delivery');

    const found = await stationRuns.stationsKeyed(
      TeamId.of('team_5'),
      'implementation',
      null,
    );

    expect(found.map((each) => each.lineKey)).toEqual(['delivery']);
  });

  it('reads a station’s ended runs newest first, by fingerprint, since a date and until one', async () => {
    const { stationId } = await lineOf('team_7');
    const old = await ran(stationId, {
      fingerprint: 'c'.repeat(64),
      at: new Date('2026-09-01T00:00:00Z'),
    });
    const recent = await ran(stationId, {
      fingerprint: 'e'.repeat(64),
      at: new Date('2026-09-20T00:00:00Z'),
    });
    await ran(stationId, {
      state: 'queued',
      at: new Date('2026-09-25T00:00:00Z'),
    });

    const all = await stationRuns.endedAt(stationId, {
      fingerprint: null,
      since: null,
      until: null,
      most: 10,
    });
    const sinceMid = await stationRuns.endedAt(stationId, {
      fingerprint: null,
      since: new Date('2026-09-10T00:00:00Z'),
      until: null,
      most: 10,
    });
    const untilMid = await stationRuns.endedAt(stationId, {
      fingerprint: null,
      since: null,
      until: new Date('2026-09-10T00:00:00Z'),
      most: 10,
    });
    const ofOld = await stationRuns.endedAt(stationId, {
      fingerprint: 'c'.repeat(64),
      since: null,
      until: null,
      most: 10,
    });

    expect(all.map((each) => each.runId)).toEqual([recent.runId, old.runId]);
    expect(sinceMid.map((each) => each.runId)).toEqual([recent.runId]);
    expect(untilMid.map((each) => each.runId)).toEqual([old.runId]);
    expect(ofOld.map((each) => each.runId)).toEqual([old.runId]);
  });

  it('names the station’s run before a run, for its config', async () => {
    const { stationId } = await lineOf('team_8');
    const before = await ran(stationId, {
      fingerprint: 'f'.repeat(64),
      at: new Date('2026-09-01T00:00:00Z'),
    });
    const after = await ran(stationId, {
      fingerprint: '1'.repeat(64),
      parts: { ...PARTS, effort: 'xhigh' },
      at: new Date('2026-09-02T00:00:00Z'),
    });

    const found = await runReader.configFor(
      RunId.of(after.runId),
      UserId.of('user_1'),
    );

    expect(found?.ran?.fingerprint).toBe('1'.repeat(64));
    expect(found?.before?.runId).toBe(before.runId);
  });
});

describe('a chat improving a station', () => {
  it('keeps the station it improves', async () => {
    const chat = Chat.start({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      startedBy: UserId.of('user_1'),
      harness: HarnessId.of('dev'),
      body: ChatMessageBody.given('Improve this station.'),
      improving: ImprovedStation.rehydrate({
        teamId: TeamId.of('team_1'),
        lineId: LineId.of('line_1'),
        lineKey: LineKey.of('delivery'),
        lineName: LineName.of('Delivery'),
        stationId: StationId.of('station_1'),
        stationKey: StationKey.of('implementation'),
        stationName: StationName.of('Implementation'),
      }),
      now: new Date(),
      newId: () => randomUUID(),
    });

    await chats.add(chat);
    const found = await chats.find(chat.id);

    expect(found?.improving?.stationKey.value).toBe('implementation');
    expect(found?.improving?.lineName.value).toBe('Delivery');
  });
});
