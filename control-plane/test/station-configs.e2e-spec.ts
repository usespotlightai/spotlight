import { randomUUID } from 'node:crypto';

import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunState } from '@runs/domain/value-objects/run-state';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import { TargetStation } from '@work/domain/value-objects/target-station.vo';
import { DrizzleRunReader } from '@work/infrastructure/persistence/drizzle/readers/run.reader';
import { DrizzleStationRunReader } from '@work/infrastructure/persistence/drizzle/readers/station-run.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleDispatchRepository } from '@work/infrastructure/persistence/drizzle/repositories/dispatch.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { runFactsOver, runJournalsOver } from './support/run-facts';
import { aDispatch, aTurn, outcomeOf, requestedByTask } from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';

let database: TestDatabase;
let db: DrizzleDatabase;
let dispatches: DrizzleDispatchRepository;
let stationRuns: DrizzleStationRunReader;
let runReader: DrizzleRunReader;
let chats: DrizzleChatRepository;

beforeAll(async () => {
  database = await openDatabase('station_configs');
  db = database.db;
  dispatches = new DrizzleDispatchRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  const facts = runFactsOver(db);
  stationRuns = new DrizzleStationRunReader(db, facts, runJournalsOver(db));
  runReader = new DrizzleRunReader(
    db,
    { named: async () => new Map() } as never,
    facts,
    facts,
  );
  chats = new DrizzleChatRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const PARTS: StationConfigParts = {
  prompt: 'Implement it.',
  harness: 'dev',
  model: null,
  effort: 'high',
  profile: { key: 'careful', settings: { rules: [], native: {} } },
  image: null,
  repositories: [{ name: 'api', setup: 'npm ci' }],
  skills: [{ key: 'handing-over', hash: 'd'.repeat(64) }],
  tools: [],
  decisions: false,
  memories: true,
};

const SPEC = {
  command: { executable: 'sh', args: [] },
  briefing: 'do the thing',
  handover: { options: [], noteLimit: 0 },
  resume: {},
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
  await insertStations(db, {
    id: stationId,
    key: 'implementation',
    workspaceId: 'ws_1',
    lineId,
    name: 'Implementation',
    position: 1,
  });

  teamOf.set(stationId, teamId);

  return { lineId, stationId };
};

const teamOf = new Map<string, string>();

const leased = (state: RunState) =>
  state === 'claimed'
    ? { claimedBy: 'runner_1', leaseExpiresAt: new Date(Date.now() + 60_000) }
    : {};

const ran = async (
  stationId: string,
  {
    fingerprint = 'a'.repeat(64),
    parts = PARTS,
    state = 'completed',
    reviewing = null,
    toolsOnMarks = [],
    at,
  }: {
    fingerprint?: string | null;
    parts?: StationConfigParts;
    state?: RunState;
    reviewing?: string | null;
    toolsOnMarks?: readonly string[];
    at: Date;
  },
) => {
  const taskId = randomUUID();
  const runId = randomUUID();
  const ended = state === 'completed' || state === 'failed';

  await db.insert(schema.task).values({
    id: taskId,
    branch: `feat/test-${taskId}`,
    openedFrom: 'person',
    workspaceId: 'ws_1',
    stationId,
    title: `Task ${runId.slice(0, 4)}`,
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: 'ws_1',
    harness: 'dev',
    ...requestedByTask(taskId, { teamId: teamOf.get(stationId) ?? null }),
    state,
    ...leased(state),
    ...outcomeOf(state),
    spec: SPEC,
    createdAt: at,
    updatedAt: at,
    endedAt: ended ? at : null,
    ...(state === 'suspended' ? aTurn() : {}),
  });
  await db.insert(schema.dispatch).values({
    ...aDispatch({
      runId,
      workspaceId: 'ws_1',
      teamId: teamOf.get(stationId) ?? null,
      taskId,
      stationId,
      fingerprint,
      config: fingerprint ? parts : null,
      briefedTask: {
        stationId,
        title: 'Task',
        description: null,
        reviewing,
        attachments: [],
        notes: [],
        openReviewComments: [],
        decisions: [],
      },
      orderedAt: at,
      endedAt: ended ? at : null,
      outcome: state === 'failed' ? 'failed' : 'completed',
    }),
    toolsOnMarks,
  });

  return { runId, taskId };
};

describe('the station config a run ran with', () => {
  it('comes back with the run it was recorded on', async () => {
    const { stationId } = await lineOf('team_1');
    const { runId } = await ran(stationId, { at: new Date() });

    const found = await dispatches.find(RunId.of(runId));

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
      reviewing: null,
    });
  });

  it('tells the repository a run that ended reviewed', async () => {
    const { stationId } = await lineOf('team_20');
    const { runId } = await ran(stationId, {
      reviewing: 'acme/web',
      at: new Date(),
    });

    expect(await stationRuns.endedRun(runId)).toMatchObject({
      reviewing: 'acme/web',
    });
  });

  it('tells the states of the task’s earlier runs at the station, to count its visits by', async () => {
    const { stationId } = await lineOf('team_9');
    const first = await ran(stationId, {
      at: new Date('2026-09-01T00:00:00Z'),
    });
    const superseded = randomUUID();
    const second = randomUUID();

    for (const [id, at] of [
      [superseded, '2026-09-02T00:00:00Z'],
      [second, '2026-09-03T00:00:00Z'],
    ] as const) {
      await db.insert(schema.run).values({
        id,
        workspaceId: 'ws_1',
        harness: 'dev',
        ...requestedByTask(first.taskId),
        state: 'failed',
        ...outcomeOf('failed'),
        spec: SPEC,
        createdAt: new Date(at),
        endedAt: new Date(at),
      });
    }
    await db.insert(schema.dispatch).values([
      aDispatch({
        runId: superseded,
        workspaceId: 'ws_1',
        taskId: first.taskId,
        stationId,
        orderedAt: new Date('2026-09-02T00:00:00Z'),
        endedAt: new Date('2026-09-02T00:00:00Z'),
        superseded: true,
      }),
      aDispatch({
        runId: second,
        workspaceId: 'ws_1',
        taskId: first.taskId,
        stationId,
        orderedAt: new Date('2026-09-03T00:00:00Z'),
        endedAt: new Date('2026-09-03T00:00:00Z'),
        outcome: 'failed',
      }),
    ]);

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

  it('reads the team’s open runs newest first, with their progress', async () => {
    const { lineId, stationId } = await lineOf('team_10');
    const other = await lineOf('team_11');
    const queued = await ran(stationId, {
      state: 'queued',
      fingerprint: null,
      at: new Date('2026-09-01T00:00:00Z'),
    });
    const claimed = await ran(stationId, {
      state: 'claimed',
      at: new Date('2026-09-02T00:00:00Z'),
    });
    const stopping = await ran(stationId, {
      state: 'claimed',
      at: new Date('2026-09-03T00:00:00Z'),
    });
    await db
      .update(schema.run)
      .set({ stopRequestedAt: new Date('2026-09-04T00:00:00Z') })
      .where(eq(schema.run.id, stopping.runId));
    const suspended = await ran(stationId, {
      state: 'suspended',
      at: new Date('2026-09-05T00:00:00Z'),
    });
    await ran(stationId, {
      state: 'completed',
      at: new Date('2026-09-06T00:00:00Z'),
    });
    await ran(other.stationId, {
      state: 'claimed',
      at: new Date('2026-09-07T00:00:00Z'),
    });

    const unfinished = await stationRuns.unfinishedOfTeam(TeamId.of('team_10'));

    expect(unfinished.map((each) => [each.runId, each.progress])).toEqual([
      [suspended.runId, null],
      [stopping.runId, 'stopping'],
      [claimed.runId, 'in-progress'],
      [queued.runId, 'queued'],
    ]);
    expect(unfinished[3]).toMatchObject({
      lineId,
      stationId,
      taskId: queued.taskId,
      openedBy: null,
      harness: 'dev',
      config: null,
      queuedAt: new Date('2026-09-01T00:00:00Z'),
    });
    expect(unfinished[2]?.config).toEqual(PARTS);
  });

  it('reads what traces show of tasks and runs: titles, stations with their line’s count, and the newest note of each task’s runs', async () => {
    const { lineId, stationId } = await lineOf('team_12');
    const review = randomUUID();
    await insertStations(db, {
      id: review,
      key: 'review',
      workspaceId: 'ws_1',
      lineId,
      name: 'Review',
      position: 2,
      color: '#edc12b',
    });
    const { runId, taskId } = await ran(stationId, {
      at: new Date('2026-09-01T00:00:00Z'),
    });
    await db
      .update(schema.task)
      .set({ description: 'Drain the queue', stationId: review })
      .where(eq(schema.task.id, taskId));
    await db.insert(schema.taskNote).values(
      ['Looking', 'Done'].map((body, position) => ({
        taskId,
        position,
        station: 'Implementation',
        stationId,
        body,
        at: new Date('2026-09-01T00:00:00Z'),
        runId,
        kind: 'message' as const,
      })),
    );

    const traced = await stationRuns.traced({
      taskIds: [taskId],
      runIds: [runId],
      stationIds: [stationId],
    });

    expect(traced.tasks).toEqual([
      {
        taskId,
        title: `Task ${runId.slice(0, 4)}`,
        description: 'Drain the queue',
        stationId: review,
      },
    ]);
    expect(
      [...traced.stations]
        .sort((one, other) => one.position - other.position)
        .map((each) => [
          each.stationId,
          each.name,
          each.position,
          each.stations,
        ]),
    ).toEqual([
      [stationId, 'Implementation', 1, 2],
      [review, 'Review', 2, 2],
    ]);
    expect([...traced.notes]).toEqual([[taskId, 'Done']]);
  });

  it('reads nothing for traces of nothing', async () => {
    expect(
      await stationRuns.traced({ taskIds: [], runIds: [], stationIds: [] }),
    ).toEqual({ tasks: [], stations: [], notes: new Map() });
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
      max: 10,
      excluding: [],
    });
    const sinceMid = await stationRuns.endedAt(stationId, {
      fingerprint: null,
      since: new Date('2026-09-10T00:00:00Z'),
      until: null,
      max: 10,
      excluding: [],
    });
    const untilMid = await stationRuns.endedAt(stationId, {
      fingerprint: null,
      since: null,
      until: new Date('2026-09-10T00:00:00Z'),
      max: 10,
      excluding: [],
    });
    const ofOld = await stationRuns.endedAt(stationId, {
      fingerprint: 'c'.repeat(64),
      since: null,
      until: null,
      max: 10,
      excluding: [],
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

    const found = (await runReader.configFor(RunId.of(after.runId)))?.found;

    expect(found?.ran?.fingerprint).toBe('1'.repeat(64));
    expect(found?.before?.runId).toBe(before.runId);
  });
});

describe('the tools a run had because of its task’s marks', () => {
  it('come back with the run, apart from its station config', async () => {
    const { stationId } = await lineOf('team_marked');
    const { runId } = await ran(stationId, {
      toolsOnMarks: ['sentry.get-issue'],
      at: new Date(),
    });

    const found = await dispatches.find(RunId.of(runId));
    const read = (await runReader.configFor(RunId.of(runId)))?.found;

    expect(found?.toolsOnMarks.map((each) => each.value)).toEqual([
      'sentry.get-issue',
    ]);
    expect(read?.toolsOnMarks).toEqual(['sentry.get-issue']);
    expect(read?.ran?.parts.tools).toEqual([]);
  });

  it('are none for a run its task’s marks gave no tools', async () => {
    const { stationId } = await lineOf('team_unmarked');
    const { runId } = await ran(stationId, { at: new Date() });

    expect(
      (await runReader.configFor(RunId.of(runId)))?.found.toolsOnMarks,
    ).toEqual([]);
  });
});

describe('a chat that improves a station', () => {
  it('stores the station it improves', async () => {
    const chat = Chat.start({
      lines: [],
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      startedBy: UserId.of('user_1'),
      harness: HarnessId.of('dev'),
      body: ChatMessageBody.fromInput('Improve this station.'),
      targetStation: TargetStation.rehydrate({
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

    expect(found?.targetStation?.stationKey.value).toBe('implementation');
    expect(found?.targetStation?.lineName.value).toBe('Delivery');
  });
});
