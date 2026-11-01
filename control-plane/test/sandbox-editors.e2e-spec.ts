import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { connect } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  type AuthenticatedUser,
  SESSION_READER,
  type SessionReaderPort,
} from '@shared-kernel/application/ports/session.port';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { deleteRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const IMAGE = 'ghcr.io/acme/runner:main';

const LOGIN = 'login-token-of-ada';

const tokenOf = (seed: string): string =>
  `${seed.repeat(8)}${randomUUID().replaceAll('-', '')}`;

describe('sandbox editors (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let team: Awaited<ReturnType<typeof createTeam>>;
  let host: string;
  let poolToken: string;
  const opened: WebSocket[] = [];

  const http = () => served(app);

  const base = () =>
    `ws://127.0.0.1:${((app.getHttpServer() as Server).address() as { port: number }).port}`;

  const socket = (path: string, headers: Record<string, string> = {}) => {
    const each = new WebSocket(`${base()}${path}`, { headers });
    opened.push(each);
    return each;
  };

  const refusal = (each: WebSocket) =>
    new Promise<number>((done, failed) => {
      each.once('unexpected-response', (_request, response) =>
        done(response.statusCode ?? 0),
      );
      each.once('open', () => failed(new Error('the socket opened')));
    });

  const opening = (each: WebSocket) =>
    new Promise<void>((done, failed) => {
      each.once('open', () => done());
      each.once('unexpected-response', (_request, response) =>
        failed(new Error(`refused with ${response.statusCode}`)),
      );
    });

  interface Ticket {
    readonly sandboxId: string;
    readonly holder: string;
  }

  const owner = () => ({ [TEST_USER_HEADER]: team.owner.value });

  const asking = (
    body: Record<string, string>,
    headers: Record<string, string> = owner(),
  ) => http().post('/api/editor-connections').set(headers).send(body);

  const lease = async (
    body: Record<string, string> = { task: taskId() },
    headers?: Record<string, string>,
  ): Promise<Ticket> => (await asking(body, headers).expect(201)).body;

  const editor = (ticket: Ticket, headers: Record<string, string> = owner()) =>
    socket(
      `/api/sandboxes/connect?sandbox=${ticket.sandboxId}&holder=${ticket.holder}`,
      headers,
    );

  const taskId = () => team.list.id.value;

  const sandboxOf = async (key: string) => {
    const rows = await db
      .select()
      .from(schema.sandbox)
      .where(eq(schema.sandbox.key, key));

    return rows.find((each) => each.state !== 'gone') ?? null;
  };

  const heartbeat = (sandboxes: string[] = []) =>
    http()
      .put(`/api/hosts/${host}`)
      .set('Authorization', `Bearer ${poolToken}`)
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

  beforeAll(async () => {
    app = await openApp((module) =>
      module.overrideProvider(SESSION_READER).useValue({
        read: async (headers): Promise<AuthenticatedUser | null> => {
          const id = headers[TEST_USER_HEADER];
          return typeof id === 'string'
            ? { id, email: `${id}@example.com`, name: id }
            : null;
        },
        readBearer: async (token): Promise<AuthenticatedUser | null> =>
          token === LOGIN && team
            ? {
                id: team.owner.value,
                email: 'ada@example.com',
                name: 'Ada',
              }
            : null,
      } satisfies SessionReaderPort),
    );
    db = app.get<DrizzleDatabase>(DRIZZLE);
    team = await createTeam(
      db,
      app.get(DrizzleTaskRepository),
      `editors-${randomUUID().slice(0, 8)}`,
    );
    host = `host-editors-${randomUUID().slice(0, 8)}`;
    poolToken = tokenOf('e');
    await http()
      .post(
        `/api/v1/resources/workspaces/${team.workspaceId.value}/runner-pools`,
      )
      .set(TEST_USER_HEADER, team.owner.value)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'editors', token: poolToken })
      .expect(201);
    await heartbeat().expect(200);
  }, 60_000);

  afterEach(async () => {
    for (const each of opened.splice(0)) {
      if (each.readyState === WebSocket.OPEN) {
        each.terminate();
      }
    }
    await eventually(async () => {
      const left = await sandboxOf(`task-${taskId()}`);
      return !left || left.leases.length === 0 ? true : null;
    }, 10_000);
    await db
      .delete(schema.sandbox)
      .where(eq(schema.sandbox.workspaceId, team.workspaceId.value));
  });

  afterAll(async () => {
    await deleteRunnersOf(db, team.workspaceId.value);
    await app?.close();
  });

  it('leases no sandbox with no session, for a person outside the workspace or another workspace, or without one task or one chat', async () => {
    await asking({ task: taskId() }, {}).expect(401);
    await asking(
      { task: taskId() },
      { [TEST_USER_HEADER]: randomUUID() },
    ).expect(404);
    await asking({ workspace: team.slug }).expect(400);
    await asking({ task: taskId(), chat: randomUUID() }).expect(400);
    await asking({ task: taskId(), workspace: `not-${team.slug}` }).expect(404);
    expect(await sandboxOf(`task-${taskId()}`)).toBeNull();
  });

  it('refuses a socket with no session, another site’s page, no lease, an unknown lease, and a second socket on one lease', async () => {
    const ticket = await lease({ task: taskId(), workspace: team.slug });

    expect(await refusal(editor(ticket, {}))).toBe(401);
    expect(
      await refusal(
        editor(ticket, { ...owner(), origin: 'https://elsewhere.example' }),
      ),
    ).toBe(403);
    expect(
      await refusal(
        socket(`/api/sandboxes/connect?sandbox=${ticket.sandboxId}`, owner()),
      ),
    ).toBe(400);
    expect(await refusal(editor({ ...ticket, holder: randomUUID() }))).toBe(
      404,
    );

    const first = editor(ticket);
    await opening(first);
    expect(await refusal(editor(ticket))).toBe(409);

    first.close();
    await eventually(async () => {
      const found = await sandboxOf(`task-${taskId()}`);
      return found?.leases.length === 0 ? true : null;
    });
    expect(await refusal(editor(ticket))).toBe(404);
  });

  it('holds the task’s sandbox with an editor lease while connected, with a session or a login token, and lets go on close', async () => {
    const cookie = editor(
      await lease({ task: taskId(), workspace: team.slug }),
    );
    await opening(cookie);
    const login = { authorization: `Bearer ${LOGIN}` };
    const cli = editor(await lease({ task: taskId() }, login), login);
    await opening(cli);

    const held = await eventually(async () => {
      const found = await sandboxOf(`task-${taskId()}`);
      return found?.leases.length === 2 ? found : null;
    });
    expect(held).toMatchObject({ hostId: null, state: 'starting' });
    expect(held.leases.map((each) => each.kind)).toEqual(['editor', 'editor']);

    cookie.close();
    cli.close();
    await eventually(async () => {
      const found = await sandboxOf(`task-${taskId()}`);
      return found?.leases.length === 0 ? true : null;
    });
  });

  it('pipes the editor’s bytes to the sandbox’s host once the sandbox is ready', async () => {
    const tunnel = socket(`/api/hosts/${host}/tunnel`, {
      authorization: `Bearer ${poolToken}`,
    });
    await opening(tunnel);
    const asked = new Promise<{ stream: string; sandboxId: string }>((done) =>
      tunnel.once('message', (data) => done(JSON.parse(data.toString()))),
    );

    const ssh = editor(await lease());
    const echoed = new Promise<string>((done) =>
      ssh.once('message', (data: Buffer) => done(data.toString())),
    );
    await opening(ssh);
    ssh.send(Buffer.from('SSH-2.0-OpenSSH_9.9\r\n'));

    const claimed = await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${poolToken}`)
      .send({ host, image: IMAGE })
      .expect(200);
    expect(claimed.body.work.kind).toBe('sandbox');
    await heartbeat([claimed.body.sandboxId]).expect(200);

    const { stream, sandboxId } = await asked;
    expect(sandboxId).toBe(claimed.body.sandboxId);

    const back = socket(`/api/hosts/${host}/tunnel/${stream}`, {
      authorization: `Bearer ${poolToken}`,
    });
    back.on('message', (data: Buffer) => back.send(data));
    await opening(back);

    expect(await echoed).toBe('SSH-2.0-OpenSSH_9.9\r\n');

    back.close();
    const closed = await new Promise<number>((done) =>
      ssh.once('close', (code) => done(code)),
    );
    expect(closed).toBe(1000);
    tunnel.close();
  });

  it('lets go of the editor lease when the upgrade itself fails', async () => {
    const port = ((app.getHttpServer() as Server).address() as { port: number })
      .port;
    const ticket = await lease();
    const raw = connect(port, '127.0.0.1');
    raw.write(
      `GET /api/sandboxes/connect?sandbox=${ticket.sandboxId}&holder=${ticket.holder} HTTP/1.1\r\n` +
        `Host: 127.0.0.1:${port}\r\n` +
        `${TEST_USER_HEADER}: ${team.owner.value}\r\n` +
        'Upgrade: websocket\r\nConnection: Upgrade\r\n\r\n',
    );
    const answer = await new Promise<string>((done) =>
      raw.once('data', (data) => done(data.toString())),
    );
    raw.destroy();

    expect(answer).toMatch(/^HTTP\/1\.1 400/);
    await eventually(async () => {
      const found = await sandboxOf(`task-${taskId()}`);
      return found && found.leases.length === 0 ? true : null;
    });
  });

  it('refuses a host tunnel whose address does not decode, and keeps serving', async () => {
    expect(
      await refusal(
        socket(`/api/hosts/%E0/tunnel`, {
          authorization: `Bearer ${poolToken}`,
        }),
      ),
    ).toBe(400);
    await heartbeat().expect(200);
  });

  it('refuses a host tunnel with a wrong token, and a stream no editor waits for', async () => {
    expect(
      await refusal(
        socket(`/api/hosts/${host}/tunnel`, {
          authorization: `Bearer ${tokenOf('x')}`,
        }),
      ),
    ).toBe(401);
    expect(
      await refusal(
        socket(`/api/hosts/${host}/tunnel/${randomUUID()}`, {
          authorization: `Bearer ${poolToken}`,
        }),
      ),
    ).toBe(404);
  });
});
