import { createHash, randomUUID } from 'node:crypto';
import {
  TERRAFORM_STATE_BODIES,
  type TerraformStateBodiesPort,
} from '@configuration/application/ports/terraform-state-bodies.port';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { eq, inArray } from 'drizzle-orm';
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
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const TOKEN_HEADER = 'spotlight-workspace-token';

const kept = () => {
  const bodies = new Map<string, Uint8Array>();
  const port: TerraformStateBodiesPort = {
    put: async (state, version, body) => {
      bodies.set(`${state.workspaceId.value}/${version.id.value}`, body);
    },
    read: async (state, version) =>
      bodies.get(`${state.workspaceId.value}/${version.id.value}`) ?? null,
    removeForWorkspace: async (workspaceId) => {
      for (const key of [...bodies.keys()]) {
        if (key.startsWith(`${workspaceId.value}/`)) {
          bodies.delete(key);
        }
      }
    },
  };

  return { bodies, port };
};

const stateOf = (serial: number) =>
  JSON.stringify({
    version: 4,
    terraform_version: '1.17.0',
    serial,
    lineage: '9f0c1d2e-3a4b-5c6d-7e8f-90a1b2c3d4e5',
    outputs: {},
    resources: [],
  });

const md5Of = (body: string) => createHash('md5').update(body).digest('base64');

const lockInfo = (id: string) => ({
  ID: id,
  Operation: 'OperationTypeApply',
  Info: '',
  Who: 'ci@runner',
  Version: '1.17.0',
  Created: '2026-10-26T10:00:00Z',
  Path: '',
});

describe('Terraform states over the http backend protocol (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let seat: Awaited<ReturnType<typeof seatTeam>> & { workspaceId: string };
  let tokens: Record<'plan' | 'configure', string>;
  const store = kept();

  const http = () => served(app);
  const address = (name = 'default') =>
    `/api/terraform/workspaces/${seat.workspaceId}/states/${name}`;

  const issue = async (scopes: readonly string[], name = scopes.join('-')) =>
    (
      await http()
        .post(`/api/resources/workspaces/${seat.workspaceId}/tokens`)
        .set(TEST_USER_HEADER, seat.owner)
        .set('Idempotency-Key', randomUUID())
        .send({ name, scopes })
    ).headers[TOKEN_HEADER] as string;

  const basic = (token: string) =>
    `Basic ${Buffer.from(`terraform:${token}`).toString('base64')}`;

  const as = (token: string) => ({
    read: (name?: string) =>
      http().get(address(name)).set('Authorization', basic(token)),
    write: (body: string, lockId?: string) =>
      http()
        .post(`${address()}${lockId ? `?ID=${lockId}` : ''}`)
        .set('Authorization', basic(token))
        .set('Content-Type', 'application/json')
        .set('Content-MD5', md5Of(body))
        .send(body),
    lock: (id: string) =>
      http()
        .post(`${address()}/lock`)
        .set('Authorization', basic(token))
        .send(lockInfo(id)),
    unlock: (id: string) =>
      http()
        .delete(`${address()}/lock`)
        .set('Authorization', basic(token))
        .send(lockInfo(id)),
  });

  beforeAll(async () => {
    app = await openApp((module) =>
      module.overrideProvider(TERRAFORM_STATE_BODIES).useValue(store.port),
    );
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const workspaceId = `states-${randomUUID().slice(0, 8)}`;

    seat = { ...(await seatTeam(db, workspaceId)), workspaceId };
    tokens = {
      plan: await issue(['plan']),
      configure: await issue(['configure']),
    };
  });

  afterEach(async () => {
    const states = await db
      .delete(schema.terraformState)
      .where(eq(schema.terraformState.workspaceId, seat.workspaceId))
      .returning({ id: schema.terraformState.id });

    if (states.length > 0) {
      await db.delete(schema.terraformStateVersion).where(
        inArray(
          schema.terraformStateVersion.stateId,
          states.map(({ id }) => id),
        ),
      );
    }

    await db
      .delete(schema.workspaceToken)
      .where(eq(schema.workspaceToken.workspaceId, seat.workspaceId));
    await db
      .delete(schema.idempotentCreate)
      .where(eq(schema.idempotentCreate.scope, `person:${seat.owner}`));
    await seat.unseat();
  });

  it('answers 204 for a state that was never written', async () => {
    expect((await as(tokens.plan).read()).status).toBe(204);
  });

  it('keeps each write as a new version and serves the latest', async () => {
    const configure = as(tokens.configure);

    expect((await configure.write(stateOf(1))).status).toBe(200);
    expect((await configure.write(stateOf(2))).status).toBe(200);

    const read = await as(tokens.plan).read();
    const versions = await db
      .select({
        number: schema.terraformStateVersion.number,
        serial: schema.terraformStateVersion.serial,
      })
      .from(schema.terraformStateVersion)
      .innerJoin(
        schema.terraformState,
        eq(schema.terraformState.id, schema.terraformStateVersion.stateId),
      )
      .where(eq(schema.terraformState.workspaceId, seat.workspaceId))
      .orderBy(schema.terraformStateVersion.number);

    expect(read.status).toBe(200);
    expect(JSON.parse(read.text).serial).toBe(2);
    expect(versions).toEqual([
      { number: 1, serial: 1 },
      { number: 2, serial: 2 },
    ]);
  });

  it('accepts a Bearer token as well as the Basic password', async () => {
    const answer = await http()
      .get(address())
      .set('Authorization', `Bearer ${tokens.plan}`);

    expect(answer.status).toBe(204);
  });

  it('lets a plan token read and lock, but not write', async () => {
    const plan = as(tokens.plan);

    expect((await plan.lock('plan-1')).status).toBe(200);
    expect((await plan.unlock('plan-1')).status).toBe(200);
    expect((await plan.write(stateOf(1))).status).toBe(403);
  });

  it('answers 423 with the holder when another run has the lock', async () => {
    const configure = as(tokens.configure);

    await configure.lock('apply-1');

    const refused = await as(tokens.plan).lock('plan-2');

    expect(refused.status).toBe(423);
    expect(refused.body).toMatchObject({ ID: 'apply-1', Who: 'ci@runner' });
    expect((await configure.lock('apply-1')).status).toBe(200);
  });

  it('writes a locked state only with the lock’s ID', async () => {
    const configure = as(tokens.configure);

    await configure.lock('apply-1');

    expect((await configure.write(stateOf(1))).status).toBe(423);
    expect((await configure.write(stateOf(1), 'other')).status).toBe(423);
    expect((await configure.write(stateOf(1), 'apply-1')).status).toBe(200);
  });

  it('releases the lock only for its holder', async () => {
    const configure = as(tokens.configure);

    await configure.lock('apply-1');

    expect((await configure.unlock('other')).status).toBe(423);
    expect((await configure.unlock('apply-1')).status).toBe(200);
    expect((await as(tokens.plan).lock('plan-2')).status).toBe(200);
  });

  it('releases any lock on an unlock without lock info, as terraform force-unlock sends', async () => {
    await as(tokens.configure).lock('apply-1');

    const forced = (token: string) =>
      http().delete(`${address()}/lock`).set('Authorization', basic(token));

    expect((await forced(tokens.plan)).status).toBe(403);
    expect((await forced(tokens.configure)).status).toBe(200);
    expect((await as(tokens.plan).lock('plan-2')).status).toBe(200);
  });

  it('lets only the lock’s taker, or a configure token, release it by ID', async () => {
    await as(tokens.plan).lock('plan-1');
    const other = await issue(['plan'], 'other-plan');

    expect((await as(other).unlock('plan-1')).status).toBe(403);
    expect((await as(tokens.configure).unlock('plan-1')).status).toBe(200);
  });

  it('refuses a write that names a lock that was released', async () => {
    const configure = as(tokens.configure);

    await configure.lock('apply-1');
    await http()
      .delete(`${address()}/lock`)
      .set('Authorization', basic(tokens.configure));

    expect((await configure.write(stateOf(1), 'apply-1')).status).toBe(409);
  });

  it('answers each of many writes at once with 200 or 409, never an error', async () => {
    const configure = as(tokens.configure);

    await configure.write(stateOf(1));

    const answers = await Promise.all(
      [2, 3, 4, 5, 6].map((serial) => configure.write(stateOf(serial))),
    );

    const statuses = answers.map(({ status }) => status);
    const kept = [2, 3, 4, 5, 6].filter((_, at) => statuses[at] === 200);
    const read = await as(tokens.plan).read();

    expect(statuses.every((each) => each === 200 || each === 409)).toBe(true);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept).toContain(JSON.parse(read.text).serial);
  });

  it.each([
    ['a new state', false],
    ['a state that was locked before', true],
  ])(
    'answers 423 with the holder to every lock that loses a race on %s',
    async (_, before) => {
      if (before) {
        await as(tokens.plan).lock('earlier');
        await as(tokens.plan).unlock('earlier');
      }

      const answers = await Promise.all(
        ['a', 'b', 'c', 'd'].map((id) => as(tokens.plan).lock(id)),
      );
      const statuses = answers.map(({ status }) => status).sort();

      expect(statuses).toEqual([200, 423, 423, 423]);
      for (const refused of answers.filter(({ status }) => status === 423)) {
        expect(refused.body.ID).toMatch(/^[abcd]$/);
      }
    },
  );

  it('refuses a body whose Content-MD5 does not match', async () => {
    const answer = await http()
      .post(address())
      .set('Authorization', basic(tokens.configure))
      .set('Content-Type', 'application/json')
      .set('Content-MD5', md5Of('something else'))
      .send(stateOf(1));

    expect(answer.status).toBe(400);
  });

  it('refuses a body that is not a Terraform state', async () => {
    expect(
      (await as(tokens.configure).write(JSON.stringify({ hello: 1 }))).status,
    ).toBe(422);
  });

  it('refuses a state name that is not a slug', async () => {
    expect((await as(tokens.plan).read('Not_A_Slug')).status).toBe(422);
  });

  it('lets a member read the state, and not write it', async () => {
    await as(tokens.configure).write(stateOf(1));

    const read = await http().get(address()).set(TEST_USER_HEADER, seat.member);
    const written = await http()
      .post(address())
      .set(TEST_USER_HEADER, seat.member)
      .set('Content-Type', 'application/json')
      .send(stateOf(2));

    expect(read.status).toBe(200);
    expect(written.status).toBe(403);
  });

  it('answers 404 to a token from another workspace', async () => {
    const other = `states-${randomUUID().slice(0, 8)}`;
    const foreign = { ...(await seatTeam(db, other)), workspaceId: other };

    try {
      const answer = await http()
        .get(`/api/terraform/workspaces/${other}/states/default`)
        .set('Authorization', basic(tokens.configure));

      expect(answer.status).toBe(404);
    } finally {
      await foreign.unseat();
    }
  });

  it('answers 401 to a request without a credential', async () => {
    expect((await http().get(address())).status).toBe(401);
  });
});
