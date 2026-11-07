import { InboundDelivery } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import { InvalidInboundDeliveryTransitionError } from '@integrations/domain/exceptions/invalid-inbound-delivery-transition.error';
import { MAX_DELIVERY_ATTEMPTS } from '@integrations/domain/services/delivery-retry';
import { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');

const later = (ms: number) => new Date(NOW.getTime() + ms);

const received = () =>
  InboundDelivery.receive(
    {
      integration: IntegrationKey.of('github'),
      to: null,
      id: 'd_1',
      headers: { 'x-delivery': 'd_1' },
      body: { action: 'closed' },
      causeFiringId: '  ',
    },
    NOW,
  );

const stored = (
  delivery: InboundDelivery,
  over: { attempts?: number; version?: number } = {},
) =>
  InboundDelivery.rehydrate({
    integration: delivery.integration,
    to: delivery.to,
    id: delivery.id,
    headers: delivery.headers,
    body: delivery.body,
    causeFiringId: delivery.causeFiringId,
    receivedAt: delivery.receivedAt,
    progress: delivery.progress,
    attempts: over.attempts ?? delivery.attempts,
    failure: delivery.failure,
    version: over.version ?? 1,
  });

describe('InboundDelivery', () => {
  it('waits to be read from the moment it is received', () => {
    const delivery = received();

    expect(delivery.progress).toEqual({ kind: 'pending', dueAt: NOW });
    expect(delivery.isNew).toBe(true);
    expect(delivery.causeFiringId).toBeNull();
  });

  it('refuses a delivery without an id', () => {
    expect(() =>
      InboundDelivery.receive(
        {
          integration: IntegrationKey.of('github'),
          to: null,
          id: ' ',
          headers: {},
          body: {},
          causeFiringId: null,
        },
        NOW,
      ),
    ).toThrow(InconsistentStateError);
  });

  it('is claimed once it is due', () => {
    expect(stored(received()).claimed(NOW).progress).toEqual({
      kind: 'working',
      claimedAt: NOW,
    });
  });

  it('is not claimed again while its lease holds', () => {
    const working = stored(stored(received()).claimed(NOW));

    expect(() => working.claimed(later(60_000))).toThrow(
      InvalidInboundDeliveryTransitionError,
    );
    expect(working.claimed(later(11 * 60_000)).progress).toEqual({
      kind: 'working',
      claimedAt: later(11 * 60_000),
    });
  });

  it('counts an attempt when it is read', () => {
    const done = stored(received()).claimed(NOW).worked(later(1_000));

    expect(done.progress).toEqual({ kind: 'done', at: later(1_000) });
    expect(done.attempts).toBe(1);
  });

  it('waits longer each time it fails, and says why', () => {
    const failed = stored(received(), { attempts: 3 })
      .claimed(NOW)
      .failedWith(DeliveryFailure.transient('nope'), NOW);

    expect(failed.progress).toEqual({ kind: 'pending', dueAt: later(16_000) });
    expect(failed.attempts).toBe(4);
    expect(failed.failure).toBe('nope');
    expect(failed.gaveUp).toBe(false);
  });

  it('gives up once it has had its attempts', () => {
    const failed = stored(received(), { attempts: MAX_DELIVERY_ATTEMPTS - 1 })
      .claimed(NOW)
      .failedWith(DeliveryFailure.transient('still nope'), NOW);

    expect(failed.progress).toEqual({ kind: 'failed', at: NOW });
    expect(failed.gaveUp).toBe(true);
  });

  it('gives up at once on a failure no retry would mend', () => {
    const failed = stored(received())
      .claimed(NOW)
      .failedWith(DeliveryFailure.permanent('never'), NOW);

    expect(failed.progress).toEqual({ kind: 'failed', at: NOW });
    expect(failed.failure).toBe('never');
    expect(failed.gaveUp).toBe(true);
  });

  it('cannot be finished by a worker that does not hold it', () => {
    expect(() => stored(received()).worked(NOW)).toThrow(
      InvalidInboundDeliveryTransitionError,
    );
    expect(() =>
      stored(received()).failedWith(DeliveryFailure.transient('nope'), NOW),
    ).toThrow(InvalidInboundDeliveryTransitionError);
  });

  it('refuses stored state that cannot happen', () => {
    expect(() => stored(received(), { version: 0 })).toThrow(
      InconsistentStateError,
    );
    expect(() => stored(received(), { attempts: -1 })).toThrow(
      InconsistentStateError,
    );
  });
});
