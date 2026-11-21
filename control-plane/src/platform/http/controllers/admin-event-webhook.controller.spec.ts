import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Env } from '@platform/config/env.schema';
import type { EventDelivery } from '@platform/events/event-delivery';
import { AdminEventWebhookController } from '@platform/http/controllers/admin-event-webhook.controller';
import { describe, expect, it, vi } from 'vitest';

const controller = (url: string | undefined) => {
  const redeliver = vi.fn(async () => 3);
  const admin = new AdminEventWebhookController(
    { SPOTLIGHT_EVENTS_URL: url } as Env,
    { redeliver } as unknown as EventDelivery,
  );

  return { admin, redeliver };
};

describe('AdminEventWebhookController', () => {
  it('queues the dead letters of the event webhook again since the time, and answers how many', async () => {
    const { admin, redeliver } = controller('https://events.example.com');

    await expect(
      admin.redeliver({ since: '2026-11-01T00:00:00Z' }),
    ).resolves.toEqual({ count: 3 });
    expect(redeliver).toHaveBeenCalledExactlyOnceWith(
      'platform.send-event-webhook',
      new Date('2026-11-01T00:00:00Z'),
    );
  });

  it('refuses a body without since as an ISO 8601 time', async () => {
    const { admin, redeliver } = controller('https://events.example.com');

    await expect(admin.redeliver(undefined)).rejects.toThrow(
      BadRequestException,
    );
    await expect(admin.redeliver({ since: 'yesterday' })).rejects.toThrow(
      BadRequestException,
    );
    expect(redeliver).not.toHaveBeenCalled();
  });

  it('answers 404 when the deployment sends no events', async () => {
    const { admin, redeliver } = controller(undefined);

    await expect(
      admin.redeliver({ since: '2026-11-01T00:00:00Z' }),
    ).rejects.toThrow(NotFoundException);
    expect(redeliver).not.toHaveBeenCalled();
  });
});
