import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EventDelivery } from '@platform/events/event-delivery';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { AdminEventWebhookController } from '@platform/http/controllers/admin-event-webhook.controller';
import { subscribing } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { describe, expect, it, vi } from 'vitest';

const controller = (registered: boolean) => {
  const redeliver = vi.fn(async () => 3);
  const subscribers = new EventSubscribers();

  if (registered) {
    subscribers.registerByPrefix(
      subscribing('platform.send-event-webhook', [], async () => []),
      [''],
    );
  }

  const admin = new AdminEventWebhookController(subscribers, {
    redeliver,
  } as unknown as EventDelivery);

  return { admin, redeliver };
};

describe('AdminEventWebhookController', () => {
  it('queues the dead letters of the event webhook again since the time, and answers how many', async () => {
    const { admin, redeliver } = controller(true);

    await expect(
      admin.redeliver({ since: '2026-11-01T00:00:00Z' }),
    ).resolves.toEqual({ count: 3 });
    expect(redeliver).toHaveBeenCalledExactlyOnceWith(
      'platform.send-event-webhook',
      new Date('2026-11-01T00:00:00Z'),
    );
  });

  it('refuses a body without since as an ISO 8601 time', async () => {
    const { admin, redeliver } = controller(true);

    await expect(admin.redeliver(undefined)).rejects.toThrow(
      BadRequestException,
    );
    await expect(admin.redeliver({ since: 'yesterday' })).rejects.toThrow(
      BadRequestException,
    );
    expect(redeliver).not.toHaveBeenCalled();
  });

  it('answers 409 when the deployment registers no event webhook', async () => {
    const { admin, redeliver } = controller(false);

    await expect(
      admin.redeliver({ since: '2026-11-01T00:00:00Z' }),
    ).rejects.toThrow(ConflictException);
    expect(redeliver).not.toHaveBeenCalled();
  });
});
