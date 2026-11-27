import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EventDelivery } from '@platform/events/event-delivery';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { AdminEventWebhookController } from '@platform/http/controllers/admin-event-webhook.controller';
import { subscribing } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const controller = (registered: boolean) => {
  const redeliver = vi.fn(() =>
    Promise.resolve({ queued: 3, truncated: false }),
  );
  const subscribers = new EventSubscribers();

  if (registered) {
    subscribers.registerSink({
      subscriber: subscribing('platform.send-event-webhook', [], () =>
        Promise.resolve([]),
      ),
      prefixes: [''],
      retry: null,
    });
  }

  const admin = new AdminEventWebhookController(
    subscribers,
    partial<EventDelivery>({
      redeliver,
    }),
  );

  return { admin, redeliver };
};

describe('AdminEventWebhookController', () => {
  it('queues the dead letters of the event webhook again since the time, and answers how many', async () => {
    const { admin, redeliver } = controller(true);

    await expect(
      admin.redeliver({ since: '2026-11-01T00:00:00Z' }),
    ).resolves.toEqual({ queued: 3, truncated: false });
    expect(redeliver).toHaveBeenCalledExactlyOnceWith(
      'platform.send-event-webhook',
      new Date('2026-11-01T00:00:00Z'),
      undefined,
    );
  });

  it('passes the limit of the body on', async () => {
    const { admin, redeliver } = controller(true);

    await admin.redeliver({ since: '2026-11-01T00:00:00Z', limit: 5 });

    expect(redeliver).toHaveBeenCalledExactlyOnceWith(
      'platform.send-event-webhook',
      new Date('2026-11-01T00:00:00Z'),
      5,
    );
  });

  it('refuses a body without since as an ISO 8601 time, or a limit out of range', async () => {
    const { admin, redeliver } = controller(true);

    await expect(admin.redeliver(undefined)).rejects.toThrow(
      BadRequestException,
    );
    await expect(admin.redeliver({ since: 'yesterday' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      admin.redeliver({ since: '2026-11-01T00:00:00Z', limit: 0 }),
    ).rejects.toThrow(BadRequestException);
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
