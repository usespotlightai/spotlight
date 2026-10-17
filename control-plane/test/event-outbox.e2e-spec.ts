import { randomUUID } from 'node:crypto';
import { DrizzleConfigurationAudit } from '@identity/infrastructure/persistence/drizzle/configuration-audit';
import { configurationChange } from '@identity/infrastructure/persistence/drizzle/schemas/configuration-change.schema';
import { identityProjections } from '@identity/presentation/events/identity.projections';
import { AmbientCausation } from '@platform/events/ambient-causation';
import { DeliveryBacklog } from '@platform/events/delivery-backlog';
import { EventDelivery, MAX_ATTEMPTS } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import { EventProjections } from '@platform/events/event-projections';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { subscribing } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { SHARED_KERNEL_PAYLOAD_TYPES } from '@shared-kernel/domain/payload-types';
import {
  actorFor,
  attributedIn,
} from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

class Marker {
  private constructor(readonly value: string) {}

  static of(value: string): Marker {
    return new Marker(value);
  }
}

class Rang implements DomainEvent {
  readonly kind = 'bell.rang';
  readonly workspaceId = Marker.of('workspace-1');

  constructor(readonly marker: Marker) {}
}

class Reconfigured implements ConfigurationChanged {
  readonly kind = 'bell.reconfigured';

  constructor(readonly change: ConfigurationChange) {}
}

class Answered implements DomainEvent {
  readonly kind = 'bell.answered';

  constructor(readonly marker: Marker) {}
}

let database: TestDatabase;
let context: DrizzleContext;
let now = new Date();
const received: string[] = [];
let failing = 0;
const causation = new AmbientCausation();
const causes: string[] = [];

const logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const outboxWith = () => {
  const types = new PayloadTypes();
  types.register('test', [Marker, Rang, Answered, Reconfigured]);
  types.register('shared-kernel', SHARED_KERNEL_PAYLOAD_TYPES);
  const subscribers = new EventSubscribers();
  subscribers.register([
    subscribing<Rang>('test.answer', ['bell.rang'], async (event) => {
      received.push(`rang ${event.marker.value}`);
      return [new Answered(event.marker)];
    }),
    subscribing<Answered>(
      'test.receive-answer',
      ['bell.answered'],
      async (event) => {
        received.push(`answered ${event.marker.value}`);
        causes.push(causation.current().description);
      },
    ),
    subscribing<{ kind: string; marker: string }>(
      'test.receive-published',
      ['bell.published-rang.v1'],
      async (event) => {
        received.push(`published ${typeof event.marker} ${event.marker}`);
      },
    ),
    subscribing<{ kind: string; marker: string }>(
      'test.fail-published',
      ['bell.published-rang.v1'],
      async (event) => {
        if (event.marker === 'failing') {
          throw new Error('failed');
        }
      },
    ),
    subscribing<Rang>('test.flaky', ['bell.rang'], async (event) => {
      if (failing > 0) {
        failing -= 1;
        throw new Error('not yet');
      }
      received.push(`flaky ${event.marker.value}`);
    }),
  ]);
  const mappers = new IntegrationEventMappers();
  mappers.register([
    mapping<Rang>('bell.rang', (event) => ({
      kind: 'bell.published-rang.v1',
      marker: event.marker.value,
    })),
  ]);
  const projections = new EventProjections();
  projections.register(
    identityProjections(new DrizzleConfigurationAudit(context)),
  );
  const clock = { now: () => now } as ClockPort;
  const outbox = new EventOutbox(
    context,
    subscribers,
    types,
    mappers,
    projections,
    { generate: () => randomUUID() },
    clock,
    causation,
  );
  const reports = { report: vi.fn() };
  const delivery = new EventDelivery(
    context,
    outbox,
    subscribers,
    clock,
    logger,
    causation,
    reports,
  );

  return { outbox, delivery, reports };
};

beforeAll(async () => {
  database = await openDatabase('event_outbox');
  context = new DrizzleContext(database.db);
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('the event outbox', () => {
  it('records nothing that a transaction rolled back', async () => {
    const { outbox, delivery } = outboxWith();

    await context
      .inTransaction(async () => {
        await outbox.record([new Rang(Marker.of('lost'))]);
        throw new Error('the command failed');
      })
      .catch(() => undefined);
    await delivery.processDue();

    expect(received).toEqual([]);
  });

  it('records who changed configuration in the same transaction as the change, and never apart from it', async () => {
    const { outbox } = outboxWith();
    const changedBy = (key: string) =>
      new Reconfigured(
        ConfigurationChange.updated(
          { resource: 'team', id: `team-${key}`, key },
          attributedIn('ws_audited', actorFor('user_audited')),
        ),
      );

    await context
      .inTransaction(async () => {
        await outbox.record([changedBy('lost')]);
        throw new Error('the command failed');
      })
      .catch(() => undefined);
    await outbox.record([changedBy('recorded')]);

    expect(
      await database.db
        .select({
          key: configurationChange.key,
          actor: configurationChange.actor,
          userId: configurationChange.userId,
          client: configurationChange.client,
        })
        .from(configurationChange)
        .where(eq(configurationChange.workspaceId, 'ws_audited')),
    ).toEqual([
      {
        key: 'recorded',
        actor: 'person',
        userId: 'user_audited',
        client: 'web',
      },
    ]);
  });

  it('delivers what was recorded to every subscriber, and what they raise in turn', async () => {
    const { outbox, delivery } = outboxWith();

    await outbox.record([new Rang(Marker.of('one'))]);
    await delivery.processDue();

    expect(received).toEqual(
      expect.arrayContaining(['rang one', 'answered one', 'flaky one']),
    );
    expect(received).toHaveLength(4);
  });

  it('carries the chain of causes an event was recorded in to what its subscribers raise', async () => {
    causes.length = 0;
    const { outbox, delivery } = outboxWith();
    const chain = CausalChain.none().followedBy({
      kind: 'hook',
      key: 'hook:bell',
      description: 'the hook bell',
    });

    await causation.within(chain, () =>
      outbox.record([new Rang(Marker.of('caused'))]),
    );
    await delivery.processDue();

    expect(causes).toEqual(['the hook bell']);
    expect(
      (await database.db.select({ cause: eventOutbox.cause }).from(eventOutbox))
        .map((each) => CausalChain.read(each.cause).description)
        .filter((each) => each !== ''),
    ).toEqual(['the hook bell', 'the hook bell', 'the hook bell']);
  });

  it('publishes what other contexts may receive as plain data, beside the domain event', async () => {
    received.length = 0;
    const { outbox, delivery } = outboxWith();

    await outbox.record([new Rang(Marker.of('plain'))]);
    await delivery.processDue();

    expect(received).toContain('published string plain');
  });

  it('retries a failing subscriber later, without troubling the others', async () => {
    received.length = 0;
    failing = 1;
    const { outbox, delivery } = outboxWith();

    await outbox.record([new Rang(Marker.of('two'))]);
    await delivery.processDue();

    expect(received).not.toContain('flaky two');
    expect(received).toContain('rang two');

    now = new Date(now.getTime() + 60_000);
    await delivery.processDue();

    expect(received).toContain('flaky two');
  });

  it('dead-letters the delivery to a subscriber that keeps failing, and reports only the last failure', async () => {
    failing = MAX_ATTEMPTS + 5;
    const { outbox, delivery, reports } = outboxWith();

    await outbox.record([new Rang(Marker.of('three'))]);

    for (let attempt = 0; attempt < MAX_ATTEMPTS + 2; attempt += 1) {
      await delivery.processDue();
      now = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    }

    const rows = await database.db
      .select()
      .from(eventDelivery)
      .where(eq(eventDelivery.subscriber, 'test.flaky'));
    const deadLettered = rows.filter((each) => each.deadLetteredAt !== null);

    expect(deadLettered).toHaveLength(1);
    expect(deadLettered[0]?.attempts).toBe(MAX_ATTEMPTS);
    expect(deadLettered[0]?.lastError).toBe('not yet');
    expect(reports.report).toHaveBeenCalledExactlyOnceWith(
      new Error('not yet'),
      expect.objectContaining({
        source: 'test.flaky',
        workspaceId: 'workspace-1',
      }),
    );
    failing = 0;
  });

  it('counts the pending deliveries of a subscriber for the events about one thing', async () => {
    const { outbox, delivery } = outboxWith();
    const pending = (marker: string) =>
      new DeliveryBacklog(context).pendingDeliveriesFor(
        'test.receive-published',
        {
          marker,
        },
      );

    await outbox.record([new Rang(Marker.of('tracked'))]);

    await expect(pending('tracked')).resolves.toEqual({
      pending: 1,
      deadLettered: 0,
    });
    await expect(pending('never-rang')).resolves.toEqual({
      pending: 0,
      deadLettered: 0,
    });

    await delivery.processDue();

    await expect(pending('tracked')).resolves.toEqual({
      pending: 0,
      deadLettered: 0,
    });
  });

  it('matches every field it is given', async () => {
    const { outbox } = outboxWith();
    const pending = (kind: string) =>
      new DeliveryBacklog(context).pendingDeliveriesFor(
        'test.receive-published',
        {
          marker: 'two-fields',
          kind,
        },
      );

    await outbox.record([new Rang(Marker.of('two-fields'))]);

    await expect(pending('bell.published-rang.v1')).resolves.toEqual({
      pending: 1,
      deadLettered: 0,
    });
    await expect(pending('bell.other')).resolves.toEqual({
      pending: 0,
      deadLettered: 0,
    });
  });

  it('finds the events about one thing by an id held in a value object', async () => {
    const { outbox } = outboxWith();

    await outbox.record([new Rang(Marker.of('nested'))]);

    await expect(
      new DeliveryBacklog(context).pendingDeliveriesFor('test.answer', {
        marker: 'nested',
      }),
    ).resolves.toEqual({ pending: 1, deadLettered: 0 });
  });

  it('counts what a subscriber dead-lettered, and not what it still retries', async () => {
    const { outbox, delivery } = outboxWith();
    const pending = () =>
      new DeliveryBacklog(context).pendingDeliveriesFor('test.fail-published', {
        marker: 'failing',
      });

    await outbox.record([new Rang(Marker.of('failing'))]);
    await delivery.processDue();

    await expect(pending()).resolves.toEqual({ pending: 1, deadLettered: 0 });

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      now = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      await delivery.processDue();
    }

    await expect(pending()).resolves.toEqual({ pending: 1, deadLettered: 1 });
  });
});
