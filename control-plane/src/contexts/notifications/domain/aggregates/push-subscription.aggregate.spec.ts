import { PushSubscription } from '@notifications/domain/aggregates/push-subscription.aggregate';
import { PushEndpoint } from '@notifications/domain/value-objects/push-endpoint.vo';
import { PushKeys } from '@notifications/domain/value-objects/push-keys.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const at = (minute: number) =>
  new Date(`2026-11-08T10:${String(minute).padStart(2, '0')}:00.000Z`);
const keys = (fill: string) =>
  PushKeys.of({ p256dh: fill.repeat(87), auth: fill.repeat(22) });

const subscription = PushSubscription.create({
  endpoint: PushEndpoint.of('https://fcm.googleapis.com/fcm/send/abc'),
  person: UserId.of('user_1'),
  keys: keys('a'),
  at: at(0),
});

describe('PushSubscription', () => {
  it('stays as it is when the same person sends the same keys again', () => {
    expect(subscription.renewedFor(UserId.of('user_1'), keys('a'), at(5))).toBe(
      subscription,
    );
  });

  it('takes the new keys of the same person', () => {
    const renewed = subscription.renewedFor(
      UserId.of('user_1'),
      keys('b'),
      at(5),
    );

    expect(renewed.keys.equals(keys('b'))).toBe(true);
    expect(renewed.createdAt).toEqual(at(0));
    expect(renewed.renewedAt).toEqual(at(5));
  });

  it('moves to another person who signs in on the same browser', () => {
    const moved = subscription.renewedFor(
      UserId.of('user_2'),
      keys('a'),
      at(5),
    );

    expect(moved.belongsTo(UserId.of('user_2'))).toBe(true);
    expect(moved.belongsTo(UserId.of('user_1'))).toBe(false);
    expect(moved.createdAt).toEqual(at(5));
  });
});
