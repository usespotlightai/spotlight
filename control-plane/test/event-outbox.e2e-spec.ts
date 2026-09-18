import { randomUUID } from 'node:crypto';
import { EventDelivery, MOST_ATTEMPTS } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { eventDelivery } from '@platform/persistence/drizzle/schemas/event.schema';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { subscribing } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

class Marker {
  private constructor(readonly value: string) {}

  static of(value: string): Marker {
    return new Marker(value);
  }
}

class Rang implements DomainEvent {
  readonly kind = 'bell.rang';

  constructor(readonly marker: Marker) {}
}

class Answered implements DomainEvent {
  readonly kind = 'bell.answered';

  constructor(readonly marker: Marker) {}
}

let held: TestDatabase;
let context: DrizzleContext;
let now = new Date(Date.now() + 60_000);
const heard: string[] = [];
let failing = 0;

const logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const outboxWith = () => {
  const types = new EventTypes();
  types.register('test', [Marker, Rang, Answered]);
  const subscribers = new EventSubscribers();
  subscribers.register([
    subscribing<Rang>('test.answer', ['bell.rang'], async (event) => {
      heard.push(`rang ${event.marker.value}`);
      return [new Answered(event.marker)];
    }),
    subscribing<Answered>(
      'test.hear-answer',
      ['bell.answered'],
      async (event) => {
        heard.push(`answered ${event.marker.value}`);
      },
    ),
    subscribing<{ kind: string; marker: string }>(
      'test.hear-published',
      ['bell.published-rang.v1'],
      async (event) => {
        heard.push(`published ${typeof event.marker} ${event.marker}`);
      },
    ),
    subscribing<Rang>('test.flaky', ['bell.rang'], async (event) => {
      if (failing > 0) {
        failing -= 1;
        throw new Error('not yet');
      }
      heard.push(`flaky ${event.marker.value}`);
    }),
  ]);
  const publications = new EventPublications();
  publications.register([
    publishing<Rang>('bell.rang', (event) => ({
      kind: 'bell.published-rang.v1',
      marker: event.marker.value,
    })),
  ]);
  const outbox = new EventOutbox(context, subscribers, types, publications, {
    generate: () => randomUUID(),
  });
  const delivery = new EventDelivery(
    context,
    outbox,
    subscribers,
    { now: () => now } as ClockPort,
    logger,
  );

  return { outbox, delivery };
};

beforeAll(async () => {
  held = await openDatabase('event_outbox');
  context = new DrizzleContext(held.db);
}, 60_000);

afterAll(async () => {
  await held?.close();
});

describe('the event outbox', () => {
  it('records nothing that a transaction rolled back', async () => {
    const { outbox, delivery } = outboxWith();

    await context
      .run(async () => {
        await outbox.record([new Rang(Marker.of('lost'))]);
        throw new Error('the command failed');
      })
      .catch(() => undefined);
    await delivery.workOff();

    expect(heard).toEqual([]);
  });

  it('delivers what was recorded to every subscriber, and what they raise in turn', async () => {
    const { outbox, delivery } = outboxWith();

    await outbox.record([new Rang(Marker.of('one'))]);
    await delivery.workOff();

    expect(heard).toEqual(
      expect.arrayContaining(['rang one', 'answered one', 'flaky one']),
    );
    expect(heard).toHaveLength(4);
  });

  it('publishes what other contexts may hear as plain data, beside the domain event', async () => {
    heard.length = 0;
    const { outbox, delivery } = outboxWith();

    await outbox.record([new Rang(Marker.of('plain'))]);
    await delivery.workOff();

    expect(heard).toContain('published string plain');
  });

  it('tries a failing subscriber again later, without troubling the others', async () => {
    heard.length = 0;
    failing = 1;
    const { outbox, delivery } = outboxWith();

    await outbox.record([new Rang(Marker.of('two'))]);
    await delivery.workOff();

    expect(heard).not.toContain('flaky two');
    expect(heard).toContain('rang two');

    now = new Date(now.getTime() + 60_000);
    await delivery.workOff();

    expect(heard).toContain('flaky two');
  });

  it('gives up on a subscriber that keeps failing', async () => {
    failing = MOST_ATTEMPTS + 5;
    const { outbox, delivery } = outboxWith();

    await outbox.record([new Rang(Marker.of('three'))]);

    for (let attempt = 0; attempt < MOST_ATTEMPTS + 2; attempt += 1) {
      await delivery.workOff();
      now = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    }

    const rows = await held.db.select().from(eventDelivery);
    const given = rows.filter((each) => each.failedAt !== null);

    expect(given).toHaveLength(1);
    expect(given[0]?.attempts).toBe(MOST_ATTEMPTS);
    expect(given[0]?.lastError).toBe('not yet');
    failing = 0;
  });
});
