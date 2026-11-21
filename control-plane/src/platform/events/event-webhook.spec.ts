import { createHmac } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { EventSubscribers } from '@platform/events/event-subscribers';
import {
  EVENT_WEBHOOK_RETRY,
  EVENT_WEBHOOK_RETRY_HOURS,
  EVENT_WEBHOOK_SUBSCRIBER,
  EventWebhook,
  eventWebhookSink,
} from '@platform/events/event-webhook';
import { OutboundGuard } from '@platform/outbound/outbound-guard';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const KEY = Buffer.from('w'.repeat(32));

const SECRET = `whsec_${KEY.toString('base64')}`;

const NOW = new Date('2026-11-21T10:00:00.000Z');

const RECORDED = new Date('2026-11-21T09:59:58.123Z');

const RECORD = { id: 'event_1', recordedAt: RECORDED };

const JOINED = {
  kind: 'identity.workspace-member-joined.v1',
  workspaceId: 'ws_1',
  userId: 'user_1',
  role: 'member',
} as const;

interface Received {
  readonly path: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

let server: Server;
let base: string;
const received: Received[] = [];
let status = 204;

beforeAll(async () => {
  server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      received.push({
        path: request.url ?? '',
        headers: request.headers,
        body,
      });

      if (request.url === '/moved') {
        response.writeHead(307, { location: `${base}/events` });
        response.end();
        return;
      }

      response.statusCode = status;
      response.end(status >= 300 ? 'try later' : '');
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((done) => server.close(done));
});

beforeEach(() => {
  received.length = 0;
  status = 204;
});

const webhook = (path = '/events', hosts = '127.0.0.1') =>
  new EventWebhook(
    { url: `${base}${path}`, secret: SECRET },
    new OutboundGuard(HostAllowList.listed(hosts), true),
    { now: () => NOW, sleep: async () => undefined },
  );

describe('EventWebhook', () => {
  it('posts the event as type, timestamp and data, signed per Standard Webhooks', async () => {
    await webhook().send(JOINED, RECORD);

    const [call] = received;
    const timestamp = String(Math.floor(NOW.getTime() / 1000));

    expect(call?.headers).toMatchObject({
      'content-type': 'application/json',
      'webhook-id': 'event_1',
      'webhook-timestamp': timestamp,
      'webhook-signature': `v1,${createHmac('sha256', KEY)
        .update(`event_1.${timestamp}.${call?.body}`)
        .digest('base64')}`,
    });
    expect(JSON.parse(call?.body ?? '')).toEqual({
      type: 'identity.workspace-member-joined.v1',
      timestamp: '2026-11-21T09:59:58.123Z',
      data: { workspaceId: 'ws_1', userId: 'user_1', role: 'member' },
    });
  });

  it('throws when the webhook answers other than 2xx, so the outbox tries again', async () => {
    status = 503;

    await expect(webhook().send(JOINED, RECORD)).rejects.toThrow(
      'The event webhook answered 503. Response: try later',
    );
  });

  it('follows no redirect', async () => {
    await expect(webhook('/moved').send(JOINED, RECORD)).rejects.toThrow(
      'The event webhook answered 307.',
    );
    expect(received.map((each) => each.path)).toEqual(['/moved']);
  });

  it('throws when the deployment’s allow-list does not include the host', async () => {
    await expect(
      webhook('/events', 'events.example.com').send(JOINED, RECORD),
    ).rejects.toThrow('Host is not on the allowed list.');
    expect(received).toEqual([]);
  });

  it('goes out under the deployment’s allow-list, not the list of a workspace it starts in', async () => {
    await OutboundScope.within(
      HostAllowList.of(['slack.com']),
      'Host is outside this workspace’s list.',
      () => webhook().send(JOINED, RECORD),
    );

    expect(received).toHaveLength(1);
  });
});

describe('eventWebhookSink', () => {
  const listening = (kinds: readonly string[]) => {
    const subscribers = new EventSubscribers();
    subscribers.registerSink(eventWebhookSink(webhook(), kinds));

    return (kind: string) =>
      subscribers.subscribersHearing(kind).map((each) => each.name);
  };

  it('hears every integration event and no domain event when no kinds are set', () => {
    const heard = listening([]);

    expect(heard('identity.workspace-created.v1')).toEqual([
      EVENT_WEBHOOK_SUBSCRIBER,
    ]);
    expect(heard('runs.run-usage-recorded.v1')).toEqual([
      EVENT_WEBHOOK_SUBSCRIBER,
    ]);
    expect(heard('workspace.created')).toEqual([]);
  });

  it('hears the kinds set in full, and the integration events of the contexts set', () => {
    const heard = listening(['identity.', 'runs.run-usage-recorded.v1']);

    expect(heard('identity.workspace-member-joined.v1')).toEqual([
      EVENT_WEBHOOK_SUBSCRIBER,
    ]);
    expect(heard('runs.run-usage-recorded.v1')).toEqual([
      EVENT_WEBHOOK_SUBSCRIBER,
    ]);
    expect(heard('runs.run-usage-recorded.v10')).toEqual([]);
    expect(heard('runs.run-ended.v1')).toEqual([]);
    expect(heard('workspace.member-joined')).toEqual([]);
  });

  it('calls out, and retries for about 13 hours with waits of at most one hour', () => {
    const { subscriber, retry } = eventWebhookSink(webhook(), []);
    const waits = Array.from(
      { length: EVENT_WEBHOOK_RETRY.maxAttempts - 1 },
      (_, index) =>
        (EVENT_WEBHOOK_RETRY.nextAttemptAt(index + 1, NOW)?.getTime() ?? 0) -
        NOW.getTime(),
    );
    const hours = waits.reduce((sum, each) => sum + each, 0) / 3_600_000;

    expect(subscriber.callsOut).toBe(true);
    expect(retry).toBe(EVENT_WEBHOOK_RETRY);
    expect(waits[0]).toBe(2_000);
    expect(Math.max(...waits)).toBe(3_600_000);
    expect(hours).toBeGreaterThan(13);
    expect(hours).toBeLessThan(14);
    expect(EVENT_WEBHOOK_RETRY_HOURS).toBe(13);
    expect(
      EVENT_WEBHOOK_RETRY.nextAttemptAt(EVENT_WEBHOOK_RETRY.maxAttempts, NOW),
    ).toBeNull();
  });

  it('sends the event with its outbox record, and raises nothing', async () => {
    const { subscriber } = eventWebhookSink(webhook(), []);

    await expect(
      subscriber.handle(JOINED as unknown as DomainEvent, RECORD),
    ).resolves.toEqual([]);
    expect(received[0]?.headers['webhook-id']).toBe('event_1');
  });
});
