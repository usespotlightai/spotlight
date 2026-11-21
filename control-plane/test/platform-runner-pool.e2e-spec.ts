import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DisablePlatformPoolCommand } from '@runners/application/commands/platform-pool.commands';
import { PlatformPools } from '@runners/application/services/platform-pools.service';
import { ProvisionWork } from '@runs/application/services/provision-work.service';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
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

  beforeAll(async () => {
    platformEndpoint = await listening();
    app = await openApp(undefined, {
      env: {
        SPOTLIGHT_PLATFORM_POOL_URL: platformEndpoint.url,
        SPOTLIGHT_PLATFORM_POOL_SECRET: SECRET,
        SPOTLIGHT_PLATFORM_POOL_LABELS: [],
      },
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
        .execute(
          new DisablePlatformPoolCommand(
            workspaceId,
            ChangeActor.spotlight(WorkspaceId.of(workspaceId)),
          ),
        ),
    ).resolves.toEqual({ outcome: 'disabled' });
    await platformPools().reconcile();
    const runId = await queue();

    await app.get(ProvisionWork).due();

    expect(platformEndpoint.calls.map(runIdOf)).not.toContain(runId);
    expect(await platformRow()).toMatchObject({ disabled: true });
  });
});
