import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { ManagedPools } from '@runners/application/services/managed-pools.service';
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

describe('managed runner pool (e2e)', () => {
  let managedEndpoint: Awaited<ReturnType<typeof listening>>;
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let unseat: () => Promise<void>;

  const http = () => served(app);

  const managed = () => app.get(ManagedPools);

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

  const managedRow = async () => {
    const [row] = await db
      .select()
      .from(schema.runnerPool)
      .where(
        and(
          eq(schema.runnerPool.workspaceId, workspaceId),
          eq(schema.runnerPool.managed, true),
        ),
      );

    return row ?? null;
  };

  beforeAll(async () => {
    managedEndpoint = await listening();
    app = await openApp(undefined, {
      env: {
        SPOTLIGHT_MANAGED_POOL_URL: managedEndpoint.url,
        SPOTLIGHT_MANAGED_POOL_SECRET: SECRET,
        SPOTLIGHT_MANAGED_POOL_LABELS: '',
      },
    });
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
    managedEndpoint.server.close();
  });

  beforeEach(async () => {
    workspaceId = `managed-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    unseat = seat.unseat;
    await managed().createFor(WorkspaceId.of(workspaceId));
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

  it('adds one managed pool to the workspace, with no provision URL or secret in its row', async () => {
    await managed().reconcile();

    const row = await managedRow();

    expect(row).toMatchObject({
      key: 'spotlight',
      managed: true,
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
      managedEndpoint.calls.find((each) => runIdOf(each) === runId),
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

  it('keeps a run that a pool of the workspace fits off the managed pool', async () => {
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

      expect(managedEndpoint.calls.map(runIdOf)).not.toContain(runId);
    } finally {
      own.server.close();
    }
  });

  it('leaves the managed pool out of the pools that Terraform reads, and refuses a pool with its key', async () => {
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
        provision: { url: managedEndpoint.url, secret: OWN_SECRET },
      });

    expect(refused.status).toBe(422);
    expect(JSON.stringify(refused.body)).toContain(
      'the key of the pool that this deployment manages',
    );

    const row = await managedRow();

    await http()
      .get(`/api/v1/resources/runner-pools/${row?.id}`)
      .set(TEST_USER_HEADER, owner)
      .expect(404);
  });

  it('provisions nothing through the managed pool of a workspace whose operator disabled it, also after a restart', async () => {
    const by = ChangeActor.spotlight(WorkspaceId.of(workspaceId));

    await expect(
      managed().update(WorkspaceId.of(workspaceId), true, by),
    ).resolves.toEqual({ outcome: 'updated', disabled: true });
    await managed().reconcile();
    const runId = await queue();

    await app.get(ProvisionWork).due();

    expect(managedEndpoint.calls.map(runIdOf)).not.toContain(runId);
    expect(await managedRow()).toMatchObject({ disabled: true });
  });
});
