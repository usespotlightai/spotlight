import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import {
  ATTACHMENT_STORE,
  type AttachmentStorePort,
} from '@work/application/ports/attachment-store.port';
import {
  WORKSPACE_ARCHIVE_STORE,
  type WorkspaceArchiveStorePort,
} from '@work/application/ports/workspace-archive-store.port';
import { DispatchReplay } from '@work/application/services/dispatch-replay.service';
import { candidateOf } from '@work/application/services/replay-candidates.fake-spec';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const HOST = `host-replay-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'p'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const SHIP = randomUUID();
const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';

const attachmentStore = {
  received: async () => [],
  taken: async () => undefined,
  open: async () => ({
    bytes: new Uint8Array([1, 2, 3, 4]),
    contentType: 'image/png',
  }),
} as unknown as AttachmentStorePort;

const archiveStore: WorkspaceArchiveStorePort = {
  grantUpload: async (archive) => ({
    url: `https://archives.test/${archive.id.value}`,
    headers: {},
  }),
  stored: async (archive) => ({ size: archive.size, digest: archive.digest }),
  grantDownload: async (archive) =>
    `https://archives.test/${archive.id.value}?download`,
  remove: async () => {},
};

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;
let memoryHandle: number;
let memoryId: string;

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

interface Original {
  readonly taskId: string;
  readonly runId: string;
  readonly archiveId: string;
  readonly briefedFile: string;
  readonly laterFile: string;
}

interface Claimed {
  readonly id: string;
  readonly attempt: number;
  readonly spec: Record<string, unknown>;
}

const anOriginal = async (): Promise<Original> => {
  const taskId = randomUUID();
  const runId = randomUUID();
  const archiveId = randomUUID();
  const briefedFile = randomUUID();
  const laterFile = randomUUID();
  const at = new Date();

  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: BUILD,
    title: 'Drain the queue',
    description: 'It stalls on restart.',
    raisedAtStationId: BUILD,
    raisedById: team.owner.value,
    assigneeId: team.owner.value,
  });
  await db.insert(schema.taskAttachment).values(
    [briefedFile, laterFile].map((id, place) => ({
      id,
      taskId,
      place,
      name: `queue-${place}.png`,
      contentType: 'image/png',
      size: 4,
    })),
  );
  await db.insert(schema.workspaceArchive).values({
    id: archiveId,
    workspaceId: team.workspaceId.value,
    continuityKey: `task-${taskId}`,
    taskId,
    grantedToRunId: randomUUID(),
    size: 1_024,
    sha256: 'a'.repeat(64),
    grantedAt: at,
    sealedAt: at,
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: team.workspaceId.value,
    taskId,
    taskRevision: 0,
    stationId: BUILD,
    harness: 'claude-code',
    state: 'completed',
    exitCode: 0,
    spec: {
      checkouts: [
        {
          remote: 'spotlight:repository',
          path: 'api',
          branch: `spotlight/${taskId}`,
        },
      ],
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'Drain the queue.',
      handover: { options: ['ship', 'review'], noteLimit: 0 },
      continuity: { key: `task-${taskId}` },
      startingPoint: true,
    },
    briefedTask: BriefedTask.of({
      stationId: StationId.of(BUILD),
      title: 'Drain the queue',
      description: 'It stalls on restart.',
      reviewing: null,
      attachments: [
        Attachment.of({
          id: briefedFile,
          name: 'queue-0.png',
          contentType: 'image/png',
          size: 4,
        }),
      ],
      notes: [],
      openRemarks: [],
    }).parts,
    briefedMemories: {
      briefed: [{ id: memoryId, handle: `M-${memoryHandle}` }],
      cut: [],
    },
    startedFromArchiveId: archiveId,
    startedFromCheckouts: [{ path: 'api', commit: COMMIT }],
    startedFromAttempt: 1,
    startedFromAt: at,
  });

  return { taskId, runId, archiveId, briefedFile, laterFile };
};

const candidate = async (): Promise<Line> => {
  const line = await app
    .get(DrizzleLineRepository)
    .findByStation(StationId.of(BUILD));

  if (!line) {
    throw new Error('the delivery line is not there');
  }

  return candidateOf(line, StationId.of(BUILD), {
    agentPrompt: AgentPrompt.of('Replay this, and say what you would change.'),
  });
};

const replayed = async (original: Original): Promise<string> =>
  (
    await app.get(DispatchReplay).enqueue({
      original: RunId.of(original.runId),
      candidate: await candidate(),
    })
  ).value;

const claimed = async (
  replayId: string,
): Promise<{ token: string; run: Claimed }> => {
  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({
      session: 'session_1',
      name: 'build-box',
      release: '0.1.0',
      executor: 'docker',
      capacity: 8,
      running: [],
      images: [
        {
          image: IMAGE,
          usual: true,
          harnesses: [{ id: 'claude-code', models: [] }],
        },
      ],
    })
    .expect(200);

  const handed = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as { token: string; work: { run: Claimed } };

  expect(handed.work.run.id).toBe(replayId);

  return { token: handed.token, run: handed.work.run };
};

const aClaimedReplay = async () => {
  const original = await anOriginal();
  const replayId = await replayed(original);
  const { token, run } = await claimed(replayId);

  return { original, replayId, token, run };
};

const runRow = async (runId: string) => {
  const [row] = await db
    .select()
    .from(schema.run)
    .where(eq(schema.run.id, runId));

  return row;
};

const taskRow = async (taskId: string) => {
  const [row] = await db
    .select()
    .from(schema.task)
    .where(eq(schema.task.id, taskId));

  return row;
};

const notesOf = (taskId: string) =>
  db.select().from(schema.taskNote).where(eq(schema.taskNote.taskId, taskId));

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

const settled = (runId: string) =>
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
    const delivered = await db
      .select({ subscriber: schema.eventDelivery.subscriber })
      .from(schema.eventDelivery)
      .innerJoin(
        schema.eventOutbox,
        eq(schema.eventOutbox.id, schema.eventDelivery.eventId),
      )
      .where(
        and(
          eq(schema.eventOutbox.kind, 'run.completed'),
          sql`${schema.eventOutbox.payload} -> 'runId' ->> 'value' = ${runId}`,
          sql`${schema.eventDelivery.deliveredAt} IS NOT NULL`,
        ),
      );

    return pending.length === 0 && delivered.length > 0;
  });

const inboxHas = async (taskId: string): Promise<boolean> =>
  (
    (
      await http()
        .get(`/api/workspaces/${team.slug}/inbox`)
        .set(TEST_USER_HEADER, team.owner.value)
        .expect(200)
    ).body as { taskId: string }[]
  ).some((each) => each.taskId === taskId);

const finishing = (next: string) => ({
  exitCode: 0,
  failed: false,
  outcome: { next, note: 'Done here.' },
  sessionId: 'session_1',
  kept: true,
});

beforeAll(async () => {
  app = await openApp((module) =>
    module
      .overrideProvider(WORKSPACE_ARCHIVE_STORE)
      .useValue(archiveStore)
      .overrideProvider(ATTACHMENT_STORE)
      .useValue(attachmentStore),
  );
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `replay-${randomUUID().slice(0, 8)}`,
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
      diffs: true,
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
  await db.insert(schema.stationRoute).values({
    stationId: BUILD,
    toStationId: SHIP,
  });

  memoryId = randomUUID();
  const [kept] = await db
    .insert(schema.memory)
    .values({
      id: memoryId,
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
  memoryHandle = kept?.handle ?? 0;

  await http()
    .post(`/api/resources/workspaces/${team.workspaceId.value}/runner-pools`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ key: 'hosts', labels: ['linux'], token: POOL_TOKEN })
    .expect(201);
}, 60_000);

afterAll(async () => {
  await forgetRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('a replay claimed by a runner', () => {
  it('is handed the candidate’s spec, starting at the original’s archive and commits, with no tools, secrets or starting-point report', async () => {
    const { original, replayId, run } = await aClaimedReplay();
    const spec = run.spec as {
      checkouts: unknown;
      replay: unknown;
      continuity: unknown;
      briefing: string;
      manifest?: unknown;
      injectedSecrets?: unknown;
      startingPoint?: unknown;
      diffs?: boolean;
    };

    expect(run.attempt).toBe(1);
    expect(spec.replay).toEqual({
      archive: original.archiveId,
      checkouts: [{ path: 'api', commit: COMMIT, repository: 'acme/api' }],
      movesOnAfter: ['ship'],
    });
    expect(spec.checkouts).toEqual([
      { remote: 'spotlight:repository', path: 'api', ref: COMMIT },
    ]);
    expect(spec.continuity).toEqual({ key: `replay-${replayId}` });
    expect(spec.briefing).toContain(
      'Replay this, and say what you would change.',
    );
    expect(spec.briefing).toContain('## Drain the queue');
    expect(spec.briefing).toContain('Queues drain oldest first.');
    expect(spec.manifest).toBeUndefined();
    expect(spec.injectedSecrets).toBeUndefined();
    expect(spec.startingPoint).toBeUndefined();
    expect(spec.diffs).toBe(true);

    const row = await runRow(replayId);
    expect(row?.taskId).toBeNull();
    expect(row?.replayOfRunId).toBe(original.runId);
    expect(
      (await app.get(DrizzleRunRepository).findById(RunId.of(replayId)))
        ?.subject?.replayedTaskId?.value,
    ).toBe(original.taskId);
    expect(row?.stationFingerprint).not.toBeNull();
    expect(row?.priority).toBe(-1);
  });

  it('reads the files its original was briefed with, and none added since', async () => {
    const { original, replayId, token } = await aClaimedReplay();

    await runner(token)
      .get(`/api/runs/${replayId}/attachments/${original.briefedFile}`)
      .expect(200);
    await runner(token)
      .get(`/api/runs/${replayId}/attachments/${original.laterFile}`)
      .expect(404);
  });

  it('restores exactly the archive its original started from', async () => {
    const { original, replayId, token } = await aClaimedReplay();

    const archive = await runner(token)
      .get(`/api/runs/${replayId}/workspace-archive`)
      .expect(200);

    expect(archive.body.id).toBe(original.archiveId);
  });

  it('keeps no workspace of its own, and says nothing of where it started', async () => {
    const { replayId, token } = await aClaimedReplay();

    await runner(token)
      .post(`/api/runs/${replayId}/workspace-archive`, {
        size: 10,
        sha256: 'b'.repeat(64),
      })
      .expect(409);
    await runner(token)
      .post(`/api/runs/${replayId}/starting-point`, {
        attempt: 1,
        archiveId: null,
        checkouts: [{ path: 'api', commit: COMMIT }],
      })
      .expect(409);
  });

  it('may fetch, but never push', async () => {
    const { replayId, token } = await aClaimedReplay();

    await runner(token)
      .post(`/api/git/${replayId}/api/git-receive-pack`)
      .expect(409);
    await runner(token)
      .get(`/api/git/${replayId}/api/info/refs?service=git-receive-pack`)
      .expect(409);
    await runner(token)
      .get(`/api/git/${replayId}/api/info/refs?service=git-upload-pack`)
      .expect(404);
  });

  it('uses no tool, answers no remark, takes up nothing said, reads no trace, and remembers nothing', async () => {
    const { original, replayId, token } = await aClaimedReplay();

    await runner(token)
      .post(`/api/runs/${replayId}/tools/linear.comment`, { body: 'hi' })
      .expect(403);
    await runner(token)
      .post(`/api/runs/${replayId}/remark`, {
        handle: 'R-1',
        body: 'Fixed.',
        resolve: true,
      })
      .expect(409);
    await runner(token)
      .post(`/api/runs/${replayId}/messages/delivered`, { upTo: 0 })
      .expect(409);
    await runner(token)
      .post(`/api/runs/${replayId}/memories`, {
        kind: 'rationale',
        body: 'Queues drain newest first.',
      })
      .expect(409);
    await runner(token)
      .get(`/api/runs/${replayId}/trace/${original.taskId}`)
      .expect(409);
    expect(
      (await runner(token).get(`/api/runs/${replayId}/messages`).expect(200))
        .body,
    ).toEqual([]);
  });

  it('recalls what the team remembers without counting it as used', async () => {
    const { replayId, token } = await aClaimedReplay();

    await runner(token)
      .post(`/api/runs/${replayId}/memories/M-${memoryHandle}/recall`)
      .expect(200);

    expect(
      await db
        .select()
        .from(schema.memoryUse)
        .where(eq(schema.memoryUse.runId, replayId)),
    ).toEqual([]);
  });
});

describe('a replay ending', () => {
  it('records its handover as its own result, and leaves the original task as it was', async () => {
    const { original, replayId, token } = await aClaimedReplay();
    const before = await taskRow(original.taskId);
    const notesBefore = await notesOf(original.taskId);

    expect(
      (
        await runner(token)
          .post(`/api/runs/${replayId}/completion/asks`, finishing('ship'))
          .expect(200)
      ).body,
    ).toEqual({ asks: false });
    expect(
      (
        await runner(token)
          .post(`/api/runs/${replayId}/completion`, finishing('ship'))
          .expect(200)
      ).body,
    ).toEqual({ waiting: false });

    await settled(replayId);

    const after = await taskRow(original.taskId);
    expect(after?.stationId).toBe(before?.stationId);
    expect(after?.rank).toBe(before?.rank);
    expect(after?.version).toBe(before?.version);
    expect(after?.currentRunId).toBeNull();
    expect(after?.sessionId).toBeNull();
    expect(await notesOf(original.taskId)).toEqual(notesBefore);
    expect(await inboxHas(original.taskId)).toBe(false);

    const row = await runRow(replayId);
    expect(row?.state).toBe('completed');
    expect(row?.askedAPerson).toBe(false);

    const [ended] = await published('work.replay-ended.v1', replayId);
    expect(ended?.payload).toMatchObject({
      replayOf: original.runId,
      outcome: 'completed',
      asked: false,
      next: 'ship',
      note: 'Done here.',
    });
  });

  it('ends at once when it asks a person, saying so, and putting nothing in the inbox', async () => {
    const { original, replayId, token } = await aClaimedReplay();

    expect(
      (
        await runner(token)
          .post(`/api/runs/${replayId}/permissions`, {
            sessionId: 'session_1',
            kind: 'execute',
            title: 'rm -rf node_modules',
            input: { command: 'rm -rf node_modules' },
          })
          .expect(200)
      ).body,
    ).toEqual({ decision: 'asked' });
    await runner(token)
      .post(`/api/runs/${replayId}/parked`, { cold: true })
      .expect(409);
    expect(
      (
        await runner(token)
          .post(`/api/runs/${replayId}/completion`, finishing('review'))
          .expect(200)
      ).body,
    ).toEqual({ waiting: false });

    await settled(replayId);

    expect((await runRow(replayId))?.state).toBe('completed');
    expect((await runRow(replayId))?.askedAPerson).toBe(true);
    expect(await inboxHas(original.taskId)).toBe(false);
    expect(await notesOf(original.taskId)).toEqual([]);

    const [ended] = await published('work.replay-ended.v1', replayId);
    expect(ended?.payload).toMatchObject({ asked: true, next: 'review' });
  });

  it('wakes none of what a task run’s end wakes', async () => {
    const { original, replayId, token } = await aClaimedReplay();

    await runner(token)
      .post(`/api/runs/${replayId}/completion`, finishing('ship'))
      .expect(200);
    await settled(replayId);

    for (const kind of [
      'work.run-ended.v1',
      'work.run-digested.v1',
      'work.run-briefed.v1',
      'work.task-handed-to-run.v1',
    ]) {
      expect(await published(kind, replayId)).toEqual([]);
    }
    expect(
      await db
        .select()
        .from(schema.runRecord)
        .where(eq(schema.runRecord.runId, replayId)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.memoryDraft)
        .where(eq(schema.memoryDraft.taskId, original.taskId)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.runDigest)
        .where(eq(schema.runDigest.runId, replayId)),
    ).toHaveLength(1);
  });
});
