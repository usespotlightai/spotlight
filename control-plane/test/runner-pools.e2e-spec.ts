import { createHash, createHmac, randomInt, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  CHANGE_STACK_READER,
  type ChangeStackReaderPort,
} from '@change-review/application/ports/change-stack-reader.port';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { PoolTokenSpentError } from '@runners/domain/exceptions/pool-token-spent.error';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { DrizzleGivenPoolTokensRepository } from '@runners/infrastructure/persistence/drizzle/repositories/given-pool-tokens.repository';
import { POOL_TOKEN_HEADER } from '@runners/presentation/http/controllers/runner-pool-resource.controller';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { and, eq, inArray } from 'drizzle-orm';
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
import { awaitingCheck } from './support/change-stacks';
import { eventually } from './support/eventually';
import { definitionOf } from './support/line-definition';
import { E2E_LONG_POLL_MS } from './support/long-poll';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { listSetUp, seatTeam } from './support/team';

const HARNESSES = [{ id: 'dev', models: [] }];

const USUAL = 'ghcr.io/acme/runner:main';

const WIDGETS = 'ghcr.io/acme/widgets:1';

const HOST = 'host-ephemeral-1';

const SECRET = `whsec_${Buffer.from('p'.repeat(32)).toString('base64')}`;

const RUN = randomUUID().replaceAll('-', '');

const tokenOf = (seed: string): string => `${seed.repeat(8)}${RUN}`;

const sha256Of = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

interface Provisioned {
  readonly headers: IncomingMessage['headers'];
  readonly body: string;
}

const listening = async (
  answer: (call: Provisioned) => number,
): Promise<{ server: Server; url: string; calls: Provisioned[] }> => {
  const calls: Provisioned[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const call = { headers: request.headers, body };
      calls.push(call);
      response.statusCode = answer(call);
      response.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    server,
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/runs`,
    calls,
  };
};

describe('runner pools (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let unseat: () => Promise<void>;

  const http = () => served(app);

  const define = (body: object) =>
    http()
      .post(`/api/resources/workspaces/${workspaceId}/runner-pools`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send(body);

  const redefine = (id: string, version: number, body: object) =>
    http()
      .put(`/api/resources/runner-pools/${id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${version}"`)
      .send(body);

  const queue = async (
    placement: string[][] = [],
    image: string | null = null,
  ) => {
    const id = randomUUID();

    await db.insert(schema.run).values({
      id,
      workspaceId,
      harness: 'dev',
      state: 'queued',
      placement,
      placementImage: image,
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'do the thing',
        handover: { options: [], noteLimit: 0 },
        continuity: { key: `task:${id}` },
      },
    });

    return id;
  };

  const checkReadFor = async (runId: string) => {
    const [stack] = await app
      .get<ChangeStackReaderPort>(CHANGE_STACK_READER)
      .ofRun(RunId.of(runId), new Date());

    return stack?.check ?? null;
  };

  const claimWith = (token: string, host = HOST, image = USUAL) =>
    http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${token}`)
      .send({ host, image });

  const report = (
    token: string,
    host = HOST,
    running: string[] = [],
    session = 'session_1',
  ) =>
    http()
      .put(`/api/hosts/${host}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        session,
        name: 'build-box',
        release: '0.1.0',
        executor: 'docker',
        capacity: 2,
        running,
        images: [
          { image: USUAL, usual: true, harnesses: HARNESSES },
          { image: WIDGETS, usual: false, harnesses: HARNESSES },
        ],
      });

  const hostRow = async (host = HOST) => {
    const [row] = await db
      .select()
      .from(schema.runnerHost)
      .where(eq(schema.runnerHost.id, host));

    return row ?? null;
  };

  const runnerCall = (token: string) => ({
    renew: (runId: string) =>
      http()
        .post(`/api/runs/${runId}/lease`)
        .set('Authorization', `Bearer ${token}`),
    complete: (runId: string) =>
      http()
        .post(`/api/runs/${runId}/completion`)
        .set('Authorization', `Bearer ${token}`)
        .send({ exitCode: 0, failed: false }),
  });

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspaceId = `pools-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    unseat = seat.unseat;
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(inArray(schema.idempotentCreate.scope, [`person:${owner}`]));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId));
    await db
      .delete(schema.githubConnection)
      .where(eq(schema.githubConnection.workspaceId, workspaceId));
    await forgetRunnersOf(db, workspaceId);
    await db
      .delete(schema.chat)
      .where(eq(schema.chat.workspaceId, workspaceId));
    await unseat();
  });

  describe('a pull pool', () => {
    it('swaps its token, at each claim, for a credential good for that one run', async () => {
      const token = tokenOf('a');
      await define({ key: 'ephemeral', labels: ['linux'], token }).expect(201);
      await report(token).expect(200);
      const runId = await queue([['linux']]);

      const claimed = await claimWith(token).expect(200);

      expect(claimed.body.work).toMatchObject({
        kind: 'run',
        run: { id: runId },
      });
      expect(claimed.body.token).not.toBe(token);
      await runnerCall(claimed.body.token).renew(runId).expect(201);
      await runnerCall(token).renew(runId).expect(401);

      const [started] = await db
        .select({
          poolId: schema.runner.poolId,
          trustId: schema.runner.trustId,
          hostId: schema.runner.hostId,
        })
        .from(schema.runner)
        .where(eq(schema.runner.id, claimed.body.runnerId));

      expect(started).toMatchObject({ trustId: null, hostId: HOST });
      expect(started?.poolId).toEqual(expect.any(String));
    });

    it('tells a host how new its runner must be, what harnesses to look for and which images to serve, and does not accept a token it does not know', async () => {
      const token = tokenOf('i');
      await define({ key: 'ephemeral', token }).expect(201);
      await http()
        .post(`/api/resources/teams/${workspaceId}/lines`)
        .set(TEST_USER_HEADER, owner)
        .set('Idempotency-Key', randomUUID())
        .send({
          ...definitionOf(BUILT_IN_LINES[0] as LineOpening),
          repositories: [{ name: 'acme/widgets', image: WIDGETS }],
        })
        .expect(201);

      const required = await http()
        .get('/api/hosts/requirements')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(required.body).toEqual({
        runner: { minimum: expect.any(String) },
        harnesses: expect.arrayContaining([
          expect.objectContaining({ id: 'claude-code' }),
        ]),
        images: [WIDGETS],
      });
      await http()
        .get('/api/hosts/requirements')
        .set('Authorization', `Bearer ${tokenOf('y')}`)
        .expect(401);
    });

    it('hands work naming an image only to a claim offering that image, and work naming none only to a claim in the host’s usual image', async () => {
      const token = tokenOf('w');
      await define({ key: 'ephemeral', token }).expect(201);
      await report(token).expect(200);
      const inWidgets = await queue([], WIDGETS);

      await claimWith(token, HOST, USUAL).expect(204);
      const unreported = await claimWith(
        token,
        HOST,
        'ghcr.io/acme/elsewhere:1',
      ).expect(409);
      expect(unreported.body.reason).toBe('image-unreported');

      const offered = await claimWith(token, HOST, WIDGETS).expect(200);

      expect(offered.body.work).toMatchObject({
        kind: 'run',
        run: { id: inWidgets },
      });

      const anywhere = await queue();

      await claimWith(token, HOST, WIDGETS).expect(204);

      const usual = await claimWith(token).expect(200);

      expect(usual.body.work).toMatchObject({
        kind: 'run',
        run: { id: anywhere },
      });
    });

    it('issues a token Terraform does not keep when none is given', async () => {
      const made = await define({ key: 'ephemeral' }).expect(201);
      const issued = made.headers[POOL_TOKEN_HEADER.toLowerCase()] as string;
      await queue();

      expect(issued).toEqual(expect.any(String));
      expect(made.body).toMatchObject({ mode: 'pull', provision: null });
      await report(issued).expect(200);
      await claimWith(issued).expect(200);
    });

    it('answers nothing when no run fits, and does not accept a token it does not know', async () => {
      const token = tokenOf('b');
      await define({ key: 'ephemeral', labels: ['linux'], token }).expect(201);
      await report(token).expect(200);
      await queue([['gpu']]);

      await claimWith(token).expect(204);
      await claimWith(tokenOf('z')).expect(401);
    });

    it('gives out no more runs at once than maxRuns, keeping a host that asks for more waiting out its poll', async () => {
      const token = tokenOf('c');
      await define({ key: 'ephemeral', token, maxRuns: 1 }).expect(201);
      await report(token).expect(200);
      await queue();
      await queue();

      await claimWith(token).expect(200);
      const asked = Date.now();
      await claimWith(token).expect(204);

      expect(Date.now() - asked).toBeGreaterThanOrEqual(E2E_LONG_POLL_MS);
    });

    it('rotates its token in place: the pool keeps its id, the old token stops working at once, and a claimed run finishes', async () => {
      const old = tokenOf('d');
      const made = await define({
        key: 'ephemeral',
        token: old,
        tokenVersion: 1,
      }).expect(201);
      await report(old).expect(200);
      const runId = await queue();
      const claimed = await claimWith(old).expect(200);

      const rotated = await redefine(made.body.id, made.body.version, {
        key: 'ephemeral',
        token: tokenOf('e'),
        tokenVersion: 2,
      }).expect(200);

      expect(rotated.body).toMatchObject({ id: made.body.id, tokenVersion: 2 });
      await claimWith(old).expect(401);
      await runnerCall(claimed.body.token).renew(runId).expect(201);
      await runnerCall(claimed.body.token).complete(runId).expect(200);
      await eventually(
        async () =>
          (await runnerCall(claimed.body.token).renew(runId)).status === 401,
      );
    });

    it('does not rotate its token without a new one', async () => {
      const made = await define({
        key: 'ephemeral',
        token: tokenOf('f'),
        tokenVersion: 1,
      }).expect(201);

      const rejected = await redefine(made.body.id, made.body.version, {
        key: 'ephemeral',
        tokenVersion: 2,
      }).expect(422);
      await queue();

      expect(rejected.body.errors).toEqual([
        expect.objectContaining({ path: 'token' }),
      ]);
      await report(tokenOf('f')).expect(200);
      await claimWith(tokenOf('f')).expect(200);
    });

    it('spends a token it rotates away from for good, so no pool, itself included, is given it again', async () => {
      const old = tokenOf('spent');
      const made = await define({
        key: 'ephemeral',
        token: old,
        tokenVersion: 1,
      }).expect(201);
      const rotated = await redefine(made.body.id, made.body.version, {
        key: 'ephemeral',
        token: tokenOf('rotated'),
        tokenVersion: 2,
      }).expect(200);

      const back = await redefine(made.body.id, rotated.body.version, {
        key: 'ephemeral',
        token: old,
        tokenVersion: 3,
      }).expect(422);
      const elsewhere = await define({ key: 'sandboxes', token: old }).expect(
        422,
      );

      for (const rejected of [back, elsewhere]) {
        expect(rejected.body.errors).toEqual([
          expect.objectContaining({
            path: 'token',
            message: expect.stringContaining('Pool tokens work once only'),
          }),
        ]);
      }
      await claimWith(old).expect(401);
    });

    it('spends the token of a pool that is deleted, so the pool that replaces it cannot be given it', async () => {
      const token = tokenOf('deleted');
      const made = await define({ key: 'ephemeral', token }).expect(201);
      await http()
        .delete(`/api/resources/runner-pools/${made.body.id}`)
        .set(TEST_USER_HEADER, owner)
        .set('If-Match', `"${made.body.version}"`)
        .expect(204);

      const replaced = await define({ key: 'ephemeral', token }).expect(422);

      expect(replaced.body.errors).toEqual([
        expect.objectContaining({
          path: 'token',
          message: expect.stringContaining('Pool tokens work once only'),
        }),
      ]);
    });

    it('rejects the token a live pool has as taken, while letting that pool be given it again', async () => {
      const token = tokenOf('used');
      const holder = await define({
        key: 'ephemeral',
        token,
        tokenVersion: 1,
      }).expect(201);
      const other = await define({
        key: 'sandboxes',
        token: tokenOf('other'),
        tokenVersion: 1,
      }).expect(201);

      const created = await define({ key: 'burst', token }).expect(422);
      const rotated = await redefine(other.body.id, other.body.version, {
        key: 'sandboxes',
        token,
        tokenVersion: 2,
      }).expect(422);

      for (const rejected of [created, rotated]) {
        expect(rejected.body.errors).toEqual([
          expect.objectContaining({
            path: 'token',
            message: expect.stringContaining('belongs to another pool'),
          }),
        ]);
      }
      await redefine(holder.body.id, holder.body.version, {
        key: 'ephemeral',
        token,
        tokenVersion: 2,
      }).expect(200);
    });

    it('gives a token to one pool only, when two ask for it at once', async () => {
      const token = tokenOf('raced');

      const answers = await Promise.all(
        ['ephemeral', 'sandboxes'].map((key) => define({ key, token })),
      );

      expect(answers.map((each) => each.status).sort()).toEqual([201, 422]);
      expect(answers.find((each) => each.status === 422)?.body.errors).toEqual([
        expect.objectContaining({
          path: 'token',
          message: expect.stringContaining('belongs to another pool'),
        }),
      ]);
    });

    it('rejects a spent token by the ledger’s key alone, as a give racing past the check would be', async () => {
      const token = tokenOf('ledgered');
      const made = await define({
        key: 'ephemeral',
        token,
        tokenVersion: 1,
      }).expect(201);
      await redefine(made.body.id, made.body.version, {
        key: 'ephemeral',
        token: tokenOf('moved'),
        tokenVersion: 2,
      }).expect(200);
      const context = new DrizzleContext(db);
      const given = new DrizzleGivenPoolTokensRepository(context);

      await expect(
        context.inTransaction(() =>
          given.give(
            TokenHash.of(sha256Of(token)),
            RunnerPoolId.of(randomUUID()),
          ),
        ),
      ).rejects.toBeInstanceOf(PoolTokenSpentError);
      expect(
        await db
          .select()
          .from(schema.runnerPool)
          .where(eq(schema.runnerPool.workspaceId, workspaceId)),
      ).toHaveLength(1);
    });

    it('keeps only the sha256 of each token it gives, never the token', async () => {
      const first = tokenOf('first');
      const second = tokenOf('second');
      const made = await define({
        key: 'ephemeral',
        token: first,
        tokenVersion: 1,
      }).expect(201);
      await redefine(made.body.id, made.body.version, {
        key: 'ephemeral',
        token: second,
        tokenVersion: 2,
      }).expect(200);

      const given = await db
        .select()
        .from(schema.poolToken)
        .where(eq(schema.poolToken.poolId, made.body.id));

      expect(given.map((each) => each.tokenHash).sort()).toEqual(
        [sha256Of(first), sha256Of(second)].sort(),
      );
      expect(JSON.stringify(given)).not.toContain(first);
    });

    it('tells an autoscaler what waits for it, per label', async () => {
      const token = tokenOf('g');
      const made = await define({
        key: 'ephemeral',
        labels: ['linux', 'gpu'],
        token,
        maxRuns: 3,
      }).expect(201);
      await queue([['linux']]);
      await queue([['gpu']]);
      await queue([['arm']]);
      await report(token).expect(200);
      await claimWith(token).expect(200);

      const queued = await http()
        .get(`/api/pools/${made.body.id}/queue`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(queued.body).toEqual({
        pending: 1,
        running: 1,
        capacity: 2,
        labels: expect.objectContaining({}),
      });
      expect(
        Object.values(queued.body.labels as Record<string, number>).reduce(
          (sum, each) => sum + each,
          0,
        ),
      ).toBe(1);
      await http()
        .get(`/api/pools/${randomUUID()}/queue`)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('settles the Setup list once a host reports in through it, in a workspace connected to GitHub and set up as code', async () => {
      const { list } = await listSetUp(
        db,
        new DrizzleTaskRepository(new DrizzleContext(db), {
          dispatch: async () => {},
        }),
        { workspaceId, teamId: workspaceId, owner },
      );
      await db.insert(schema.githubConnection).values({
        workspaceId,
        installationId: String(randomInt(1, 2 ** 31)),
        version: 1,
      });
      await db.insert(schema.chat).values({
        id: randomUUID(),
        workspaceId,
        teamId: workspaceId,
        startedById: owner,
        title: 'Set up our configuration.',
        harness: 'claude-code',
        setup: {
          repository: 'acme/infra',
          folder: 'spotlight',
          pullRequest: 'https://github.com/acme/infra/pull/12',
        },
      });
      const settledNotes = () =>
        db
          .select({ body: schema.taskNote.body })
          .from(schema.taskNote)
          .where(
            and(
              eq(schema.taskNote.taskId, list.id.value),
              eq(schema.taskNote.form, 'settled'),
            ),
          );

      const token = tokenOf('v');
      await define({ key: 'ephemeral', token }).expect(201);

      expect(await settledNotes()).toEqual([]);

      await report(token).expect(200);

      expect(
        await eventually(async () => {
          const notes = await settledNotes();

          return notes.length > 0 ? notes : null;
        }),
      ).toEqual([{ body: 'Everything on this list is done.' }]);
    });

    it('keeps the workspace from closing, and is audited as Spotlight’s configuration', async () => {
      await define({ key: 'ephemeral', token: tokenOf('h') }).expect(201);

      const workspace = await http()
        .get(`/api/resources/workspaces/${workspaceId}`)
        .set(TEST_USER_HEADER, owner);
      const rejected = await http()
        .delete(`/api/resources/workspaces/${workspaceId}`)
        .set(TEST_USER_HEADER, owner)
        .set('If-Match', `"${workspace.body.version}"`);

      expect(rejected.status).toBe(409);
      expect(JSON.stringify(rejected.body)).toContain('runner pool ephemeral');

      const changes = (
        await http()
          .get(`/api/workspaces/${workspaceId}/configuration-changes`)
          .set(TEST_USER_HEADER, owner)
      ).body as { resource: string; action: string; details: object }[];

      expect(
        changes
          .filter((each) => each.resource === 'runner-pool')
          .map((each) => [each.action, each.details]),
      ).toEqual([['created', { mode: 'pull' }]]);
    });
  });

  describe('a host', () => {
    it('is recorded the first time it says it is here, and kept current after', async () => {
      const token = tokenOf('j');
      const pool = await define({ key: 'ephemeral', token }).expect(201);

      const first = await report(token).expect(200);
      const created = await hostRow();

      expect(first.body).toEqual({ workspace: pool.body.workspaceId });
      expect(created).toMatchObject({
        workspaceId: pool.body.workspaceId,
        poolId: pool.body.id,
        trustId: null,
        session: 'session_1',
        name: 'build-box',
        release: '0.1.0',
        executor: 'docker',
        capacity: 2,
        running: [],
      });

      await new Promise((resolve) => setTimeout(resolve, 20));
      await report(token, HOST, ['run-1']).expect(200);
      const updated = await hostRow();

      expect(updated?.running).toEqual(['run-1']);
      expect(updated?.firstSeenAt).toEqual(created?.firstSeenAt);
      expect(updated?.upSince).toEqual(created?.firstSeenAt);
      expect(updated?.lastSeenAt.getTime()).toBeGreaterThan(
        created?.lastSeenAt.getTime() ?? Number.POSITIVE_INFINITY,
      );
    });

    it('is up again from the first report after it restarts', async () => {
      const token = tokenOf('U');
      await define({ key: 'ephemeral', token }).expect(201);
      await report(token).expect(200);
      const before = await hostRow();

      await new Promise((resolve) => setTimeout(resolve, 20));
      await report(token, HOST, [], 'session_2').expect(200);
      const restarted = await hostRow();

      expect(restarted?.session).toBe('session_2');
      expect(restarted?.firstSeenAt).toEqual(before?.firstSeenAt);
      expect(restarted?.upSince).toEqual(restarted?.lastSeenAt);
      expect(restarted?.upSince.getTime()).toBeGreaterThan(
        before?.upSince.getTime() ?? Number.POSITIVE_INFINITY,
      );
    });

    it('keeps one way in for its life, rejecting the same host id through another pool', async () => {
      const token = tokenOf('k');
      const other = tokenOf('l');
      await define({ key: 'ephemeral', token }).expect(201);
      await define({ key: 'sandboxes', token: other }).expect(201);
      await report(token).expect(200);

      const taken = await report(other).expect(409);
      expect(taken.body).toMatchObject({ reason: 'host-taken' });
      await report(tokenOf('x')).expect(401);
    });

    it('claims nothing for a host id it has never heard from', async () => {
      const token = tokenOf('p');
      await define({ key: 'ephemeral', token }).expect(201);
      await queue();

      const unheard = await claimWith(token).expect(409);
      expect(unheard.body).toMatchObject({ reason: 'host-unreported' });
      expect(await hostRow()).toBeNull();
    });

    it('claims nothing for a host id that reports through another pool', async () => {
      const token = tokenOf('q');
      const other = tokenOf('r');
      await define({ key: 'ephemeral', token }).expect(201);
      await define({ key: 'sandboxes', token: other }).expect(201);
      await report(token).expect(200);
      await queue();

      await claimWith(other).expect(409);
    });

    it('takes over a host id gone silent through another pool, which can then no longer claim for it', async () => {
      const token = tokenOf('s');
      const other = tokenOf('t');
      await define({ key: 'ephemeral', token }).expect(201);
      const taking = await define({ key: 'sandboxes', token: other }).expect(
        201,
      );
      await report(token).expect(200);
      const silentSince = new Date(Date.now() - 91_000);
      await db
        .update(schema.runnerHost)
        .set({
          firstSeenAt: silentSince,
          upSince: silentSince,
          lastSeenAt: silentSince,
        })
        .where(eq(schema.runnerHost.id, HOST));

      await report(other).expect(200);
      const rehomed = await hostRow();

      expect(rehomed).toMatchObject({ poolId: taking.body.id, trustId: null });
      expect(rehomed?.firstSeenAt.getTime()).toBeGreaterThan(
        silentSince.getTime(),
      );
      await queue();
      await claimWith(token).expect(409);
    });

    it('is forgotten once the pool it came in by is retired, leaving its runner on the Runners page with no pool to name', async () => {
      const token = tokenOf('u');
      const pool = await define({ key: 'ephemeral', token }).expect(201);
      await report(token).expect(200);
      await queue();
      const claimed = await claimWith(token).expect(200);

      await http()
        .delete(`/api/resources/runner-pools/${pool.body.id}`)
        .set(TEST_USER_HEADER, owner)
        .set('If-Match', `"${pool.body.version}"`)
        .expect(204);

      await eventually(async () => (await hostRow()) === null);
      const fleet = await http()
        .get(`/api/workspaces/${workspaceId}/runners`)
        .set(TEST_USER_HEADER, owner)
        .expect(200);

      expect(fleet.body.hosts).toEqual([]);
      expect(fleet.body.runners).toEqual([
        expect.objectContaining({
          id: claimed.body.runnerId,
          through: { kind: 'pool', key: null },
          hostId: HOST,
        }),
      ]);
    });

    it('rejects a report that does not add up', async () => {
      const token = tokenOf('m');
      await define({ key: 'ephemeral', token }).expect(201);

      for (const body of [
        {
          session: 'session_1',
          name: 'build-box',
          release: '0.1.0',
          executor: 'docker',
          capacity: 0,
        },
        {
          session: 'session_1',
          name: 'build-box',
          release: '0.1.0',
          executor: 'docker',
          capacity: 1,
          running: ['run-1', 'run-2'],
        },
        {
          session: 'session_1',
          name: '',
          release: '0.1.0',
          executor: 'docker',
          capacity: 1,
        },
        {
          name: 'build-box',
          release: '0.1.0',
          executor: 'docker',
          capacity: 1,
        },
      ]) {
        await http()
          .put(`/api/hosts/${HOST}`)
          .set('Authorization', `Bearer ${token}`)
          .send(body)
          .expect(422);
      }

      expect(await hostRow()).toBeNull();
    });

    it('leaves when it says it is stopping', async () => {
      const token = tokenOf('n');
      await define({ key: 'ephemeral', token }).expect(201);
      await report(token).expect(200);

      await http()
        .delete(`/api/hosts/${HOST}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(await hostRow()).toBeNull();
    });

    it('shows on the Runners page, answering, beside the runner with the lease on the work it claimed', async () => {
      const token = tokenOf('o');
      await define({ key: 'ephemeral', token }).expect(201);
      await report(token, HOST, []).expect(200);
      await queue();
      const claimed = await claimWith(token).expect(200);

      const fleet = await http()
        .get(`/api/workspaces/${workspaceId}/runners`)
        .set(TEST_USER_HEADER, owner)
        .expect(200);

      expect(fleet.body).toEqual({
        hosts: [
          {
            id: HOST,
            name: 'build-box',
            through: { kind: 'pool', key: 'ephemeral' },
            release: '0.1.0',
            executor: 'docker',
            capacity: 2,
            running: [],
            images: [
              {
                image: USUAL,
                digest: null,
                usual: true,
                release: null,
                harnesses: [{ id: 'dev', version: null }],
                unavailableReason: null,
              },
              {
                image: WIDGETS,
                digest: null,
                usual: false,
                release: null,
                harnesses: [{ id: 'dev', version: null }],
                unavailableReason: null,
              },
            ],
            firstSeenAt: expect.any(String),
            upSince: expect.any(String),
            lastSeenAt: expect.any(String),
            answering: true,
          },
        ],
        runners: [
          {
            id: claimed.body.runnerId,
            through: { kind: 'pool', key: 'ephemeral' },
            hostId: HOST,
            image: USUAL,
            harnesses: ['dev'],
            startedAt: expect.any(String),
            lastSeenAt: expect.any(String),
          },
        ],
      });
    });
  });

  describe('a push pool', () => {
    it('provisions a runner for each run with a signed call, and reserves the run for it', async () => {
      const endpoint = await listening(() => 202);

      try {
        await define({
          key: 'sandboxes',
          labels: ['sandbox'],
          provision: { url: endpoint.url, secret: SECRET, secretVersion: 1 },
        }).expect(201);
        const runId = await queue([['sandbox']]);

        const [call] = await eventually(async () =>
          endpoint.calls.length > 0 ? endpoint.calls : null,
        );
        const signed = `${call?.headers['webhook-id']}.${call?.headers['webhook-timestamp']}.${call?.body}`;
        const key = Buffer.from(SECRET.slice('whsec_'.length), 'base64');
        const sent = JSON.parse(call?.body ?? '{}');

        expect(call?.headers['webhook-signature']).toBe(
          `v1,${createHmac('sha256', key).update(signed).digest('base64')}`,
        );
        expect(sent.data).toMatchObject({
          runId,
          pool: 'sandboxes',
          labels: ['sandbox'],
          image: null,
        });

        const oneRun = sent.data.runner.token as string;
        await http()
          .post('/api/runners/register')
          .set('Authorization', `Bearer ${oneRun}`)
          .send({ harnesses: HARNESSES })
          .expect(201);
        const claimed = await http()
          .post('/api/runners/claim')
          .set('Authorization', `Bearer ${oneRun}`)
          .expect(201);

        expect(claimed.body.run.id).toBe(runId);
      } finally {
        endpoint.server.close();
      }
    });

    it('provisions nothing for a run with injected secrets, which only the egress of a host can inject', async () => {
      const endpoint = await listening(() => 202);

      try {
        await define({
          key: 'sandboxes',
          labels: ['sandbox'],
          provision: { url: endpoint.url, secret: SECRET, secretVersion: 1 },
        }).expect(201);
        const withSecrets = randomUUID();
        await db.insert(schema.run).values({
          id: withSecrets,
          workspaceId,
          harness: 'dev',
          state: 'queued',
          placement: [['sandbox']],
          spec: {
            command: { executable: 'sh', args: [] },
            briefing: 'do the thing',
            handover: { options: [], noteLimit: 0 },
            continuity: { key: `task:${withSecrets}` },
            injectedSecrets: ['LINEAR_API_KEY'],
          },
        });
        const plain = await queue([['sandbox']]);

        await eventually(async () =>
          endpoint.calls.some(
            (call) => JSON.parse(call.body).data.runId === plain,
          ),
        );

        expect(
          endpoint.calls.map((call) => JSON.parse(call.body).data.runId),
        ).not.toContain(withSecrets);
        const [waiting] = await db
          .select({
            state: schema.run.state,
            reservedFor: schema.run.reservedFor,
          })
          .from(schema.run)
          .where(eq(schema.run.id, withSecrets));
        expect(waiting).toEqual({ state: 'queued', reservedFor: null });
      } finally {
        endpoint.server.close();
      }
    });

    it('fails a run visibly, in its trace, when provision cannot be reached', async () => {
      const endpoint = await listening(() => 202);
      endpoint.server.close();

      await define({
        key: 'sandboxes',
        provision: { url: endpoint.url, secret: SECRET },
      }).expect(201);
      const runId = await queue();

      const failed = await eventually(async () => {
        await db
          .update(schema.run)
          .set({ nextProvisionAt: null })
          .where(and(eq(schema.run.id, runId), eq(schema.run.state, 'queued')));

        const [row] = await db
          .select()
          .from(schema.run)
          .where(eq(schema.run.id, runId));

        return row?.state === 'failed' ? row : null;
      }, 25_000);

      const steps = await eventually(async () => {
        const written = await db
          .select()
          .from(schema.runJournalEntry)
          .where(eq(schema.runJournalEntry.runId, runId));

        return written.length === 5 ? written : null;
      });

      expect(failed.message).toContain('unreachable');
      expect(failed.provisionFailures).toBe(5);
      expect(steps.map((each) => [each.type, each.message, each.seq])).toEqual(
        [-1, -2, -3, -4, -5].map((seq) => [
          'provision.failed',
          'Provisioning failed · unreachable',
          seq,
        ]),
      );
    }, 30_000);

    it('provisions a runner for a waiting check, hands it that check, and lets it go once the check is reported', async () => {
      const endpoint = await listening(() => 202);

      try {
        await define({
          key: 'sandboxes',
          labels: ['sandbox'],
          provision: { url: endpoint.url, secret: SECRET, secretVersion: 1 },
        }).expect(201);
        const stackId = await awaitingCheck(db, workspaceId, [['sandbox']]);

        const [call] = await eventually(async () =>
          endpoint.calls.length > 0 ? endpoint.calls : null,
        );
        const sent = JSON.parse(call?.body ?? '{}');

        expect(sent.data).toMatchObject({
          kind: 'check',
          stackId,
          taskId: null,
          labels: ['sandbox'],
        });

        const oneRun = sent.data.runner.token as string;
        await http()
          .post('/api/runners/register')
          .set('Authorization', `Bearer ${oneRun}`)
          .send({ harnesses: HARNESSES })
          .expect(201);
        const claimed = await http()
          .post('/api/runners/claim')
          .set('Authorization', `Bearer ${oneRun}`)
          .expect(201);

        expect(claimed.body).toMatchObject({
          kind: 'check',
          check: { stackId },
        });

        await http()
          .post(
            `/api/runs/${claimed.body.check.runId}/change-stack-checks/${stackId}`,
          )
          .set('Authorization', `Bearer ${oneRun}`)
          .send({
            skipped: { code: 'no-checkout', detail: 'nothing to lay out' },
          })
          .expect(204);
        await eventually(
          async () =>
            (
              await http()
                .get('/api/runners/harnesses')
                .set('Authorization', `Bearer ${oneRun}`)
            ).status === 401,
        );
      } finally {
        endpoint.server.close();
      }
    });

    it('skips a check no runner could be provisioned for, and says why', async () => {
      const endpoint = await listening(() => 202);
      endpoint.server.close();

      await define({
        key: 'sandboxes',
        provision: { url: endpoint.url, secret: SECRET },
      }).expect(201);
      const stackId = await awaitingCheck(db, workspaceId, []);

      const skipped = await eventually(async () => {
        await db
          .update(schema.stackCheck)
          .set({ nextProvisionAt: null })
          .where(
            and(
              eq(schema.stackCheck.stackId, stackId),
              eq(schema.stackCheck.phase, 'waiting'),
            ),
          );

        const [row] = await db
          .select()
          .from(schema.stackCheck)
          .where(eq(schema.stackCheck.stackId, stackId));

        return row?.phase === 'skipped' ? row : null;
      }, 25_000);

      expect(skipped.provisionFailures).toBe(5);
      expect(skipped.outcome?.skip).toMatchObject({ code: 'unprovisioned' });
      expect(skipped.outcome?.skip?.detail).toContain('unreachable');
      expect(await checkReadFor(skipped.runId)).toMatchObject({
        state: 'skipped',
        reason: expect.stringContaining(
          'Spotlight couldn’t provision a runner to check the layers.',
        ),
      });
    }, 30_000);

    it('settles a check nobody took up within its hour, letting go of the runner reserved for it', async () => {
      const stackId = await awaitingCheck(db, workspaceId, []);
      const reserved = randomUUID();
      await db.insert(schema.runner).values({
        id: reserved,
        workspaceId,
        poolId: randomUUID(),
        tokenHash: createHash('sha256').update(reserved).digest('hex'),
        claimBy: new Date(Date.now() + 60_000),
        startedAt: new Date(),
      });
      await db
        .update(schema.stackCheck)
        .set({
          waitingSince: new Date(Date.now() - 2 * 60 * 60_000),
          reservedFor: reserved,
          reservedPool: 'pool_1',
          reservedUntil: new Date(Date.now() + 60_000),
        })
        .where(eq(schema.stackCheck.stackId, stackId));

      const settled = await eventually(async () => {
        const [row] = await db
          .select()
          .from(schema.stackCheck)
          .where(eq(schema.stackCheck.stackId, stackId));

        return row?.phase === 'skipped' ? row : null;
      });

      expect(settled.reservedFor).toBeNull();
      expect(settled.outcome?.skip).toMatchObject({ code: 'nobody-checked' });
      expect(await checkReadFor(settled.runId)).toMatchObject({
        state: 'skipped',
        reason: 'No runner checked the layers in time.',
      });
      await eventually(
        async () =>
          (
            await db
              .select()
              .from(schema.runner)
              .where(eq(schema.runner.id, reserved))
          ).length === 0,
      );
    });
  });
});
