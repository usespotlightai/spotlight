import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { SetPlatformPoolCommand } from '@runners/application/commands/platform-pool.commands';
import { PlatformPools } from '@runners/application/services/platform-pools.service';
import { ProvisionWork } from '@runs/application/services/provision-work.service';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
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
import { eventually } from './support/eventually';
import { deleteRunnersOf } from './support/runners';
import { requestedBySpec } from './support/runs';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const SECRET = `whsec_${Buffer.from('m'.repeat(32)).toString('base64')}`;

const ADMIN_TOKEN = `admin.${randomUUID()}`;

const OWN_SECRET = `whsec_${Buffer.from('o'.repeat(32)).toString('base64')}`;

interface Provisioned {
  readonly headers: IncomingMessage['headers'];
  readonly body: string;
}

interface ProvisionCall {
  readonly data: {
    readonly runId: string;
    readonly pool: string;
    readonly workspaceId: string;
  };
}

const runIdOf = (call: Provisioned): string =>
  (JSON.parse(call.body) as ProvisionCall).data.runId;

const listening = async (): Promise<{
  server: Server;
  url: string;
  calls: Provisioned[];
}> => {
  const calls: Provisioned[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      calls.push({ headers: request.headers, body });
      response.statusCode = 202;
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

describe('platform runner pool (e2e)', () => {
  let platformEndpoint: Awaited<ReturnType<typeof listening>>;
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let unseat: () => Promise<void>;

  const http = () => served(app);

  const platformPools = () => app.get(PlatformPools);

  const queue = async (placement: string[][] = []) => {
    const id = randomUUID();

    await db.insert(schema.run).values({
      ...requestedBySpec(id),
      id,
      workspaceId,
      harness: 'dev',
      state: 'queued',
      placement,
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'do the thing',
        handover: { options: [], noteLimit: 0 },
        resume: {},
      },
    });

    return id;
  };

  const platformRow = async () => {
    const [row] = await db
      .select()
      .from(schema.runnerPool)
      .where(
        and(
          eq(schema.runnerPool.workspaceId, workspaceId),
          eq(schema.runnerPool.platform, true),
        ),
      );

    return row ?? null;
  };

  const platformEnv = () => ({
    SPOTLIGHT_PLATFORM_POOL_URL: platformEndpoint.url,
    SPOTLIGHT_PLATFORM_POOL_SECRET: SECRET,
    SPOTLIGHT_PLATFORM_POOL_LABELS: [],
  });

  const setPlatformPool = (
    on: INestApplication,
    enabled: unknown,
    token: string | null = ADMIN_TOKEN,
    id = workspaceId,
  ) => {
    const call = served(on).put(`/api/admin/workspaces/${id}/platform-pool`);

    return (token ? call.set('Authorization', `Bearer ${token}`) : call).send({
      enabled,
    });
  };

  beforeAll(async () => {
    platformEndpoint = await listening();
    app = await openApp(undefined, {
      env: { ...platformEnv(), SPOTLIGHT_ADMIN_TOKEN: ADMIN_TOKEN },
    });
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
    platformEndpoint.server.close();
  });

  beforeEach(async () => {
    workspaceId = `platform-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    unseat = seat.unseat;
    await platformPools().add(WorkspaceId.of(workspaceId));
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

  it('adds the platform pool to a workspace created through the API, when identity.workspace-created.v1 arrives', async () => {
    const slug = `acme-${randomUUID().slice(0, 8)}`;
    // Another person makes the workspace, so that the cleanup of the seated team keeps working. The database is dropped with the app.
    const founder = randomUUID();
    await db
      .insert(schema.user)
      .values({ id: founder, name: 'Ada', email: `${founder}@example.com` });
    const created = await http()
      .post('/api/workspaces')
      .set(TEST_USER_HEADER, founder)
      .send({
        name: 'Acme',
        slug,
        teamName: 'Core',
        survey: { jobFunction: 'engineering' },
      })
      .expect(201);
    const { id } = created.body as { id: string };

    const [row] = await eventually(async () => {
      const rows = await db
        .select()
        .from(schema.runnerPool)
        .where(eq(schema.runnerPool.workspaceId, id));

      return rows.length > 0 ? rows : null;
    });

    expect(row).toMatchObject({ key: 'spotlight', platform: true });
  });

  it('adds one platform pool to the workspace, with no provision URL or secret in its row', async () => {
    await platformPools().reconcile();

    const row = await platformRow();

    expect(row).toMatchObject({
      key: 'spotlight',
      platform: true,
      disabled: false,
      provisionUrl: null,
      provisionSecret: null,
      maxRuns: null,
    });
    expect(
      await db
        .select({ id: schema.runnerPool.id })
        .from(schema.runnerPool)
        .where(eq(schema.runnerPool.workspaceId, workspaceId)),
    ).toHaveLength(1);
  });

  it('provisions a run that names no runners through the provisioner of the deployment, signed with its secret', async () => {
    const runId = await queue();

    const call = await eventually(async () =>
      platformEndpoint.calls.find((each) => runIdOf(each) === runId),
    );
    const signed = `${String(call.headers['webhook-id'])}.${String(call.headers['webhook-timestamp'])}.${call.body}`;
    const key = Buffer.from(SECRET.slice('whsec_'.length), 'base64');

    expect(call.headers['webhook-signature']).toBe(
      `v1,${createHmac('sha256', key).update(signed).digest('base64')}`,
    );
    expect((JSON.parse(call.body) as ProvisionCall).data).toMatchObject({
      pool: 'spotlight',
      workspaceId,
    });
  });

  it('keeps a run that a pull pool of the workspace fits off the platform pool', async () => {
    await http()
      .post(`/api/v1/resources/workspaces/${workspaceId}/runner-pools`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'ephemeral', labels: ['on-premises'] })
      .expect(201);
    const runId = await queue([['on-premises']]);

    await app.get(ProvisionWork).due();

    expect(platformEndpoint.calls.map(runIdOf)).not.toContain(runId);
  });

  it('keeps a run that a push pool of the workspace fits off the platform pool', async () => {
    const own = await listening();

    try {
      await http()
        .post(`/api/v1/resources/workspaces/${workspaceId}/runner-pools`)
        .set(TEST_USER_HEADER, owner)
        .set('Idempotency-Key', randomUUID())
        .send({
          key: 'sandboxes',
          labels: ['sandbox'],
          provision: { url: own.url, secret: OWN_SECRET, secretVersion: 1 },
        })
        .expect(201);
      const runId = await queue([['sandbox']]);

      await eventually(async () =>
        own.calls.some((each) => runIdOf(each) === runId),
      );

      expect(platformEndpoint.calls.map(runIdOf)).not.toContain(runId);
    } finally {
      own.server.close();
    }
  });

  it('leaves the platform pool out of the pools that Terraform reads, and refuses a pool with its key', async () => {
    const listed = await http()
      .get(`/api/v1/resources/workspaces/${workspaceId}/runner-pools`)
      .set(TEST_USER_HEADER, owner)
      .expect(200);

    expect(listed.body).toMatchObject({ items: [] });

    const refused = await http()
      .post(`/api/v1/resources/workspaces/${workspaceId}/runner-pools`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({
        key: 'spotlight',
        provision: { url: platformEndpoint.url, secret: OWN_SECRET },
      });

    expect(refused.status).toBe(422);
    expect(JSON.stringify(refused.body)).toContain(
      'the key of the platform pool that Spotlight adds to each workspace',
    );

    const row = await platformRow();

    await http()
      .get(`/api/v1/resources/runner-pools/${row?.id}`)
      .set(TEST_USER_HEADER, owner)
      .expect(404);
  });

  it('provisions nothing through the platform pool of a workspace whose operator disabled it, also after a restart', async () => {
    await expect(
      app
        .get(CommandBus)
        .execute(new SetPlatformPoolCommand(workspaceId, { enabled: false })),
    ).resolves.toEqual({
      outcome: 'disabled',
      allowsSecrets: false,
      allowsReviewWork: false,
    });
    await platformPools().reconcile();
    const runId = await queue();

    await app.get(ProvisionWork).due();

    expect(platformEndpoint.calls.map(runIdOf)).not.toContain(runId);
    expect(await platformRow()).toMatchObject({ disabled: true });
  });

  describe('the admin route that disables and enables it', () => {
    it('answers 404 while no admin token is set, and 401 without the admin token', async () => {
      // The same platform provisioner, so that the start of this app keeps the platform pools of the shared database.
      const tokenless = await openApp(undefined, {
        env: platformEnv(),
        sharingDatabaseOf: app,
      });

      try {
        await setPlatformPool(tokenless, false).expect(404);
      } finally {
        await tokenless.close();
      }

      await setPlatformPool(app, false, null).expect(401);
      await setPlatformPool(app, false, `admin.${randomUUID()}`).expect(401);
      expect(await platformRow()).toMatchObject({ disabled: false });
    });

    it('disables and enables the platform pool, which takes work only while enabled, and records each change as made by Spotlight', async () => {
      await setPlatformPool(app, false).expect(200).expect({
        enabled: false,
        allowsSecrets: false,
        allowsReviewWork: false,
      });
      const waitingRun = await queue();

      await app.get(ProvisionWork).due();

      expect(platformEndpoint.calls.map(runIdOf)).not.toContain(waitingRun);

      await setPlatformPool(app, true).expect(200).expect({
        enabled: true,
        allowsSecrets: false,
        allowsReviewWork: false,
      });

      await eventually(async () =>
        platformEndpoint.calls.some((each) => runIdOf(each) === waitingRun),
      );

      const changes = await http()
        .get(`/api/workspaces/${workspaceId}/configuration-changes`)
        .set(TEST_USER_HEADER, owner)
        .expect(200);
      const updated = (
        changes.body as readonly {
          resource: string;
          key: string;
          action: string;
          by: { kind: string };
          details: Record<string, unknown>;
        }[]
      ).filter(
        (each) => each.resource === 'runner-pool' && each.action === 'updated',
      );

      expect(updated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'spotlight',
            by: expect.objectContaining({ kind: 'spotlight' }) as unknown,
            details: expect.objectContaining({ disabled: true }) as unknown,
          }),
          expect.objectContaining({
            key: 'spotlight',
            details: expect.objectContaining({ disabled: false }) as unknown,
          }),
        ]),
      );
    });

    it('allows the platform pool secrets and review work, leaving enabled as it is, and records the change', async () => {
      await served(app)
        .put(`/api/admin/workspaces/${workspaceId}/platform-pool`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ allowsSecrets: true, allowsReviewWork: true })
        .expect(200)
        .expect({ enabled: true, allowsSecrets: true, allowsReviewWork: true });

      expect(await platformRow()).toMatchObject({
        disabled: false,
        allowsSecrets: true,
        allowsReviewWork: true,
      });
    });

    it('refuses a body without enabled, and finds no workspace that names none', async () => {
      await setPlatformPool(app, 'no').expect(400);
      await setPlatformPool(app, false, ADMIN_TOKEN, randomUUID()).expect(404);
    });

    it('says that the workspace has its own pool with the key spotlight', async () => {
      const own = `platform-${randomUUID().slice(0, 8)}`;
      const seat = await seatTeam(db, own);

      try {
        await db.insert(schema.runnerPool).values({
          id: randomUUID(),
          workspaceId: own,
          key: 'spotlight',
          tokenHash: randomUUID().replaceAll('-', '').repeat(2),
        });

        const refused = await setPlatformPool(app, false, ADMIN_TOKEN, own);

        expect(refused.status).toBe(409);
        expect(JSON.stringify(refused.body)).toContain(
          'its own runner pool with the key spotlight',
        );
      } finally {
        await deleteRunnersOf(db, own);
        await seat.unseat();
      }
    });

    it('says that the deployment adds no platform pool while it sets no platform provisioner', async () => {
      const unset = await openApp(undefined, {
        env: { SPOTLIGHT_ADMIN_TOKEN: ADMIN_TOKEN },
      });

      try {
        const id = `platform-${randomUUID().slice(0, 8)}`;
        const seat = await seatTeam(unset.get<DrizzleDatabase>(DRIZZLE), id);
        const refused = await setPlatformPool(unset, false, ADMIN_TOKEN, id);

        expect(refused.status).toBe(409);
        expect(JSON.stringify(refused.body)).toContain(
          'this deployment adds no platform pool',
        );
        await seat.unseat();
      } finally {
        await unset.close();
      }
    });
  });
});
