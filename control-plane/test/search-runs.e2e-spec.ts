import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { UnknownSearchRunError } from '@replays/domain/exceptions/unknown-search-run.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import {
  RUN_EVENT_READER,
  type RunEventReaderPort,
} from '@work/application/ports/run-event-reader.port';
import {
  SEARCH_DISPATCH,
  type SearchDispatchPort,
  type SearchOrder,
} from '@work/application/ports/search-dispatch.port';
import {
  SEARCH_RUNS,
  type SearchRunsPort,
} from '@work/application/ports/search-runs.port';
import {
  aSearchVisibility,
  BUILD_BLOCK,
  searchVisibilitiesInMemory,
} from '@work/application/ports/search-visibility.fake-spec';
import { SEARCH_VISIBILITY } from '@work/application/ports/search-visibility.port';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served } from './support/app';
import { eventually } from './support/eventually';
import { deleteRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const HOST = `host-search-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'s'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const SHIP = randomUUID();

const visibilities = searchVisibilitiesInMemory({
  of: async (runId) => {
    throw new UnknownSearchRunError(runId);
  },
});

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

  expect(
    await app.get<SearchDispatchPort>(SEARCH_DISPATCH).enqueue(queued),
  ).toEqual({ outcome: 'queued' });

  const { token, run } = await claimed(queued.id);

  return { order: queued, runId: queued.id, token, run };
};

const aTask = async (title: string): Promise<string> => {
  const taskId = randomUUID();

  await db.insert(schema.task).values({
    id: taskId,
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
    taskId,
    taskRevision: 0,
    stationId,
    harness: 'claude-code',
    spec: {
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'Drain the queue.',
      handover: { options: ['ship'], noteLimit: 0 },
      resume: { key: `task-${taskId}` },
    },
    ...ended(at),
  });

  return runId;
};

const changed = (sessionUpdate: Record<string, unknown>) =>
  Buffer.from(
    JSON.stringify({ sessionId: 'session_1', update: sessionUpdate }),
  ).toString('base64');

const aCandidateRun = async (original: string, at: string): Promise<string> => {
  const runId = randomUUID();

  await db.insert(schema.run).values({
    id: runId,
    workspaceId: team.workspaceId.value,
    replayOfRunId: original,
    ranForTeamId: team.teamId.value,
    stationId: BUILD,
    harness: 'claude-code',
    stationFingerprint: 'c'.repeat(64),
    stationConfig: {
      prompt: null,
      harness: 'claude-code',
      model: null,
      effort: null,
      profile: null,
      image: null,
      repositories: [],
      skills: [],
      tools: [],
      decisions: false,
      memories: false,
    },
    spec: {
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'Drain the queue.',
      handover: { options: ['ship'], noteLimit: 0 },
      resume: { key: `replay-${runId}` },
      replay: { archive: null, checkouts: [], movesOnAfter: ['ship'] },
    },
    ...ended(at),
  });
  await db.insert(schema.runJournalEntry).values([
    {
      runId,
      attempt: 1,
      seq: 1,
      type: 'output',
      at: new Date(at),
      data: changed({
        sessionUpdate: 'tool_call',
        toolCallId: 'edit_1',
        title: 'Edit',
        kind: 'edit',
      }),
    },
    {
      runId,
      attempt: 1,
      seq: 2,
      type: 'output',
      at: new Date(at),
      data: changed({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'edit_1',
        status: 'completed',
        content: [
          {
            type: 'diff',
            path: 'api/src/queue.ts',
            oldText: 'drain(newest)',
            newText: 'drain(oldest)',
          },
        ],
      }),
    },
  ]);

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
    const usageRecorded = await published(
      'work.search-run-usage-recorded.v1',
      runId,
    );

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
  app = await openApp((module) =>
    module.overrideProvider(SEARCH_VISIBILITY).useValue(visibilities),
  );
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
  await db.insert(schema.station).values([
    {
      id: randomUUID(),
      lineId: DELIVERY,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: BUILD,
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
      lineId: DELIVERY,
      key: 'ship',
      name: 'Ship',
      position: 2,
      kind: 'work',
      harness: 'claude-code',
    },
    {
      id: randomUUID(),
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
      approvedBy: team.owner.value,
      approvedAt: new Date(),
    })
    .returning({ handle: schema.memory.handle });
  memoryHandle = stored?.handle ?? 0;

  await http()
    .post(`/api/resources/workspaces/${team.workspaceId.value}/runner-pools`)
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
      command: expect.objectContaining({ args: expect.any(Array) }),
      briefing: queued.briefing,
      handover: { options: [], noteLimit: 0 },
      resume: { key: `search-${runId}` },
      search: {},
    });

    const row = await runRow(runId);

    expect(row?.taskId).toBeNull();
    expect(row?.replayOfRunId).toBeNull();
    expect(row?.searchId).toBe(queued.searchId);
    expect(row?.searchIteration).toBe(2);
    expect(row?.ranForTeamId).toBe(team.teamId.value);
    expect(row?.stationId).toBe(BUILD);
    expect(row?.priority).toBe(-1);
    expect(row?.briefedMemories).toEqual({ briefed: [], omitted: [] });
  });

  it('is named to the replays context by its search and iteration, only while its runner has a lease on it', async () => {
    const { order: queued, runId } = await aClaimedSearch({ iteration: 3 });
    const searches = app.get<SearchRunsPort>(SEARCH_RUNS);
    const [host] = await db
      .select({ claimedBy: schema.run.claimedBy })
      .from(schema.run)
      .where(eq(schema.run.id, runId));

    expect(
      await searches.leasedSearchRun(runId, host?.claimedBy ?? ''),
    ).toEqual({
      searchId: queued.searchId,
      iteration: 3,
    });
    expect(await searches.leasedSearchRun(runId, randomUUID())).toBeNull();
  });

  it('touches no repository, uses no tool, replies to no review comment, acknowledges no message, archives no workspace and reads no memory', async () => {
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
      .post(`/api/runs/${runId}/workspace-archive`, {
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
  it('reads only the searched station, leaves out held-out tasks, always shows the originals it searches, and lists the candidates’ replay runs', async () => {
    const { runId, token } = await aClaimedSearch();
    const searched = await aTask('Drain the queue');
    const heldOut = await aTask('Retry the upload');
    const older = await aTask('Name the branch');
    const original = await aTaskRun(searched, '2026-09-20T09:00:00Z');
    const hidden = await aTaskRun(heldOut, '2026-09-25T09:00:00Z');
    const shown = await aTaskRun(older, '2026-08-01T09:00:00Z');
    const candidate = await aCandidateRun(original, '2026-09-30T09:00:00Z');
    const heldOutCandidate = await aCandidateRun(
      hidden,
      '2026-09-30T10:00:00Z',
    );

    visibilities.sees(
      runId,
      aSearchVisibility({
        stationId: BUILD,
        heldOutTasks: [heldOut],
        shownOriginals: [original, shown],
        candidates: [
          {
            name: 'oldest-first',
            fingerprint: 'c'.repeat(64),
            hypothesis: 'Draining oldest first stops the stall.',
            block: BUILD_BLOCK,
            runs: [candidate, heldOutCandidate].map((each) => ({
              runId: each,
              original: each === candidate ? original : hidden,
              repeat: 1,
              succeeded: true,
              reasons: [],
              verdict: 'pass',
            })),
          },
        ],
      }),
    );

    await runner(token)
      .get(`/api/runs/${runId}/history?station=ship`)
      .expect(404);

    const history = (
      await runner(token)
        .get(`/api/runs/${runId}/history?station=build&last=1`)
        .expect(200)
    ).body as {
      runs: { runId: string; taskId: string }[];
      candidates: {
        candidateName: string;
        fingerprint: string;
        hypothesis: string;
        block: unknown;
        runs: {
          runId: string;
          original: string;
          succeeded: boolean | null;
          reasons: string[];
          verdict: string | null;
          changes: { path: string }[];
          title: string;
        }[];
      }[];
      seedBlock: unknown;
      configs: { fingerprint: string }[];
    };

    expect(history.runs.map((each) => each.taskId)).not.toContain(heldOut);
    expect(history.runs.map((each) => each.runId)).toEqual(
      expect.arrayContaining([original, shown]),
    );
    expect(history.seedBlock).toEqual(BUILD_BLOCK);
    expect(history.candidates).toHaveLength(1);
    expect(history.candidates[0]).toMatchObject({
      candidateName: 'oldest-first',
      fingerprint: 'c'.repeat(64),
      hypothesis: 'Draining oldest first stops the stall.',
      block: BUILD_BLOCK,
    });
    expect(history.candidates[0]?.runs).toHaveLength(1);
    expect(history.candidates[0]?.runs[0]).toMatchObject({
      runId: candidate,
      original,
      succeeded: true,
      reasons: [],
      verdict: 'pass',
      title: 'Drain the queue',
    });
    expect(history.candidates[0]?.runs[0]?.changes.length).toBeGreaterThan(0);
  });

  it('fails rather than show an unfiltered history when its search cannot be seen', async () => {
    const { runId, token } = await aClaimedSearch();

    const answer = await runner(token).get(
      `/api/runs/${runId}/history?station=build`,
    );

    expect(answer.status).toBe(404);
    expect(answer.body.detail ?? answer.body.message).toBe(
      `No search ran ${runId}`,
    );
    expect(answer.body.runs).toBeUndefined();
  });

  it('reads the trace of a task it may see at the station it searches, and of no held-out task or task worked elsewhere', async () => {
    const { runId, token } = await aClaimedSearch();
    const seen = await aTask('Drain the queue again');
    const heldOut = await aTask('Retry the upload again');
    const elsewhere = await aTask('Ship the release');

    const atBuild = await aTaskRun(seen, '2026-09-21T09:00:00Z');
    const atShip = await aTaskRun(seen, '2026-09-21T10:00:00Z', SHIP);
    await aTaskRun(heldOut, '2026-09-22T09:00:00Z');
    await aTaskRun(elsewhere, '2026-09-23T09:00:00Z', SHIP);
    visibilities.sees(
      runId,
      aSearchVisibility({ stationId: BUILD, heldOutTasks: [heldOut] }),
    );

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
      .expect(200);
    await untilUsageRecorded(runId);

    expect((await runRow(runId))?.state).toBe('completed');

    const [endedEvent] = await published('work.search-run-ended.v1', runId);

    expect(endedEvent?.payload).toMatchObject({
      searchId: queued.searchId,
      iteration: 4,
      teamId: team.teamId.value,
      stationId: BUILD,
      workspaceId: team.workspaceId.value,
      outcome: 'completed',
      failure: null,
      asked: false,
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
    expect(await published('work.search-run-usage-recorded.v1', runId)).toEqual(
      [
        {
          payload: expect.objectContaining({
            kind: 'work.search-run-usage-recorded.v1',
            searchId: queued.searchId,
          }),
        },
      ],
    );

    for (const kind of [
      'work.run-ended.v1',
      'work.replay-ended.v1',
      'work.run-usage-recorded.v1',
      'work.replay-run-usage-recorded.v1',
      'work.run-briefed.v1',
    ]) {
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
    ).toEqual({ decision: 'asked' });
    expect(
      (
        await runner(token)
          .post(`/api/runs/${runId}/completion`, finishing('review'))
          .expect(200)
      ).body,
    ).toEqual({ waiting: false });
    await untilUsageRecorded(runId);

    expect((await runRow(runId))?.askedAPerson).toBe(true);

    const [endedEvent] = await published('work.search-run-ended.v1', runId);

    expect(endedEvent?.payload).toMatchObject({ asked: true });
  });

  it('is cancelled before a runner claims it, still saying so as a search’s end', async () => {
    const queued = order();
    const dispatch = app.get<SearchDispatchPort>(SEARCH_DISPATCH);

    await dispatch.enqueue(queued);
    await dispatch.cancel(queued.id);

    expect((await runRow(queued.id))?.state).toBe('cancelled');
    await eventually(
      async () =>
        (await published('work.search-run-ended.v1', queued.id)).length === 1,
    );
    expect(await published('work.run-ended.v1', queued.id)).toEqual([]);
  });
});

describe('who may watch a search run', () => {
  it('is someone who reads its team, never someone outside it', async () => {
    const queued = order();

    await app.get<SearchDispatchPort>(SEARCH_DISPATCH).enqueue(queued);

    const reader = app.get<RunEventReaderPort>(RUN_EVENT_READER);

    expect(
      await reader.findForViewer(RunId.of(queued.id), team.owner),
    ).not.toBeNull();
    expect(
      await reader.findForViewer(RunId.of(queued.id), UserId.of(randomUUID())),
    ).toBeNull();
  });
});
