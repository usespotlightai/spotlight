import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { NotificationDto } from '@notifications/application/dto/notification.dto';
import type { NotificationStreamPort } from '@notifications/application/ports/notification-stream.port';
import type { WebPushPort } from '@notifications/application/ports/web-push.port';
import {
  ArrivalDeliveries,
  type ArrivedItem,
} from '@notifications/application/services/arrival-deliveries.service';
import { PushSubscription } from '@notifications/domain/aggregates/push-subscription.aggregate';
import type { PushSubscriptionRepository } from '@notifications/domain/repositories/push-subscription.repository';
import { PushEndpoint } from '@notifications/domain/value-objects/push-endpoint.vo';
import { PushKeys } from '@notifications/domain/value-objects/push-keys.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ITEM: ArrivedItem = {
  workspaceId: 'ws_1',
  personId: 'user_1',
  itemId: 'task_1:0',
  itemKind: 'task',
  title: 'Which database?',
  summary: 'Postgres or SQLite\nfor the cache?',
  askedAt: '2026-11-08T10:00:00.000Z',
};

const subscriptionAt = (endpoint: string) =>
  PushSubscription.create({
    endpoint: PushEndpoint.rehydrate(endpoint),
    person: UserId.of('user_1'),
    keys: PushKeys.of({ p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) }),
    at: new Date('2026-11-08T09:00:00.000Z'),
  });

const deliveriesWith = (input: {
  publicKey?: string | null;
  outcome?: 'delivered' | 'gone';
  subscriptions?: PushSubscription[];
}) => {
  const published: { personId: string; notification: NotificationDto }[] = [];
  const stream: NotificationStreamPort = {
    publish: (personId, notification) =>
      published.push({ personId, notification }),
  };
  const seenBy = (personId: string): NotificationDto[] =>
    published
      .filter((each) => each.personId === personId)
      .map((each) => each.notification);
  const send = vi.fn<WebPushPort['send']>(
    async () => input.outcome ?? 'delivered',
  );
  const remove = vi.fn(async () => undefined);
  const push: WebPushPort = {
    publicKey: input.publicKey === undefined ? 'key' : input.publicKey,
    send,
  };
  const subscriptions = {
    ofPerson: async () => input.subscriptions ?? [],
    remove,
  } as unknown as PushSubscriptionRepository;
  const workspaces = {
    slugOf: async () => 'acme',
  } as unknown as WorkspaceReaderPort;
  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as LoggerPort;

  return {
    deliveries: new ArrivalDeliveries(
      stream,
      push,
      subscriptions,
      workspaces,
      { pathTo: (slug, kind, id) => `/${slug}/${kind}/${id}` },
      logger,
    ),
    seenBy,
    send,
    remove,
  };
};

describe('ArrivalDeliveries', () => {
  it('streams the item to the person with a link to it in their inbox', async () => {
    const { deliveries, seenBy } = deliveriesWith({});

    await deliveries.streamed(ITEM);

    expect(seenBy('user_1')).toEqual([
      {
        id: 'task_1:0',
        kind: 'task',
        title: 'Which database?',
        body: 'Postgres or SQLite for the cache?',
        path: '/acme/task/task_1:0',
        at: '2026-11-08T10:00:00.000Z',
      },
    ]);
  });

  it('links a notice as a notice', async () => {
    const { deliveries, seenBy } = deliveriesWith({});

    await deliveries.streamed({ ...ITEM, itemKind: 'notice', itemId: 'ntc_1' });

    expect(seenBy('user_1')[0]?.path).toBe('/acme/notice/ntc_1');
  });

  it('pushes to each browser of the person', async () => {
    const { deliveries, send } = deliveriesWith({
      subscriptions: [
        subscriptionAt('https://fcm.googleapis.com/fcm/send/one'),
        subscriptionAt('https://web.push.apple.com/two'),
      ],
    });

    await deliveries.pushed(ITEM);

    expect(send.mock.calls.map(([target]) => target.endpoint)).toEqual([
      'https://fcm.googleapis.com/fcm/send/one',
      'https://web.push.apple.com/two',
    ]);
  });

  it('forgets a browser at a push service Spotlight no longer uses and pushes to the others', async () => {
    const retired = subscriptionAt('https://push.retired.example/one');
    const { deliveries, send, remove } = deliveriesWith({
      subscriptions: [
        retired,
        subscriptionAt('https://web.push.apple.com/two'),
      ],
    });

    await deliveries.pushed(ITEM);

    expect(send.mock.calls.map(([target]) => target.endpoint)).toEqual([
      'https://web.push.apple.com/two',
    ]);
    expect(remove).toHaveBeenCalledWith(retired);
  });

  it('forgets a browser whose push service says the subscription is gone', async () => {
    const gone = subscriptionAt('https://fcm.googleapis.com/fcm/send/one');
    const { deliveries, remove } = deliveriesWith({
      outcome: 'gone',
      subscriptions: [gone],
    });

    await deliveries.pushed(ITEM);

    expect(remove).toHaveBeenCalledWith(gone);
  });

  it('pushes to the other browsers when one push service fails, then fails to be tried again', async () => {
    const { deliveries, send } = deliveriesWith({
      subscriptions: [
        subscriptionAt('https://fcm.googleapis.com/fcm/send/one'),
        subscriptionAt('https://web.push.apple.com/two'),
      ],
    });
    send.mockRejectedValueOnce(new Error('The push service answered 503'));

    await expect(deliveries.pushed(ITEM)).rejects.toThrow(
      'Pushes to some browsers failed',
    );
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('pushes nothing when this Spotlight has no VAPID key', async () => {
    const { deliveries, send } = deliveriesWith({
      publicKey: null,
      subscriptions: [
        subscriptionAt('https://fcm.googleapis.com/fcm/send/one'),
      ],
    });

    await deliveries.pushed(ITEM);

    expect(send).not.toHaveBeenCalled();
  });
});
