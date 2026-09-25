import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  CHANGE_STACK_READER,
  type ChangeStackReaderPort,
} from '@change-review/application/ports/change-stack-reader.port';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { POOL_TOKEN_HEADER } from '@runners/presentation/http/controllers/runner-pool-resource.controller';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const HARNESSES = [{ id: 'dev', models: [] }];

const SECRET = `whsec_${Buffer.from('p'.repeat(32)).toString('base64')}`;

const tokenOf = (seed: string): string => seed.repeat(40).slice(0, 40);

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

const eventually = async <T>(
  check: () => Promise<T | null | undefined | false>,
  within = 15_000,
): Promise<T> => {
  const deadline = Date.now() + within;

  for (;;) {
    const found = await check();

    if (found) {
      return found;
    }

    if (Date.now() > deadline) {
      throw new Error('it never happened');
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

describe('runner pools (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let held: string;
  let owner: string;
  let unseat: () => Promise<void>;

  const http = () => served(app);

  const define = (body: object) =>
    http()
      .post(`/api/resources/workspaces/${held}/runner-pools`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send(body);

  const redefine = (id: string, version: number, body: object) =>
    http()
      .put(`/api/resources/runner-pools/${id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${version}"`)
      .send(body);

  const queue = async (placement: string[][] = []) => {
    const id = randomUUID();

    await db.insert(schema.run).values({
      id,
      workspaceId: held,
      harness: 'dev',
      state: 'queued',
      placement,
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'do the thing',
        handover: { options: [], noteLimit: 0 },
        continuity: { key: `task:${id}`, keep: false },
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

  const claimWith = (token: string) =>
    http()
      .post('/api/pools/claim')
      .set('Authorization', `Bearer ${token}`)
      .send({ harnesses: HARNESSES });

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
    held = `pools-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, held);
    owner = seat.owner;
    unseat = seat.unseat;
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(inArray(schema.idempotentCreate.scope, [`person:${owner}`]));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, held));
    await forgetRunnersOf(db, held);
    await unseat();
  });

  describe('a pull pool', () => {
    it('swaps its token, at each claim, for a credential good for that one run', async () => {
      const token = tokenOf('a');
      await define({ key: 'ephemeral', labels: ['linux'], token }).expect(201);
      const runId = await queue([['linux']]);

      const claimed = await claimWith(token).expect(200);

      expect(claimed.body.work).toMatchObject({
        kind: 'run',
        run: { id: runId },
      });
      expect(claimed.body.token).not.toBe(token);
      await runnerCall(claimed.body.token).renew(runId).expect(201);
      await runnerCall(token).renew(runId).expect(401);
    });

    it('issues a token Terraform does not keep when none is given', async () => {
      const made = await define({ key: 'ephemeral' }).expect(201);
      const issued = made.headers[POOL_TOKEN_HEADER.toLowerCase()] as string;
      await queue();

      expect(issued).toEqual(expect.any(String));
      expect(made.body).toMatchObject({ mode: 'pull', provision: null });
      await claimWith(issued).expect(200);
    });

    it('answers nothing when no run fits, and refuses a token it does not know', async () => {
      const token = tokenOf('b');
      await define({ key: 'ephemeral', labels: ['linux'], token }).expect(201);
      await queue([['gpu']]);

      await claimWith(token).expect(204);
      await claimWith(tokenOf('z')).expect(401);
    }, 30_000);

    it('holds no more runs at once than maxRuns', async () => {
      const token = tokenOf('c');
      await define({ key: 'ephemeral', token, maxRuns: 1 }).expect(201);
      await queue();
      await queue();

      await claimWith(token).expect(200);
      await claimWith(token).expect(204);
    }, 30_000);

    it('rotates its token in place: the pool keeps its id, the old token is refused at once, and a claimed run finishes', async () => {
      const old = tokenOf('d');
      const made = await define({
        key: 'ephemeral',
        token: old,
        tokenVersion: 1,
      }).expect(201);
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
      await runnerCall(claimed.body.token).complete(runId).expect(204);
      await eventually(
        async () =>
          (await runnerCall(claimed.body.token).renew(runId)).status === 401,
      );
    });

    it('refuses to rotate its token without a new one', async () => {
      const made = await define({
        key: 'ephemeral',
        token: tokenOf('f'),
        tokenVersion: 1,
      }).expect(201);

      const refused = await redefine(made.body.id, made.body.version, {
        key: 'ephemeral',
        tokenVersion: 2,
      }).expect(422);
      await queue();

      expect(refused.body.errors).toEqual([
        expect.objectContaining({ path: 'token' }),
      ]);
      await claimWith(tokenOf('f')).expect(200);
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

    it('keeps the workspace from closing, and is audited as Spotlight’s configuration', async () => {
      await define({ key: 'ephemeral', token: tokenOf('h') }).expect(201);

      const workspace = await http()
        .get(`/api/resources/workspaces/${held}`)
        .set(TEST_USER_HEADER, owner);
      const refused = await http()
        .delete(`/api/resources/workspaces/${held}`)
        .set(TEST_USER_HEADER, owner)
        .set('If-Match', `"${workspace.body.version}"`);

      expect(refused.status).toBe(409);
      expect(JSON.stringify(refused.body)).toContain('runner pool ephemeral');

      const changes = (
        await http()
          .get(`/api/workspaces/${held}/configuration-changes`)
          .set(TEST_USER_HEADER, owner)
      ).body as { resource: string; action: string; details: object }[];

      expect(
        changes
          .filter((each) => each.resource === 'runner-pool')
          .map((each) => [each.action, each.details]),
      ).toEqual([['created', { mode: 'pull' }]]);
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

      const steps = await db
        .select()
        .from(schema.runJournalEntry)
        .where(eq(schema.runJournalEntry.runId, runId));

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
        const stackId = await awaitingCheck(db, held, [['sandbox']]);

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
      const stackId = await awaitingCheck(db, held, []);

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
          'No runner could be provisioned to check the layers.',
        ),
      });
    }, 30_000);

    it('settles a check nobody took up within its hour, letting go of the runner reserved for it', async () => {
      const stackId = await awaitingCheck(db, held, []);
      const reserved = randomUUID();
      await db.insert(schema.poolRunner).values({
        id: reserved,
        workspaceId: held,
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
              .from(schema.poolRunner)
              .where(eq(schema.poolRunner.id, reserved))
          ).length === 0,
      );
    });
  });
});
