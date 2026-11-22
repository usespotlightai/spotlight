import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { SearchRunDispatch } from '@replays/application/services/search-run-dispatch.service';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { RunViewing } from '@runs/application/services/run-viewing.service';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import {
  TRACE_SCOPES,
  type TraceScope,
  type TraceScopesPort,
} from '@work/application/ports/trace-scopes.port';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served } from './support/app';
import { eventually } from './support/eventually';
import { deleteRunnersOf } from './support/runners';
import { aDispatch, requestedByTask } from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

const HOST = `host-search-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'s'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const SHIP = randomUUID();

const scopes = new Map<string, TraceScope>();

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
let memoryHandle: number;

const http = () => served(app);

const runner = (token: string) => ({
  get: (path: string) =>
    http().get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body?: object) =>
    http()
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body ?? {}),
});

interface Claimed {
  readonly id: string;
  readonly attempt: number;
  readonly spec: Record<string, unknown>;
}

interface SearchOrder {
  readonly id: string;
  readonly searchId: string;
  readonly iteration: number;
  readonly lineId: string;
  readonly stationId: string;
  readonly agent: {
    readonly harness: string;
    readonly model: string | null;
    readonly effort: string | null;
  };
  readonly briefing: string;
}

const order = (over: Partial<SearchOrder> = {}): SearchOrder => ({
  id: randomUUID(),
  searchId: randomUUID(),
  iteration: 1,
  lineId: DELIVERY,
  stationId: BUILD,
  agent: { harness: 'claude-code', model: null, effort: null },
  briefing: 'Find a Build station that passes more of its own checks.',
  ...over,
});

const dispatched = (queued: SearchOrder) =>
  app.get(SearchRunDispatch).dispatchSearch({
    run: RunId.of(queued.id),
    searchId: SearchId.of(queued.searchId),
    iteration: queued.iteration,
    lineId: LineId.of(queued.lineId),
    stationId: StationId.of(queued.stationId),
    agent: SearchAgent.of(queued.agent),
    briefing: queued.briefing,
  });

const sees = (queued: SearchOrder, scope: TraceScope) => {
  scopes.set(queued.searchId, scope);
};

const claimed = async (
  runId: string,
): Promise<{ token: string; run: Claimed }> => {
  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({
      bootId: 'boot_1',
      name: 'build-box',
      release: '0.1.0',
      containerRuntime: 'docker',
      capacity: 8,
      running: [],
      images: [
        {
          image: IMAGE,
          isDefault: true,
          harnesses: [{ id: 'claude-code', models: [] }],
        },
      ],
    })
    .expect(200);

  const assignment = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as { token: string; work: { run: Claimed } };

  expect(assignment.work.run.id).toBe(runId);

  return { token: assignment.token, run: assignment.work.run };
};

const aClaimedSearch = async (over: Partial<SearchOrder> = {}) => {
  const queued = order(over);

  expect(await dispatched(queued)).toEqual({ queued: true });

  const { token, run } = await claimed(queued.id);

  return { order: queued, runId: queued.id, token, run };
};

const aTask = async (title: string): Promise<string> => {
  const taskId = randomUUID();

  await db.insert(schema.task).values({
    id: taskId,
    branch: `feat/test-${taskId}`,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: BUILD,
    title,
    originStationId: BUILD,
    createdById: team.owner.value,
    assigneeId: team.owner.value,
  });

  return taskId;
};

const ended = (at: string) => ({
  state: 'completed' as const,
  exitCode: 0,
  createdAt: new Date(at),
  endedAt: new Date(at),
});

const aTaskRun = async (
  taskId: string,
  at: string,
  stationId: string = BUILD,
): Promise<string> => {
  const runId = randomUUID();

  await db.insert(schema.run).values({
    id: runId,
    workspaceId: team.workspaceId.value,
    ...requestedByTask(taskId, { teamId: team.teamId.value }),
    harness: 'claude-code',
    spec: {
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'Drain the queue.',
      handover: { options: ['ship'], noteLimit: 0 },
      resume: {},
    },
    ...ended(at),
  });
  await db.insert(schema.dispatch).values(
    aDispatch({
      runId,
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      taskId,
      stationId,
      orderedAt: new Date(at),
      endedAt: new Date(at),
    }),
  );

  return runId;
};

const runRow = async (runId: string) => {
  const [row] = await db
    .select()
    .from(schema.run)
    .where(eq(schema.run.id, runId));

  return row;
};

const published = (kind: string, runId: string) =>
  db
    .select({ payload: schema.eventOutbox.payload })
    .from(schema.eventOutbox)
    .where(
      and(
        eq(schema.eventOutbox.kind, kind),
        sql`${schema.eventOutbox.payload} ->> 'runId' = ${runId}`,
      ),
    );

const untilUsageRecorded = (runId: string) =>
  eventually(async () => {
    const pending = await db
      .select({ subscriber: schema.eventDelivery.subscriber })
      .from(schema.eventDelivery)
      .innerJoin(
        schema.eventOutbox,
        eq(schema.eventOutbox.id, schema.eventDelivery.eventId),
      )
      .where(
        and(
          sql`${schema.eventDelivery.deliveredAt} IS NULL`,
          sql`(${schema.eventOutbox.payload} ->> 'runId' = ${runId} OR ${schema.eventOutbox.payload} -> 'runId' ->> 'value' = ${runId})`,
        ),
      );
    const usageRecorded = await published('runs.run-usage-recorded.v1', runId);

    return pending.length === 0 && usageRecorded.length > 0;
  });

const finishing = (next: string) => ({
  exitCode: 0,
  failed: false,
  handover: { next, note: 'Proposed two candidates.' },
  sessionId: 'session_1',
  archived: true,
});

beforeAll(async () => {
  app = await openApp();
  app.get<TraceScopesPort>(TRACE_SCOPES).register({
    owner: 'replays',
    scopeOf: async (requester) =>
      requester.kind === 'search' ? (scopes.get(requester.id) ?? null) : null,
  });
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `search-${randomUUID().slice(0, 8)}`,
  );

  await db.insert(schema.line).values({
    id: DELIVERY,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
  });
  await db.insert(schema.lineRepository).values({
    lineId: DELIVERY,
    repository: Repository.of('acme/api').value,
  });
  await insertStations(db, [
    {
      id: randomUUID(),
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: BUILD,
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'build',
      name: 'Build',
      position: 1,
      kind: 'work',
      harness: 'claude-code',
      memories: true,
    },
    {
      id: SHIP,
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'ship',
      name: 'Ship',
      position: 2,
      kind: 'work',
      harness: 'claude-code',
    },
    {
      id: randomUUID(),
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'completed',
      name: 'Completed',
      position: 3,
      kind: 'completed',
    },
  ]);

  const [stored] = await db
    .insert(schema.memory)
    .values({
      id: randomUUID(),
      handle: sql`nextval('memory_handle_seq')`,
      workspaceId: team.workspaceId.value,
      kind: 'rationale',
      body: 'Queues drain oldest first.',
      teamId: team.teamId.value,
      paths: [],
      source: 'person',
      approvedById: team.owner.value,
      approvedAt: new Date(),
    })
    .returning({ handle: schema.memory.handle });
  memoryHandle = stored?.handle ?? 0;

  await http()
    .post(`/api/v1/resources/workspaces/${team.workspaceId.value}/runner-pools`)
    .set('x-test-user', team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ key: 'hosts', labels: ['linux'], token: POOL_TOKEN })
    .expect(201);
}, 60_000);

afterAll(async () => {
  await deleteRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('a search run claimed by a runner', () => {
  it('receives only the briefing it was dispatched with: nothing to check out, no tools, skills, attachments or memories', async () => {
    const {
      order: queued,
      runId,
      run,
    } = await aClaimedSearch({
      iteration: 2,
    });

    expect(run.spec).toEqual({
      command: expect.objectContaining({
        args: expect.any(Array) as unknown,
      }) as unknown,
      briefing: queued.briefing,
      handover: { options: [], noteLimit: 0 },
      resume: { key: `replays/search-${runId}` },
      search: {},
    });

    const row = await runRow(runId);

    expect(row?.requesterOwner).toBe('replays');
    expect(row?.requesterKind).toBe('search');
    expect(row?.requesterId).toBe(queued.searchId);
    expect(row?.requesterToken).toBe('2');
    expect(row?.teamId).toBe(team.teamId.value);
    expect(row?.priority).toBe(-1);
  });

  it('is named to the replays context by its search and iteration, only while its runner has a lease on it', async () => {
    const { order: queued, runId } = await aClaimedSearch({ iteration: 3 });
    const searches = app.get(SearchRunDispatch);
    const [host] = await db
      .select({ claimedBy: schema.run.claimedBy })
      .from(schema.run)
      .where(eq(schema.run.id, runId));

    expect(
      await searches.leasedSearchRun(RunId.of(runId), host?.claimedBy ?? ''),
    ).toEqual({
      searchId: SearchId.of(queued.searchId),
      iteration: 3,
    });
    expect(
      await searches.leasedSearchRun(RunId.of(runId), randomUUID()),
    ).toBeNull();
  });

  it('touches no repository, uses no tool, replies to no review comment, acknowledges no message, archives no working copy and reads no memory', async () => {
    const { runId, token } = await aClaimedSearch();

    await runner(token)
      .get(`/api/git/${runId}/api/info/refs?service=git-upload-pack`)
      .expect(409);
    await runner(token)
      .post(`/api/git/${runId}/api/git-receive-pack`)
      .expect(409);
    await runner(token)
      .post(`/api/runs/${runId}/tools/linear.comment`, { body: 'hi' })
      .expect(403);
    await runner(token)
      .post(`/api/runs/${runId}/review-comment-replies`, {
        handle: 'R-1',
        body: 'Fixed.',
        resolve: true,
      })
      .expect(409);
    await runner(token)
      .post(`/api/runs/${runId}/messages/ack`, { upTo: 0 })
      .expect(409);
    await runner(token)
      .post(`/api/runs/${runId}/working-copy-archive`, {
        size: 10,
        sha256: 'b'.repeat(64),
      })
      .expect(409);
    await runner(token)
      .post(`/api/runs/${runId}/memories`, {
        kind: 'rationale',
        body: 'Queues drain newest first.',
      })
      .expect(409);
    await runner(token)
      .post(`/api/runs/${runId}/memories/recall`, { words: 'queue' })
      .expect(409);
    await runner(token)
      .post(`/api/runs/${runId}/memories/M-${memoryHandle}/recall`)
      .expect(409);
    expect(
      (await runner(token).get(`/api/runs/${runId}/memory-files`).expect(200))
        .body,
    ).toEqual([]);
    await runner(token)
      .post(`/api/runs/${runId}/change-stacks`, {
        diff: 'diff --git a/api/src/queue.ts b/api/src/queue.ts\n',
        repository: 'api',
        base: 'a'.repeat(40),
      })
      .expect(409);
    expect(
      await db
        .select()
        .from(schema.changeStack)
        .where(eq(schema.changeStack.runId, runId)),
    ).toEqual([]);
  });
});

describe('a search run reading its station’s history', () => {
  it('reads only the searched station, leaves out held-out tasks and always shows the originals it searches', async () => {
    const { order: queued, runId, token } = await aClaimedSearch();
    const searched = await aTask('Drain the queue');
    const heldOut = await aTask('Retry the upload');
    const older = await aTask('Name the branch');
    const original = await aTaskRun(searched, '2026-09-20T09:00:00Z');
    await aTaskRun(heldOut, '2026-09-25T09:00:00Z');
    const shown = await aTaskRun(older, '2026-08-01T09:00:00Z');
    sees(queued, {
      stationId: BUILD,
      hiddenTaskIds: [heldOut],
      shownRunIds: [original, shown],
    });

    await runner(token)
      .get(`/api/runs/${runId}/history?station=ship`)
      .expect(404);

    const history = (
      await runner(token)
        .get(`/api/runs/${runId}/history?station=build&last=1`)
        .expect(200)
    ).body as {
      runs: { runId: string; taskId: string }[];
      candidates?: unknown;
      seedBlock?: unknown;
    };

    expect(history.runs.map((each) => each.taskId)).not.toContain(heldOut);
    expect(history.runs.map((each) => each.runId)).toEqual(
      expect.arrayContaining([original, shown]),
    );
    expect(history.candidates).toBeUndefined();
    expect(history.seedBlock).toBeUndefined();
  });

  it('fails rather than show an unfiltered history when its search cannot be seen', async () => {
    const { runId, token } = await aClaimedSearch();

    const answer = await runner(token).get(
      `/api/runs/${runId}/history?station=build`,
    );

    expect(answer.status).toBe(404);
    expect((answer.body as { runs?: unknown }).runs).toBeUndefined();
  });

  it('reads the trace of a task it may see at the station it searches, and of no held-out task or task worked elsewhere', async () => {
    const { order: queued, runId, token } = await aClaimedSearch();
    const seen = await aTask('Drain the queue again');
    const heldOut = await aTask('Retry the upload again');
    const elsewhere = await aTask('Ship the release');

    const atBuild = await aTaskRun(seen, '2026-09-21T09:00:00Z');
    const atShip = await aTaskRun(seen, '2026-09-21T10:00:00Z', SHIP);
    await aTaskRun(heldOut, '2026-09-22T09:00:00Z');
    await aTaskRun(elsewhere, '2026-09-23T09:00:00Z', SHIP);
    sees(queued, {
      stationId: BUILD,
      hiddenTaskIds: [heldOut],
      shownRunIds: [],
    });

    const trace = JSON.stringify(
      (await runner(token).get(`/api/runs/${runId}/trace/${seen}`).expect(200))
        .body,
    );

    expect(trace).toContain(atBuild);
    expect(trace).not.toContain(atShip);
    await runner(token).get(`/api/runs/${runId}/trace/${heldOut}`).expect(404);
    await runner(token)
      .get(`/api/runs/${runId}/trace/${elsewhere}`)
      .expect(404);
    await runner(token)
      .get(`/api/runs/${randomUUID()}/trace/${seen}`)
      .expect(404);
  });

  it('fails a trace read when its search cannot be seen', async () => {
    const { runId, token } = await aClaimedSearch();
    const seen = await aTask('Drain the queue once more');

    await aTaskRun(seen, '2026-09-24T09:00:00Z');

    await runner(token).get(`/api/runs/${runId}/trace/${seen}`).expect(404);
  });
});

describe('a search run ending', () => {
  it('says so as a search run’s end and usage, and wakes none of what a task run’s or replay’s end wakes', async () => {
    const {
      order: queued,
      runId,
      token,
    } = await aClaimedSearch({
      iteration: 4,
    });

    await runner(token)
      .post(`/api/runs/${runId}/completion`, finishing('review'))
      .expect(204);
    await untilUsageRecorded(runId);

    expect((await runRow(runId))?.state).toBe('completed');

    const [endedEvent] = await published('runs.run-ended.v1', runId);

    expect(endedEvent?.payload).toMatchObject({
      requester: {
        owner: 'replays',
        kind: 'search',
        id: queued.searchId,
        token: '4',
        team: team.teamId.value,
      },
      workspaceId: team.workspaceId.value,
      endedBy: 'turn',
      failure: null,
      askedAPerson: false,
      stopped: false,
    });
    expect(
      Number.isNaN(
        Date.parse(
          (endedEvent?.payload as { endedAt: string } | undefined)?.endedAt ??
            '',
        ),
      ),
    ).toBe(false);
    expect(await published('runs.run-usage-recorded.v1', runId)).toEqual([
      {
        payload: expect.objectContaining({
          kind: 'runs.run-usage-recorded.v1',
          requester: expect.objectContaining({
            owner: 'replays',
            kind: 'search',
            id: queued.searchId,
          }) as unknown,
          listed: false,
        }) as unknown,
      },
    ]);

    for (const kind of ['work.dispatch-ended.v1', 'work.dispatch-briefed.v1']) {
      expect(await published(kind, runId)).toEqual([]);
    }
    expect(
      await db
        .select()
        .from(schema.runRecord)
        .where(eq(schema.runRecord.runId, runId)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.changeStack)
        .where(eq(schema.changeStack.runId, runId)),
    ).toEqual([]);
  });

  it('ends at once when it asks a person, saying so', async () => {
    const { runId, token } = await aClaimedSearch();

    expect(
      (
        await runner(token)
          .post(`/api/runs/${runId}/permissions`, {
            sessionId: 'session_1',
            kind: 'execute',
            title: 'rm -rf node_modules',
            input: { command: 'rm -rf node_modules' },
          })
          .expect(200)
      ).body,
    ).toEqual({ decision: 'pending' });
    await runner(token)
      .post(`/api/runs/${runId}/completion`, finishing('review'))
      .expect(204);
    await untilUsageRecorded(runId);

    expect((await runRow(runId))?.askedAPerson).toBe(true);

    const [endedEvent] = await published('runs.run-ended.v1', runId);

    expect(endedEvent?.payload).toMatchObject({ askedAPerson: true });
  });

  it('is cancelled before a runner claims it, still saying so as a search’s end', async () => {
    const queued = order();

    await dispatched(queued);
    await app.get(SearchRunDispatch).cancelSearchRun(RunId.of(queued.id));

    expect((await runRow(queued.id))?.state).toBe('cancelled');
    await eventually(
      async () =>
        (await published('runs.run-ended.v1', queued.id)).length === 1,
    );
    expect(await published('work.dispatch-ended.v1', queued.id)).toEqual([]);
  });

  it('takes a run queued before as queued when it is asked again', async () => {
    const queued = order();

    expect(await dispatched(queued)).toEqual({ queued: true });
    expect(await dispatched(queued)).toEqual({ queued: true });
    expect((await runRow(queued.id))?.requesterToken).toBe('1');
  });
});

describe('who may watch a search run', () => {
  it('is no one, since the app keeps search runs out of view', async () => {
    const queued = order();

    await dispatched(queued);

    const runs = app.get(RunViewing);

    expect(await runs.watchedBy(RunId.of(queued.id), team.owner)).toBeNull();
    expect(
      await runs.watchedBy(RunId.of(queued.id), UserId.of(randomUUID())),
    ).toBeNull();
  });
});
