import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import { EVENT_WEBHOOK_SUBSCRIBER } from '@platform/events/event-webhook';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { and, eq } from 'drizzle-orm';
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
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const KEY = Buffer.from('e'.repeat(32));

const SECRET = `whsec_${KEY.toString('base64')}`;

const ADMIN_TOKEN = `admin.${randomUUID()}`;

interface Call {
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
  readonly sent: {
    readonly type: string;
    readonly timestamp: string;
    readonly data: Record<string, unknown>;
  };
}

const receiving = async () => {
  const calls: Call[] = [];
  // The calls to fail, by event kind and workspace.
  const failing = new Map<string, number>();
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const call: Call = {
        headers: request.headers,
        body,
        sent: JSON.parse(body) as Call['sent'],
      };
      calls.push(call);
      const key = `${call.sent.type} ${String(call.sent.data.workspaceId)}`;
      const left = failing.get(key) ?? 0;

      if (left > 0) {
        failing.set(key, left - 1);
        response.statusCode = 503;
        response.end('busy');
        return;
      }

      response.statusCode = 204;
      response.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    server,
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/events`,
    calls,
    failing,
  };
};

describe('deployment event webhook (e2e)', () => {
  let receiver: Awaited<ReturnType<typeof receiving>>;
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let member: string;
  let unseat: () => Promise<void>;

  const admin = () => ({
    put: (path: string, body: object) =>
      served(app)
        .put(path)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send(body),
    post: (path: string, body?: object) =>
      served(app)
        .post(path)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send(body),
  });

  const callsOf = (type: string) =>
    receiver.calls.filter(
      (each) =>
        each.sent.type === type && each.sent.data.workspaceId === workspaceId,
    );

  const deliveryOf = async (eventId: string) => {
    const [row] = await db
      .select()
      .from(schema.eventDelivery)
      .where(
        and(
          eq(schema.eventDelivery.eventId, eventId),
          eq(schema.eventDelivery.subscriber, EVENT_WEBHOOK_SUBSCRIBER),
        ),
      );

    return row ?? null;
  };

  const setPlan = (plan: string) =>
    admin()
      .put(`/api/admin/workspaces/${workspaceId}/plan`, {
        plan,
        expiresAt: null,
      })
      .expect(200);

  beforeAll(async () => {
    receiver = await receiving();
    app = await openApp(undefined, {
      env: {
        SPOTLIGHT_ADMIN_TOKEN: ADMIN_TOKEN,
        SPOTLIGHT_EVENT_WEBHOOK_URL: receiver.url,
        SPOTLIGHT_EVENT_WEBHOOK_SECRET: SECRET,
        SPOTLIGHT_EVENT_WEBHOOK_KINDS: [],
      },
    });
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
    receiver.server.close();
  });

  beforeEach(async () => {
    workspaceId = `events-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    member = seat.member;
    unseat = seat.unseat;
    receiver.failing.clear();
  });

  afterEach(async () => {
    await db
      .delete(schema.workspacePlan)
      .where(eq(schema.workspacePlan.workspaceId, workspaceId));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId));
    await unseat();
  });

  it('sends an integration event as one POST, signed per Standard Webhooks, with the id of its outbox record as webhook-id', async () => {
    await setPlan('team');

    const [call] = await eventually(async () => {
      const found = callsOf('catalog.workspace-plan-created.v1');
      return found.length > 0 ? found : null;
    });
    const id = String(call?.headers['webhook-id']);
    const timestamp = String(call?.headers['webhook-timestamp']);
    const [event] = await db
      .select()
      .from(schema.eventOutbox)
      .where(eq(schema.eventOutbox.id, id));

    expect(call?.headers['webhook-signature']).toBe(
      `v1,${createHmac('sha256', KEY)
        .update(`${id}.${timestamp}.${call?.body}`)
        .digest('base64')}`,
    );
    expect(event?.kind).toBe('catalog.workspace-plan-created.v1');
    expect(call?.sent).toEqual({
      type: 'catalog.workspace-plan-created.v1',
      timestamp: event?.recordedAt.toISOString(),
      data: { workspaceId, plan: 'team', expiresAt: null },
    });
    expect((await deliveryOf(id))?.deliveredAt).not.toBeNull();
  });

  it('sends integration events of every context, and no domain event', async () => {
    await served(app)
      .patch(`/api/workspaces/${workspaceId}/members/${member}`)
      .set(TEST_USER_HEADER, owner)
      .send({ role: 'admin' })
      .expect(204);

    const [call] = await eventually(async () => {
      const found = callsOf('identity.workspace-member-role-changed.v1');
      return found.length > 0 ? found : null;
    });

    expect(call?.sent.data).toEqual({
      workspaceId,
      userId: member,
      role: 'admin',
    });
    expect(
      receiver.calls.filter((each) => !/\.v\d+$/.test(each.sent.type)),
    ).toEqual([]);
  });

  it('tries again after an answer other than 2xx, with the same webhook-id', async () => {
    receiver.failing.set(`catalog.workspace-plan-created.v1 ${workspaceId}`, 1);
    await setPlan('team');

    const [failed] = await eventually(async () => {
      const found = callsOf('catalog.workspace-plan-created.v1');
      return found.length > 0 ? found : null;
    });
    const id = String(failed?.headers['webhook-id']);
    const retried = await eventually(async () => {
      const row = await deliveryOf(id);
      return row && row.attempts === 1 ? row : null;
    });

    expect(retried).toMatchObject({
      deliveredAt: null,
      deadLetteredAt: null,
      lastError: 'The event webhook answered 503. Response: busy',
    });

    await db
      .update(schema.eventDelivery)
      .set({ dueAt: new Date() })
      .where(
        and(
          eq(schema.eventDelivery.eventId, id),
          eq(schema.eventDelivery.subscriber, EVENT_WEBHOOK_SUBSCRIBER),
        ),
      );

    const delivered = await eventually(async () => {
      const row = await deliveryOf(id);
      return row?.deliveredAt ? row : null;
    });

    expect(delivered.attempts).toBe(2);
    expect(
      callsOf('catalog.workspace-plan-created.v1').map((each) =>
        String(each.headers['webhook-id']),
      ),
    ).toEqual([id, id]);
  });

  it('keeps a dead letter after the last attempt, and sends it again when the admin API redelivers it', async () => {
    const since = new Date(Date.now() - 1000).toISOString();
    receiver.failing.set(`catalog.workspace-plan-created.v1 ${workspaceId}`, 2);
    await setPlan('team');

    const [failed] = await eventually(async () => {
      const found = callsOf('catalog.workspace-plan-created.v1');
      return found.length > 0 ? found : null;
    });
    const id = String(failed?.headers['webhook-id']);
    const at = and(
      eq(schema.eventDelivery.eventId, id),
      eq(schema.eventDelivery.subscriber, EVENT_WEBHOOK_SUBSCRIBER),
    );

    await eventually(async () => (await deliveryOf(id))?.attempts === 1);
    await db
      .update(schema.eventDelivery)
      .set({ attempts: 23, dueAt: new Date() })
      .where(at);

    const deadLettered = await eventually(async () => {
      const row = await deliveryOf(id);
      return row?.deadLetteredAt ? row : null;
    });

    expect(deadLettered).toMatchObject({ attempts: 24, deliveredAt: null });

    const later = new Date(Date.now() + 60_000).toISOString();

    expect(
      (
        await admin().post('/api/admin/event-webhook/redeliver', {
          since: later,
        })
      ).body,
    ).toEqual({ queued: 0 });

    const redelivered = await admin()
      .post('/api/admin/event-webhook/redeliver', { since })
      .expect(200);

    expect(redelivered.body).toEqual({ queued: 1 });

    const delivered = await eventually(async () => {
      const row = await deliveryOf(id);
      return row?.deliveredAt ? row : null;
    });

    expect(delivered).toMatchObject({ attempts: 1, deadLetteredAt: null });
    expect(callsOf('catalog.workspace-plan-created.v1')).toHaveLength(3);
  });

  it('refuses a redelivery without since as an ISO 8601 time, or without the admin token', async () => {
    await admin().post('/api/admin/event-webhook/redeliver', {}).expect(400);
    await admin()
      .post('/api/admin/event-webhook/redeliver', { since: 'yesterday' })
      .expect(400);
    await served(app)
      .post('/api/admin/event-webhook/redeliver')
      .send({ since: new Date().toISOString() })
      .expect(401);
  });
});
