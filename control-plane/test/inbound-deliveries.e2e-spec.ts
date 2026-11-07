import { randomUUID } from 'node:crypto';
import { InboundDelivery } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import { InboundDeliveryVersionConflictError } from '@integrations/domain/exceptions/inbound-delivery-version-conflict.error';
import {
  INBOUND_DELIVERIES,
  type InboundDeliveryRepository,
} from '@integrations/domain/repositories/inbound-delivery.repository';
import { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp } from './support/app';
import * as schema from './support/schema';

describe('inbound deliveries, stored in the database (e2e)', () => {
  let app: INestApplication;
  let deliveries: InboundDeliveryRepository;
  let db: DrizzleDatabase;

  const NOW = new Date('2126-09-26T10:00:00.000Z');

  const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

  const received = (id: string): InboundDelivery =>
    InboundDelivery.receive(
      {
        integration: IntegrationKey.of('github'),
        to: null,
        id,
        headers: { 'x-github-delivery': id },
        body: { action: 'closed' },
        causeFiringId: 'firing_1',
      },
      NOW,
    );

  const claimed = async (now: Date = NOW): Promise<InboundDelivery> => {
    const next = await deliveries.claimNext(now);

    if (!next) {
      throw new Error('nothing was due');
    }

    return next;
  };

  const rowOf = async (id: string) => {
    const [row] = await db
      .select()
      .from(schema.inboundDelivery)
      .where(eq(schema.inboundDelivery.id, id));

    return row;
  };

  beforeAll(async () => {
    app = await openApp();
    deliveries = app.get<InboundDeliveryRepository>(INBOUND_DELIVERIES);
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  it('takes in each delivery once', async () => {
    const id = randomUUID();

    await expect(deliveries.add(received(id))).resolves.toBe(true);
    await expect(deliveries.add(received(id))).resolves.toBe(false);

    const first = await claimed();

    expect(first.id).toBe(id);
    expect(first.causeFiringId).toBe('firing_1');
    expect(first.headers).toEqual({ 'x-github-delivery': id });

    await deliveries.save(first.worked(NOW));
  });

  it('lets only the worker with the lease on a delivery finish it', async () => {
    const id = randomUUID();

    await deliveries.add(received(id));
    const first = await claimed();
    const later = at(11 * 60);
    const second = await claimed(later);

    expect(second.id).toBe(first.id);

    await expect(deliveries.save(first.worked(later))).rejects.toBeInstanceOf(
      InboundDeliveryVersionConflictError,
    );
    await expect(
      deliveries.save(
        first.failedWith(DeliveryFailure.transient('nope'), later),
      ),
    ).rejects.toBeInstanceOf(InboundDeliveryVersionConflictError);
    await expect(rowOf(id)).resolves.toMatchObject({
      state: 'working',
      attempts: 0,
    });

    await deliveries.save(second.worked(later));

    await expect(rowOf(id)).resolves.toMatchObject({
      state: 'done',
      attempts: 1,
      handledAt: later,
    });
  });

  it('puts a failed delivery back to wait, and claims it once it is due', async () => {
    const id = randomUUID();

    await deliveries.add(received(id));
    await deliveries.save(
      (await claimed()).failedWith(DeliveryFailure.transient('nope'), NOW),
    );

    await expect(rowOf(id)).resolves.toMatchObject({
      state: 'pending',
      attempts: 1,
      failed: 'nope',
      dueAt: at(2),
    });
    await expect(deliveries.claimNext(at(1))).resolves.toBeNull();
    await expect(claimed(at(2))).resolves.toMatchObject({ id, attempts: 1 });
  });
});
