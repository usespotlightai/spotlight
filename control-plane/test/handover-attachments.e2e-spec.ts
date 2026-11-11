import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import {
  ATTACHMENT_STORE,
  type AttachmentStorePort,
} from '@work/application/ports/attachment-store.port';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import type { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { asc, eq, ne } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { deleteRunnersOf } from './support/runners';
import { aDispatch, requestedByTask } from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

const HOST = `host-handover-files-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'h'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BACKLOG = randomUUID();
const BUILD = randomUUID();
const SHIP = randomUUID();
const DEPLOY = randomUUID();

const granted = new Map<string, { uploader: string; file: Attachment }>();
const taken: string[] = [];

const attachmentStore = {
  grant: async (
    _workspace: unknown,
    uploader: UserId | RunId,
    file: Attachment,
  ) => {
    granted.set(file.id.value, { uploader: uploader.value, file });
    return {
      url: `https://files.test/pending/${file.id.value}`,
      headers: { 'content-type': file.contentType },
    };
  },
  received: async (
    _workspace: unknown,
    ids: readonly AttachmentId[],
    uploadedBy?: RunId,
  ) =>
    ids.map((id) => {
      const upload = granted.get(id.value);

      if (!upload) {
        throw new InvalidAttachmentError('was never uploaded');
      }
      if (uploadedBy && upload.uploader !== uploadedBy.value) {
        throw new InvalidAttachmentError('was not uploaded by this run');
      }

      return upload.file;
    }),
  taken: async (_workspace: unknown, files: readonly Attachment[]) =>
    void taken.push(...files.map((each) => each.id.value)),
} as unknown as AttachmentStorePort;

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const http = () => served(app);

const runner = (token: string) => ({
  post: (path: string, body?: object) =>
    http()
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body ?? {}),
});

const heartbeat = async () => {
  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({
      bootId: 'boot_1',
      name: 'build-box',
      release: '0.1.0',
      containerRuntime: 'docker',
      capacity: 4,
      running: [],
      images: [
        {
          image: IMAGE,
          isDefault: true,
          harnesses: [
            { id: 'dev', models: [] },
            { id: 'claude-code', models: [] },
          ],
        },
      ],
    })
    .expect(200);
};

const lostEarlierSandboxes = async () => {
  await db
    .update(schema.sandbox)
    .set({ state: 'gone', goneAt: new Date() })
    .where(ne(schema.sandbox.state, 'gone'));
};

const claimed = async (runId: string): Promise<string> => {
  await lostEarlierSandboxes();
  await heartbeat();

  const assignment = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as { token: string; work: { run: { id: string } } };

  expect(assignment.work.run.id).toBe(runId);

  return assignment.token;
};

const aTaskWithLeasedRun = async (
  at = BUILD,
): Promise<{ taskId: string; runId: string }> => {
  const taskId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.task).values({
    id: taskId,
    branch: `feat/test-${taskId}`,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: at,
    title: 'Drain the queue',
    originStationId: at,
    createdById: team.owner.value,
    assigneeId: team.owner.value,
    currentRunId: runId,
  });
  await db.insert(schema.run).values({
    ...requestedByTask(taskId, { teamId: team.teamId.value }),
    id: runId,
    workspaceId: team.workspaceId.value,
    harness: 'dev',
    state: 'queued',
    placement: [['linux']],
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'Drain the queue.',
      handover: { options: ['review', 'ship', 'done'], noteLimit: 0 },
      resume: {},
    },
  });
  await db.insert(schema.dispatch).values(
    aDispatch({
      runId,
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      taskId,
      stationId: at,
    }),
  );

  return { taskId, runId };
};

const upload = async (token: string, runId: string, name: string) =>
  (
    await runner(token)
      .post(`/api/runs/${runId}/attachments`, {
        name,
        contentType: 'image/png',
        size: 3,
      })
      .expect(201)
  ).body as { id: string; url: string; headers: Record<string, string> };

const filesOnNotes = (taskId: string) =>
  db
    .select({
      notePosition: schema.taskAttachment.notePosition,
      name: schema.taskAttachment.name,
    })
    .from(schema.taskAttachment)
    .where(eq(schema.taskAttachment.taskId, taskId))
    .orderBy(asc(schema.taskAttachment.place));

beforeAll(async () => {
  app = await openApp((module) =>
    module.overrideProvider(ATTACHMENT_STORE).useValue(attachmentStore),
  );
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `handover-files-${randomUUID().slice(0, 8)}`,
  );

  await db.insert(schema.line).values({
    id: DELIVERY,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
  });
  await insertStations(db, [
    {
      id: BACKLOG,
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
      harness: 'dev',
    },
    {
      id: SHIP,
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'ship',
      name: 'Ship',
      position: 2,
      kind: 'work',
      harness: 'dev',
    },
    {
      id: DEPLOY,
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'deploy',
      name: 'Deploy',
      position: 3,
      kind: 'work',
      harness: 'claude-code',
      finishes: true,
    },
    {
      id: randomUUID(),
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'completed',
      name: 'Completed',
      position: 4,
      kind: 'completed',
    },
  ]);
  await db.insert(schema.stationRoute).values({
    stationId: BUILD,
    toStationId: SHIP,
  });

  await http()
    .post(`/api/v1/resources/workspaces/${team.workspaceId.value}/runner-pools`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ key: 'hosts', labels: ['linux'], token: POOL_TOKEN })
    .expect(201);
}, 60_000);

afterAll(async () => {
  await deleteRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('files a run attaches to its handover', () => {
  it('grants the runner holding the run an upload, by the run', async () => {
    const { runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);

    const grant = await upload(token, runId, 'light.png');

    expect(grant.url).toBe(`https://files.test/pending/${grant.id}`);
    expect(grant.headers).toEqual({ 'content-type': 'image/png' });
    expect(granted.get(grant.id)?.uploader).toBe(runId);
  });

  it('grants no upload for a run the runner does not hold', async () => {
    const { runId } = await aTaskWithLeasedRun();
    await claimed(runId);
    const other = await aTaskWithLeasedRun();
    const otherToken = await claimed(other.runId);

    await runner(otherToken)
      .post(`/api/runs/${runId}/attachments`, {
        name: 'light.png',
        contentType: 'image/png',
        size: 3,
      })
      .expect(404);
  });

  it('puts the files on the note that asks the person, and keeps them', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);
    const light = await upload(token, runId, 'light.png');
    const dark = await upload(token, runId, 'dark.png');

    await runner(token)
      .post(`/api/runs/${runId}/completion`, {
        exitCode: 0,
        failed: false,
        sessionId: 'session_1',
        handover: {
          next: 'review',
          note: 'Here is the selector.',
          attachments: [light.id, dark.id],
        },
      })
      .expect(204);

    expect(
      await eventually(async () => {
        const files = await filesOnNotes(taskId);
        return files.length > 0 ? files : null;
      }),
    ).toEqual([
      { notePosition: 0, name: 'light.png' },
      { notePosition: 0, name: 'dark.png' },
    ]);
    expect(taken).toEqual(expect.arrayContaining([light.id, dark.id]));

    const inbox = (
      (
        await http()
          .get(`/api/workspaces/${team.slug}/inbox`)
          .set(TEST_USER_HEADER, team.owner.value)
          .expect(200)
      ).body as { readonly items: { taskId: string }[] }
    ).items;
    expect(inbox.some((each) => each.taskId === taskId)).toBe(true);
  });

  it('puts the files on the note that passes the task to the next station', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);
    const shot = await upload(token, runId, 'light.png');

    await runner(token)
      .post(`/api/runs/${runId}/completion`, {
        exitCode: 0,
        failed: false,
        handover: { next: 'ship', note: 'Built.', attachments: [shot.id] },
      })
      .expect(204);

    expect(
      await eventually(async () => {
        const files = await filesOnNotes(taskId);
        return files.length > 0 ? files : null;
      }),
    ).toEqual([{ notePosition: 0, name: 'light.png' }]);
  });

  it('refuses a handover with a file that was never uploaded', async () => {
    const { runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);

    const refused = await runner(token).post(`/api/runs/${runId}/completion`, {
      exitCode: 0,
      failed: false,
      handover: { next: 'review', attachments: [randomUUID()] },
    });

    expect(refused.status).toBe(422);
  });

  it('refuses a file another run uploaded', async () => {
    const first = await aTaskWithLeasedRun();
    const firstToken = await claimed(first.runId);
    const theirs = await upload(firstToken, first.runId, 'light.png');
    const second = await aTaskWithLeasedRun();
    const secondToken = await claimed(second.runId);

    const refused = await runner(secondToken).post(
      `/api/runs/${second.runId}/completion`,
      {
        exitCode: 0,
        failed: false,
        handover: { next: 'review', attachments: [theirs.id] },
      },
    );

    expect(refused.status).toBe(422);
    expect(await filesOnNotes(second.taskId)).toEqual([]);
  });
});
