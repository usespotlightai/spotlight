import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { OpenSandboxCommand } from '@runners/application/commands/sandbox.commands';
import type { OpenedSandbox } from '@runners/application/ports/sandboxes.port';
import { Sandboxes } from '@runners/application/services/sandboxes.service';
import {
  WARM_LINES,
  type WarmLinesPort,
} from '@runs/application/ports/warm-lines.port';
import {
  WORKING_COPY_ARCHIVE_STORE,
  type WorkingCopyArchiveStorePort,
} from '@runs/application/ports/working-copy-archive-store.port';
import { WarmSandboxKeeping } from '@runs/application/services/warm-sandbox-keeping.service';
import { WarmFingerprint } from '@runs/domain/value-objects/warm-fingerprint.vo';
import { RunLeasesWorker } from '@runs/presentation/workers/run-leases.worker';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { deleteRunnersOf } from './support/runners';
import {
  requestedByChat,
  requestedByReplay,
  requestedByTask,
} from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { seatTeam } from './support/team';

const IMAGE = 'ghcr.io/acme/runner:main';

const HOST = 'host-sandboxes-1';

const SHA256 = 'd'.repeat(64);

const archiveStore: WorkingCopyArchiveStorePort = {
  grantUpload: async (archive) => ({
    url: `https://archives.test/${archive.id.value}`,
    headers: {},
  }),
  stored: async (archive) => ({ size: archive.size, digest: archive.digest }),
  grantDownload: async (archive) =>
    `https://archives.test/${archive.id.value}?download`,
  remove: async () => {},
};

type Claimed = {
  sandboxId: string;
  token: string;
  sandboxToken: string;
};

const tokenOf = (seed: string): string =>
  `${seed.repeat(8)}${randomUUID().replaceAll('-', '')}`;

const requestedFor = (key: string) => {
  const name = key.slice(key.indexOf('/') + 1);

  if (key.startsWith('work/task-')) {
    return requestedByTask(name.slice('task-'.length));
  }

  if (key.startsWith('work/chat-')) {
    return requestedByChat(name.slice('chat-'.length));
  }

  return requestedByReplay(name.slice('replay-'.length));
};

describe('sandboxes (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let unseat: () => Promise<void>;
  let token: string;

  const http = () => served(app);

  const queue = async (
    input: {
      key?: string;
      chatId?: string | null;
      harness?: string;
      line?: string;
      lineFingerprint?: string | null;
    } = {},
  ) => {
    const id = randomUUID();
    const line = input.line
      ? ((await app.get<WarmLinesPort>(WARM_LINES).keepingWarmSandboxes()).find(
          (each) => each.id.value === input.line,
        ) ?? null)
      : null;

    await db.insert(schema.run).values({
      id,
      workspaceId,
      harness: input.harness ?? 'dev',
      state: 'queued',
      lineId: input.line ?? null,
      lineFingerprint:
        input.lineFingerprint !== undefined
          ? input.lineFingerprint
          : line && WarmFingerprint.ofSetup(line).value,
      ...requestedFor(input.key ?? `work/task-${id}`),
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'do the thing',
        handover: { options: [], noteLimit: 0 },
        resume: {},
      },
    });

    return id;
  };

  const claim = (sandbox?: string) =>
    http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${token}`)
      .send({ host: HOST, image: IMAGE, sandbox });

  const complete = (runId: string, runnerToken: string) =>
    http()
      .post(`/api/runs/${runId}/completion`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send({ exitCode: 0, failed: false })
      .expect(204);

  const idleAndReady = async (key: string) => {
    const runId = await queue({ key });
    const claimed = (await claim().expect(200)).body as Claimed;
    const sandboxId = claimed.sandboxId;
    await heartbeat([sandboxId]).expect(200);
    await complete(runId, claimed.token);
    await eventually(async () =>
      (await sandboxRow(sandboxId))?.idleSince ? true : null,
    );

    return sandboxId;
  };

  const heartbeat = (sandboxes: string[] = []) =>
    http()
      .put(`/api/hosts/${HOST}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bootId: 'boot_1',
        name: 'build-box',
        release: '0.1.0',
        containerRuntime: 'docker',
        capacity: 2,
        sandboxes: sandboxes.map((id) => ({ id })),
        images: [
          {
            image: IMAGE,
            isDefault: true,
            harnesses: [{ id: 'dev', models: [] }],
          },
        ],
      });

  const sandboxRow = async (id: string) => {
    const [row] = await db
      .select()
      .from(schema.sandbox)
      .where(eq(schema.sandbox.id, id));

    return row ?? null;
  };

  const open = (key: string) =>
    app
      .get(CommandBus)
      .execute<OpenSandboxCommand, OpenedSandbox>(
        new OpenSandboxCommand(workspaceId, key),
      );

  const archive = (sandboxId: string, sandboxToken: string) => ({
    read: () =>
      http()
        .get(`/api/sandboxes/${sandboxId}/working-copy-archive`)
        .set('Authorization', `Bearer ${sandboxToken}`),
    grant: () =>
      http()
        .post(`/api/sandboxes/${sandboxId}/working-copy-archive`)
        .set('Authorization', `Bearer ${sandboxToken}`)
        .send({ size: 2_048, sha256: SHA256 }),
    complete: (archiveId: string) =>
      http()
        .post(
          `/api/sandboxes/${sandboxId}/working-copy-archive/${archiveId}/complete`,
        )
        .set('Authorization', `Bearer ${sandboxToken}`),
  });

  beforeAll(async () => {
    app = await openApp((module) =>
      module
        .overrideProvider(WORKING_COPY_ARCHIVE_STORE)
        .useValue(archiveStore),
    );
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspaceId = `sandboxes-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    unseat = seat.unseat;
    token = tokenOf('s');
    await http()
      .post(`/api/v1/resources/workspaces/${workspaceId}/runner-pools`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'sandboxes', token })
      .expect(201);
    await heartbeat().expect(200);
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(inArray(schema.idempotentCreate.scope, [`person:${owner}`]));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId));
    await deleteRunnersOf(db, workspaceId);
    await unseat();
  });

  it('starts a sandbox for each claimed run, held by the run, under its resume key', async () => {
    const runId = await queue({ key: 'work/task-task_1' });

    const claimed = (await claim().expect(200)).body as Claimed;

    expect(claimed.sandboxId).toEqual(expect.any(String));
    expect(await sandboxRow(claimed.sandboxId)).toMatchObject({
      workspaceId,
      key: 'work/task-task_1',
      hostId: HOST,
      state: 'open',
      leases: [
        {
          kind: 'run',
          holder: runId,
          renewedAt: expect.any(String) as unknown,
        },
      ],
      idleSince: null,
    });
  });

  it('drains a reported sandbox once its run ended and it stayed idle past the grace, then loses it once the host stops reporting it', async () => {
    const runId = await queue();
    const claimed = (await claim().expect(200)).body as Claimed;
    const sandboxId = claimed.sandboxId;

    await expect(
      heartbeat([sandboxId, 'sandbox-unknown']).expect(200),
    ).resolves.toMatchObject({ body: { drain: ['sandbox-unknown'] } });
    expect((await sandboxRow(sandboxId))?.state).toBe('open');

    await complete(runId, claimed.token);
    const released = await eventually(async () => {
      const row = await sandboxRow(sandboxId);
      return row?.idleSince ? row : null;
    });
    expect(released.leases).toEqual([]);

    await db
      .update(schema.sandbox)
      .set({ idleSince: new Date(Date.now() - 10 * 60_000 - 1_000) })
      .where(eq(schema.sandbox.id, sandboxId));
    await app.get(Sandboxes).drainIdle(new Date());

    expect((await sandboxRow(sandboxId))?.state).toBe('draining');
    await expect(heartbeat([sandboxId]).expect(200)).resolves.toMatchObject({
      body: { drain: [sandboxId] },
    });

    await heartbeat([]).expect(200);

    expect(
      await eventually(async () => {
        const row = await sandboxRow(sandboxId);
        return row?.state === 'gone' ? row : null;
      }),
    ).toMatchObject({ state: 'gone', goneAt: expect.any(Date) as unknown });
  });

  it('runs the next run of a key in its ready sandbox, claimed only by that sandbox’s host for it', async () => {
    const sandboxId = await idleAndReady('work/task-task_3');
    const next = await queue({ key: 'work/task-task_3' });

    await claim().expect(204);
    const reused = await claim(sandboxId).expect(200);

    expect(reused.body).toMatchObject({
      sandboxId,
      reused: true,
      work: { kind: 'run', run: { id: next } },
    });
    expect(await sandboxRow(sandboxId)).toMatchObject({
      state: 'open',
      leases: [
        { kind: 'run', holder: next, renewedAt: expect.any(String) as unknown },
      ],
      idleSince: null,
    });
  });

  it('takes nothing into a sandbox for a run of another key, nor into a sandbox with a run in it', async () => {
    const sandboxId = await idleAndReady('work/task-task_4');
    await queue({ key: 'work/task-task_5' });

    await claim(sandboxId).expect(204);

    const other = (await claim().expect(200)).body as Claimed;
    expect(other.sandboxId).not.toBe(sandboxId);

    const busy = other.sandboxId;
    await heartbeat([sandboxId, busy]).expect(200);
    await queue({ key: 'work/task-task_5' });
    await claim(busy).expect(204);
  });

  it('holds a sandbox for the archive of the run in it after the report, journals under the reporting attempt, and takes the next run once released', async () => {
    const key = 'work/task-task_archive';
    const runId = await queue({ key });
    const claimed = (await claim().expect(200)).body as Claimed;
    const { sandboxId, sandboxToken } = claimed;
    await heartbeat([sandboxId]).expect(200);
    const lease = `/api/sandboxes/${sandboxId}/archive-leases/${runId}`;
    const events = (seq: number) =>
      http()
        .post(`${lease}/events`)
        .set('Authorization', `Bearer ${sandboxToken}`)
        .send({
          events: [
            {
              seq,
              type: 'output',
              at: new Date().toISOString(),
              message: 'archive',
              data: 'Captured the workspace for the next run (2.0 KB)',
            },
          ],
        });

    await http()
      .put(lease)
      .set('Authorization', `Bearer ${claimed.token}`)
      .send({ attempt: 1 })
      .expect(404);
    await http()
      .put(`/api/sandboxes/${sandboxId}/archive-leases/${randomUUID()}`)
      .set('Authorization', `Bearer ${sandboxToken}`)
      .send({ attempt: 1 })
      .expect(404);
    await http()
      .put(lease)
      .set('Authorization', `Bearer ${sandboxToken}`)
      .send({ attempt: 1 })
      .expect(204);
    await events(900).expect(409);

    await complete(runId, claimed.token);
    const archiving = await eventually(async () => {
      const row = await sandboxRow(sandboxId);
      return row?.leases.length === 1 ? row : null;
    });
    expect(archiving).toMatchObject({
      state: 'open',
      leases: [{ kind: 'archive', holder: runId }],
      idleSince: null,
    });

    const next = await queue({ key });
    await claim().expect(204);
    await claim(sandboxId).expect(204);

    await http()
      .put(lease)
      .set('Authorization', `Bearer ${sandboxToken}`)
      .send({ attempt: 2 })
      .expect(404);
    await http()
      .put(lease)
      .set('Authorization', `Bearer ${sandboxToken}`)
      .send({ attempt: 1 })
      .expect(204);
    await events(900).expect(204);
    const journaled = await db
      .select({
        attempt: schema.runJournalEntry.attempt,
        seq: schema.runJournalEntry.seq,
      })
      .from(schema.runJournalEntry)
      .where(
        and(
          eq(schema.runJournalEntry.runId, runId),
          eq(schema.runJournalEntry.message, 'archive'),
        ),
      );
    expect(journaled).toEqual([{ attempt: 1, seq: 900 }]);

    await http()
      .delete(`${lease}?attempt=1`)
      .set('Authorization', `Bearer ${sandboxToken}`)
      .expect(204);
    await events(902).expect(404);
    expect((await sandboxRow(sandboxId))?.idleSince).not.toBeNull();
    await expect(claim(sandboxId).expect(200)).resolves.toMatchObject({
      body: { sandboxId, work: { kind: 'run', run: { id: next } } },
    });
  });

  it('drops an archive lease nobody renewed, and the sandbox takes runs again', async () => {
    const key = 'work/task-task_unrenewed';
    const runId = await queue({ key });
    const claimed = (await claim().expect(200)).body as Claimed;
    const { sandboxId, sandboxToken } = claimed;
    await heartbeat([sandboxId]).expect(200);
    await http()
      .put(`/api/sandboxes/${sandboxId}/archive-leases/${runId}`)
      .set('Authorization', `Bearer ${sandboxToken}`)
      .send({ attempt: 1 })
      .expect(204);
    await complete(runId, claimed.token);
    const held = await eventually(async () => {
      const row = await sandboxRow(sandboxId);
      return row?.leases.length === 1 ? row : null;
    });

    await app.get(Sandboxes).drainIdle(new Date());
    expect((await sandboxRow(sandboxId))?.leases).toHaveLength(1);

    await db
      .update(schema.sandbox)
      .set({
        leases: held.leases.map((each) => ({
          ...each,
          renewedAt: new Date(Date.now() - 2 * 60_000 - 1_000).toISOString(),
        })),
      })
      .where(eq(schema.sandbox.id, sandboxId));
    await app.get(Sandboxes).drainIdle(new Date());

    expect(await sandboxRow(sandboxId)).toMatchObject({
      state: 'open',
      leases: [],
      idleSince: expect.any(Date) as unknown,
    });
  });

  it('counts an idle sandbox and the claim that waits in it as one run against maxRuns', async () => {
    await db
      .update(schema.runnerPool)
      .set({ maxRuns: 2 })
      .where(eq(schema.runnerPool.workspaceId, workspaceId));
    const sandboxId = await idleAndReady('work/task-task_8');
    await heartbeat([sandboxId]).expect(200);

    let answered = false;
    const waiting = claim(sandboxId)
      .expect(204)
      .then(() => {
        answered = true;
      });
    await eventually(async () => {
      const [row] = await db
        .select({ id: schema.runner.id })
        .from(schema.runner)
        .where(
          and(
            eq(schema.runner.entersSandboxId, sandboxId),
            isNull(schema.runner.endedAt),
          ),
        );

      return row ?? null;
    });
    const runId = await queue({ key: 'work/task-task_9' });

    const other = await claim().expect(200);

    expect(other.body).toMatchObject({ work: { run: { id: runId } } });
    expect(answered).toBe(false);
    await waiting;
  });

  it('starts a fresh sandbox for the next run of a key once its draining sandbox is gone', async () => {
    const sandboxId = await idleAndReady('work/task-task_6');
    await db
      .update(schema.sandbox)
      .set({ state: 'draining' })
      .where(eq(schema.sandbox.id, sandboxId));
    const next = await queue({ key: 'work/task-task_6' });

    await claim().expect(204);
    await heartbeat([]).expect(200);
    await eventually(async () =>
      (await sandboxRow(sandboxId))?.state === 'gone' ? true : null,
    );

    const fresh = await claim().expect(200);

    expect(fresh.body).toMatchObject({
      reused: false,
      work: { kind: 'run', run: { id: next } },
    });
    expect((fresh.body as Claimed).sandboxId).not.toBe(sandboxId);
  });

  it('leaves the next run of a key to its sandbox while that sandbox starts', async () => {
    const first = await queue({ key: 'work/task-task_2' });
    const earlier = (await claim().expect(200)).body as Claimed;
    await complete(first, earlier.token);
    await queue({ key: 'work/task-task_2' });

    await claim().expect(204);

    expect((await sandboxRow(earlier.sandboxId))?.state).toBe('open');
  });

  it('hands out no second run of a chat while an earlier run of it holds its lease', async () => {
    const chatId = randomUUID();
    await db.insert(schema.chat).values({
      id: chatId,
      workspaceId,
      teamId: 'team_1',
      startedById: 'user_1',
      title: 'Plan the queue',
      harness: 'dev',
    });
    await queue({ key: `work/chat-${chatId}`, chatId });
    await claim().expect(200);
    await queue({ key: `work/chat-${chatId}`, chatId });

    await claim().expect(204);
  });
  describe('a sandbox with no run', () => {
    it('is requested on no host, started by the next host claim with a token of its own, and then takes the runs of its key', async () => {
      const opened = await open('work/task-task_7');
      expect(opened.state).toBe('starting');
      expect(await sandboxRow(opened.id)).toMatchObject({
        hostId: null,
        tokenHash: null,
        leases: [],
      });
      await expect(open('work/task-task_7')).resolves.toEqual(opened);

      const started = await claim().expect(200);

      expect(started.body).toMatchObject({
        runnerId: null,
        token: null,
        egressToken: null,
        sandboxId: opened.id,
        sandboxToken: expect.any(String) as unknown,
        allowedHosts: expect.any(Array) as unknown,
        work: { kind: 'sandbox', run: null, check: null },
      });
      expect(await sandboxRow(opened.id)).toMatchObject({
        hostId: HOST,
        state: 'open',
        tokenHash: expect.any(String) as unknown,
        idleSince: expect.any(Date) as unknown,
      });

      await heartbeat([opened.id]).expect(200);
      const next = await queue({ key: 'work/task-task_7' });
      await claim().expect(204);

      const into = await claim(opened.id).expect(200);
      expect(into.body).toMatchObject({
        sandboxId: opened.id,
        sandboxToken: null,
        reused: true,
        work: { kind: 'run', run: { id: next } },
      });
    });

    it('starts before a queued run of another key', async () => {
      const waiting = await queue({ key: 'replays/replay-run_waiting' });
      const opened = await open('work/task-task_13');

      const started = await claim().expect(200);

      expect(started.body).toMatchObject({
        sandboxId: opened.id,
        work: { kind: 'sandbox' },
      });

      const next = await claim().expect(200);
      expect(next.body).toMatchObject({
        work: { kind: 'run', run: { id: waiting } },
      });
    });

    it('is the sandbox a queued run of its key starts in', async () => {
      const opened = await open('work/task-task_8');
      const runId = await queue({ key: 'work/task-task_8' });

      const claimed = await claim().expect(200);

      expect(claimed.body).toMatchObject({
        sandboxId: opened.id,
        sandboxToken: expect.any(String) as unknown,
        reused: false,
        work: { kind: 'run', run: { id: runId } },
      });
      expect(await sandboxRow(opened.id)).toMatchObject({
        hostId: HOST,
        leases: [
          {
            kind: 'run',
            holder: runId,
            renewedAt: expect.any(String) as unknown,
          },
        ],
      });
    });
  });

  it('drains a replay’s sandbox as soon as its run ends, with no grace', async () => {
    const runId = await queue({ key: 'replays/replay-run_ended' });
    const claimed = (await claim().expect(200)).body as Claimed;
    const sandboxId = claimed.sandboxId;
    await heartbeat([sandboxId]).expect(200);

    await complete(runId, claimed.token);

    await eventually(async () =>
      (await sandboxRow(sandboxId))?.state === 'draining' ? true : null,
    );
    await expect(heartbeat([sandboxId]).expect(200)).resolves.toMatchObject({
      body: { drain: [sandboxId] },
    });
  });

  it('keeps a replay’s sandbox for the retry when its run’s lease expires', async () => {
    const runId = await queue({ key: 'replays/replay-run_retried' });
    const claimed = (await claim().expect(200)).body as Claimed;
    const sandboxId = claimed.sandboxId;
    await heartbeat([sandboxId]).expect(200);

    await db
      .update(schema.run)
      .set({ leaseExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(schema.run.id, runId));
    await app.get(RunLeasesWorker).tick();
    await claim().expect(204);

    const released = await eventually(async () => {
      const row = await sandboxRow(sandboxId);
      return row?.idleSince ? row : null;
    });
    expect(released).toMatchObject({ state: 'open', leases: [] });
  });

  it('drains a ready sandbox whose image lacks the harness of the next run of its key, and the run starts afresh', async () => {
    const sandboxId = await idleAndReady('work/task-task_9');
    const next = await queue({ key: 'work/task-task_9', harness: 'other' });

    await claim(sandboxId).expect(204);

    expect((await sandboxRow(sandboxId))?.state).toBe('draining');
    await expect(heartbeat([sandboxId]).expect(200)).resolves.toMatchObject({
      body: { drain: [sandboxId] },
    });
    expect(
      (
        await db
          .select({ state: schema.run.state })
          .from(schema.run)
          .where(eq(schema.run.id, next))
      )[0]?.state,
    ).toBe('queued');
  });

  describe('the sandbox’s own working copy archive', () => {
    it('restores the newest archive of its key and archives with the sandbox token alone', async () => {
      const runId = await queue({ key: 'work/task-task_10' });
      const claimed = (await claim().expect(200)).body as Claimed;
      const sandboxId = claimed.sandboxId;
      const own = archive(sandboxId, claimed.sandboxToken);

      await own.read().expect(204);

      const granted = (await own.grant().expect(201)).body as { id: string };
      await own.complete(granted.id).expect(204);
      await complete(runId, claimed.token);

      await expect(own.read().expect(200)).resolves.toMatchObject({
        body: {
          id: granted.id,
          url: `https://archives.test/${granted.id}?download`,
          size: 2_048,
          sha256: SHA256,
        },
      });
      const [stored] = await db
        .select()
        .from(schema.workingCopyArchive)
        .where(eq(schema.workingCopyArchive.id, granted.id));
      expect(stored).toMatchObject({
        workingCopyKey: 'work/task-task_10',
        grantedToRunId: null,
        grantedToSandboxId: sandboxId,
      });
    });

    it('answers a wrong token, a run token, or another sandbox with not found', async () => {
      await queue({ key: 'work/task-task_11' });
      const claimed = (await claim().expect(200)).body as Claimed;
      const sandboxId = claimed.sandboxId;

      await archive(sandboxId, 'stolen').read().expect(404);
      await archive(sandboxId, claimed.token).grant().expect(404);
      await archive('sandbox-other', claimed.sandboxToken).read().expect(404);
    });

    it('stops answering once the sandbox is gone', async () => {
      await queue({ key: 'work/task-task_12' });
      const claimed = (await claim().expect(200)).body as Claimed;
      await db
        .update(schema.sandbox)
        .set({ state: 'gone', goneAt: new Date() })
        .where(eq(schema.sandbox.id, claimed.sandboxId));

      await archive(claimed.sandboxId, claimed.sandboxToken).read().expect(404);
    });
  });

  describe('a warm sandbox', () => {
    let lineId: string;

    const keep = () => app.get(WarmSandboxKeeping).keep();

    const warmRows = () =>
      db
        .select()
        .from(schema.sandbox)
        .where(
          and(
            eq(schema.sandbox.workspaceId, workspaceId),
            isNotNull(schema.sandbox.warm),
          ),
        );

    const keepsWarm = (count: number) =>
      db
        .update(schema.line)
        .set({ warmSandboxes: count })
        .where(eq(schema.line.id, lineId));

    const startedWarm = async () => {
      await keep();
      const started = await claim().expect(200);
      const sandboxId = (started.body as Claimed).sandboxId;
      await heartbeat([sandboxId]).expect(200);

      return { started, sandboxId };
    };

    beforeEach(async () => {
      lineId = randomUUID();
      await db.insert(schema.line).values({
        id: lineId,
        workspaceId,
        teamId: workspaceId,
        key: 'delivery',
        name: 'Delivery',
        warmSandboxes: 1,
      });
      await insertStations(db, [
        {
          id: randomUUID(),
          workspaceId,
          lineId,
          key: 'backlog',
          name: 'Backlog',
          position: 0,
          kind: 'backlog',
        },
        {
          id: randomUUID(),
          workspaceId,
          lineId,
          key: 'completed',
          name: 'Completed',
          position: 1,
          kind: 'completed',
        },
      ]);
      await db.insert(schema.lineRepository).values({
        lineId,
        repository: 'acme/widgets',
        setup: 'npm ci',
      });
    });

    it('is requested for a line that keeps one, on no host and with no key', async () => {
      await keep();
      await keep();

      const rows = await warmRows();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        key: null,
        hostId: null,
        state: 'open',
        leases: [],
        warm: {
          lineId,
          checkouts: [{ path: 'widgets', setup: 'npm ci' }],
        },
      });
    });

    it('takes no slot of maxRuns while no host started it', async () => {
      await db
        .update(schema.runnerPool)
        .set({ maxRuns: 1 })
        .where(eq(schema.runnerPool.workspaceId, workspaceId));
      await keep();
      const runId = await queue();

      const claimed = await claim().expect(200);

      expect(claimed.body).toMatchObject({ work: { run: { id: runId } } });
    });

    it('is started by a host claim with the repositories to clone, and a task’s first run on its line is claimed into it', async () => {
      const { started, sandboxId } = await startedWarm();

      expect(started.body).toMatchObject({
        runnerId: null,
        token: null,
        sandboxToken: expect.any(String) as unknown,
        reused: false,
        work: {
          kind: 'sandbox',
          run: null,
          check: null,
          warm: {
            line: lineId,
            checkouts: [{ path: 'widgets', setup: 'npm ci' }],
          },
        },
      });

      const first = await queue({ key: 'work/task-warm_1', line: lineId });
      await claim().expect(204);

      const into = await claim(sandboxId).expect(200);

      expect(into.body).toMatchObject({
        sandboxId,
        sandboxToken: null,
        reused: true,
        work: { kind: 'run', run: { id: first } },
      });
      expect(await sandboxRow(sandboxId)).toMatchObject({
        key: 'work/task-warm_1',
        warm: null,
        leases: [
          {
            kind: 'run',
            holder: first,
            renewedAt: expect.any(String) as unknown,
          },
        ],
      });
    });

    it('takes no later run of a task, nor a run of another line, and a host starts those afresh', async () => {
      const { sandboxId } = await startedWarm();
      const archivedAt = new Date();
      await db.insert(schema.workingCopyArchive).values({
        id: randomUUID(),
        workspaceId,
        workingCopyKey: 'work/task-warm_2',
        grantedToSandboxId: 'sandbox-earlier',
        size: 1_024,
        sha256: SHA256,
        grantedAt: archivedAt,
        completedAt: archivedAt,
      });
      const later = await queue({ key: 'work/task-warm_2', line: lineId });

      await claim(sandboxId).expect(204);

      const fresh = await claim().expect(200);
      expect(fresh.body).toMatchObject({
        reused: false,
        work: { kind: 'run', run: { id: later } },
      });
      expect((fresh.body as Claimed).sandboxId).not.toBe(sandboxId);

      await queue({ key: 'work/task-warm_3', line: randomUUID() });
      await claim(sandboxId).expect(204);
      expect((await sandboxRow(sandboxId))?.key).toBeNull();
    });

    it('takes no first run ordered under another setup of its line', async () => {
      const { sandboxId } = await startedWarm();
      const outdated = await queue({
        key: 'work/task-warm_6',
        line: lineId,
        lineFingerprint: 'ordered-before-the-setup-changed',
      });

      await claim(sandboxId).expect(204);

      const fresh = await claim().expect(200);
      expect(fresh.body).toMatchObject({
        reused: false,
        work: { kind: 'run', run: { id: outdated } },
      });
      expect((fresh.body as Claimed).sandboxId).not.toBe(sandboxId);
      expect((await sandboxRow(sandboxId))?.key).toBeNull();
    });

    it('takes no run of another task once a first run adopted it', async () => {
      const { sandboxId } = await startedWarm();
      const first = await queue({ key: 'work/task-warm_4', line: lineId });
      const into = (await claim(sandboxId).expect(200)).body as Claimed;
      await complete(first, into.token);
      await eventually(async () =>
        (await sandboxRow(sandboxId))?.idleSince ? true : null,
      );

      await queue({ key: 'work/task-warm_5', line: lineId });

      await claim(sandboxId).expect(204);
      expect((await sandboxRow(sandboxId))?.key).toBe('work/task-warm_4');
    });

    it('is never started in the last free slot of its host', async () => {
      await keepsWarm(2);
      const { sandboxId } = await startedWarm();

      await keep();
      await claim().expect(204);

      const rows = await warmRows();
      expect(rows).toHaveLength(2);
      expect(
        rows.filter((each) => each.id !== sandboxId).map((each) => each.hostId),
      ).toEqual([null]);
    });

    it('drains on a full host, and a later run of a task starts afresh in the freed slot', async () => {
      const { sandboxId } = await startedWarm();
      await queue({ key: 'work/task-busy' });
      const busy = (await claim().expect(200)).body as Claimed;
      await heartbeat([sandboxId, busy.sandboxId]).expect(200);
      const archivedAt = new Date();
      await db.insert(schema.workingCopyArchive).values({
        id: randomUUID(),
        workspaceId,
        workingCopyKey: 'work/task-warm_7',
        grantedToSandboxId: 'sandbox-earlier',
        size: 1_024,
        sha256: SHA256,
        grantedAt: archivedAt,
        completedAt: archivedAt,
      });
      const waiting = await queue({ key: 'work/task-warm_7', line: lineId });

      await claim(sandboxId).expect(204);

      expect(await sandboxRow(sandboxId)).toMatchObject({
        state: 'draining',
        warm: null,
      });
      await expect(
        heartbeat([sandboxId, busy.sandboxId]).expect(200),
      ).resolves.toMatchObject({ body: { drain: [sandboxId] } });

      await heartbeat([busy.sandboxId]).expect(200);
      const fresh = await claim().expect(200);
      expect(fresh.body).toMatchObject({
        reused: false,
        work: { kind: 'run', run: { id: waiting } },
      });
      expect((fresh.body as Claimed).sandboxId).not.toBe(sandboxId);
    });

    it('drains once its line keeps none', async () => {
      const { sandboxId } = await startedWarm();

      await keepsWarm(0);
      await keep();

      expect(await sandboxRow(sandboxId)).toMatchObject({
        state: 'draining',
        warm: null,
      });
      await expect(heartbeat([sandboxId]).expect(200)).resolves.toMatchObject({
        body: { drain: [sandboxId] },
      });
    });
  });
});
