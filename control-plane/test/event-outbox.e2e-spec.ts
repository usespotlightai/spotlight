import { randomUUID } from 'node:crypto';

import { DrizzleConfigurationAudit } from '@identity/infrastructure/persistence/drizzle/configuration-audit';
import { DrizzleOidcTrustUsage } from '@identity/infrastructure/persistence/drizzle/oidc-trust-usage';
import { configurationChange } from '@identity/infrastructure/persistence/drizzle/schemas/configuration-change.schema';
import { DrizzleSignupSurveys } from '@identity/infrastructure/persistence/drizzle/signup-surveys';
import { identityProjections } from '@identity/presentation/events/identity.projections';
import { CauseCarrier } from '@platform/events/cause-carrier';
import {
  EventDelivery,
  LEASE_MS,
  DEFAULT_RETRY,
} from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import { EventProjections } from '@platform/events/event-projections';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import {
  OUTBOX_RETENTION_MS,
  OutboxRetention,
} from '@platform/events/outbox-retention';
import { PayloadTypes } from '@platform/events/payload-types';
import { SHARED_KERNEL_PAYLOAD_TYPES } from '@platform/events/shared-kernel-payload-types';
import { ChangeNotices } from '@platform/live/change-notices';
import { InMemoryLiveFeed } from '@platform/live/in-memory-live-feed';
import { LiveNotices } from '@platform/live/live-notices';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import { OtelTelemetry } from '@platform/telemetry/otel-telemetry';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { subscribing } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import {
  actorFor,
  changeActorIn,
} from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { eq, inArray } from 'drizzle-orm';
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

class Called implements DomainEvent {
  readonly kind = 'bell.called';

  constructor(readonly marker: Marker) {}
}

let database: TestDatabase;
let context: DrizzleContext;
let now = new Date();
const received: string[] = [];
let failing = 0;
const causation = new CauseCarrier();
const causes: unknown[] = [];
let callOut: (
  event: Called,
) => Promise<readonly DomainEvent[]> = async () => [];

const logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const outboxWith = (
  more: (subscribers: EventSubscribers) => void = () => undefined,
) => {
  const types = new PayloadTypes();
  types.register('test', [Marker, Rang, Answered, Reconfigured, Called]);
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
        causes.push(causation.current());
      },
    ),
    subscribing<{ kind: string; marker: string }>(
      'test.receive-published',
      ['bell.published-rang.v1'],
      async (event) => {
        received.push(`published ${typeof event.marker} ${event.marker}`);
      },
    ),
    subscribing<Called>(
      'test.call-out',
      ['bell.called'],
      (event) => callOut(event),
      { callsOut: true },
    ),
    subscribing<Rang>('test.flaky', ['bell.rang'], async (event) => {
      if (failing > 0) {
        failing -= 1;
        throw new Error('not yet');
      }
      received.push(`flaky ${event.marker.value}`);
    }),
  ]);
  more(subscribers);
  const mappers = new IntegrationEventMappers();
  mappers.register([
    mapping<Rang>('bell.rang', (event) => ({
      kind: 'bell.published-rang.v1',
      marker: event.marker.value,
    })),
  ]);
  const projections = new EventProjections();
  projections.register(
    identityProjections(
      new DrizzleConfigurationAudit(context),
      new DrizzleOidcTrustUsage(context),
      new DrizzleSignupSurveys(context),
    ),
  );
  const clock = { now: () => now } as ClockPort;
  const outbox = new EventOutbox(
    context,
    subscribers,
    types,
    mappers,
    projections,
    new ChangeNotices(),
    new LiveNotices(
      new InMemoryLiveFeed(),
      {
        append: async (notices) =>
          notices.map((notice) => ({ ...notice, sequence: null })),
        logs: async () => new Map(),
        prune: async () => 0,
      },
      logger,
    ),
    { generate: () => randomUUID() },
    clock,
    causation,
    logger,
    new OtelTelemetry(),
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
    new OtelTelemetry(),
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
          changeActorIn('ws_audited', actorFor('user_audited')),
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

  it('carries the cause an event was recorded in to what its subscribers raise', async () => {
    causes.length = 0;
    const { outbox, delivery } = outboxWith();
    const cause = { links: [{ key: 'hook:bell' }], depth: 1 };

    await causation.runWith(cause, () =>
      outbox.record([new Rang(Marker.of('caused'))]),
    );
    await delivery.processDue();

    expect(causes).toEqual([cause]);
    expect(
      (
        await database.db.select({ cause: eventOutbox.cause }).from(eventOutbox)
      ).filter((each) => each.cause !== null),
    ).toEqual([{ cause }, { cause }, { cause }]);
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
    failing = DEFAULT_RETRY.maxAttempts + 5;
    const { outbox, delivery, reports } = outboxWith();

    await outbox.record([new Rang(Marker.of('three'))]);

    for (
      let attempt = 0;
      attempt < DEFAULT_RETRY.maxAttempts + 2;
      attempt += 1
    ) {
      await delivery.processDue();
      now = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    }

    const rows = await database.db
      .select()
      .from(eventDelivery)
      .where(eq(eventDelivery.subscriber, 'test.flaky'));
    const deadLettered = rows.filter((each) => each.deadLetteredAt !== null);

    expect(deadLettered).toHaveLength(1);
    expect(deadLettered[0]?.attempts).toBe(DEFAULT_RETRY.maxAttempts);
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

  describe('a subscriber that calls out', () => {
    const deliveryOf = async (eventId: string) => {
      const [row] = await database.db
        .select()
        .from(eventDelivery)
        .where(eq(eventDelivery.eventId, eventId));

      return row;
    };

    const calledIds = async () =>
      (
        await database.db
          .select({ id: eventOutbox.id })
          .from(eventOutbox)
          .where(eq(eventOutbox.kind, 'bell.called'))
      ).map((each) => each.id);

    const calledIn = async (marker: string) => {
      const { outbox, delivery } = outboxWith();
      const before = new Set(await calledIds());
      await outbox.record([new Called(Marker.of(marker))]);
      const eventId =
        (await calledIds()).find((each) => !before.has(each)) ?? '';

      return { delivery, eventId };
    };

    it('calls out with no transaction open, under a lease, and records what it raises once it settles', async () => {
      received.length = 0;
      const seen: { transacting: boolean; dueAt: Date | null }[] = [];
      const { delivery, eventId } = await calledIn('four');
      callOut = async (event) => {
        seen.push({
          transacting: context.transacting,
          dueAt: (await deliveryOf(eventId))?.dueAt ?? null,
        });

        return [new Answered(event.marker)];
      };

      await delivery.processDue();

      expect(seen).toEqual([
        {
          transacting: false,
          dueAt: new Date(now.getTime() + LEASE_MS),
        },
      ]);
      expect((await deliveryOf(eventId))?.deliveredAt).not.toBeNull();
      expect(received).toContain('answered four');
    });

    it('is taken over by another instance once its lease ended, and what the first raises late counts for nothing', async () => {
      received.length = 0;
      let calls = 0;
      const { delivery, eventId } = await calledIn('five');
      const other = outboxWith().delivery;
      callOut = async (event) => {
        calls += 1;

        if (calls === 1) {
          now = new Date(now.getTime() + LEASE_MS + 1_000);
          await other.processDue();
        }

        return [new Answered(Marker.of(`${event.marker.value} ${calls}`))];
      };

      await delivery.processDue();
      await other.processDue();

      expect(calls).toBe(2);
      expect((await deliveryOf(eventId))?.attempts).toBe(1);
      expect(
        received.filter((each) => each.startsWith('answered five')),
      ).toEqual(['answered five 2']);
    });

    it('does not settle a delivery whose lease another instance took over', async () => {
      received.length = 0;
      const { delivery, eventId } = await calledIn('six');
      callOut = async (event) => {
        await database.db
          .update(eventDelivery)
          .set({ dueAt: new Date(now.getTime() + 2 * LEASE_MS) })
          .where(eq(eventDelivery.eventId, eventId));

        return [new Answered(event.marker)];
      };

      await delivery.processDue();

      expect((await deliveryOf(eventId))?.deliveredAt).toBeNull();
      expect(received).not.toContain('answered six');
    });

    it('retries a failed call after its backoff, and only then delivers it', async () => {
      let failures = 1;
      const { delivery, eventId } = await calledIn('seven');
      callOut = async () => {
        if (failures > 0) {
          failures -= 1;
          throw new Error('the service did not answer');
        }

        return [];
      };

      await delivery.processDue();

      expect(await deliveryOf(eventId)).toMatchObject({
        attempts: 1,
        deliveredAt: null,
        lastError: 'the service did not answer',
      });

      now = new Date(now.getTime() + 60_000);
      await delivery.processDue();

      expect((await deliveryOf(eventId))?.deliveredAt).not.toBeNull();
    });
  });
});

describe('the rows the event outbox keeps', () => {
  const kindsRecorded = async (kinds: readonly string[]) =>
    (
      await database.db
        .select({ kind: eventOutbox.kind })
        .from(eventOutbox)
        .where(inArray(eventOutbox.kind, [...kinds]))
    ).map((each) => each.kind);

  it('keeps no row for an event nobody hears, but still projects it', async () => {
    const { outbox } = outboxWith();

    await outbox.record([
      new Reconfigured(
        ConfigurationChange.updated(
          { resource: 'team', id: 'team-unheard', key: 'unheard' },
          changeActorIn('ws_unheard', actorFor('user_unheard')),
        ),
      ),
    ]);

    expect(await kindsRecorded(['bell.reconfigured'])).toEqual([]);
    expect(
      await database.db
        .select({ key: configurationChange.key })
        .from(configurationChange)
        .where(eq(configurationChange.workspaceId, 'ws_unheard')),
    ).toEqual([{ key: 'unheard' }]);
  });

  it('keeps a row for an event that is heard or published', async () => {
    const { outbox } = outboxWith();
    const before = (
      await kindsRecorded(['bell.rang', 'bell.published-rang.v1'])
    ).length;

    await outbox.record([new Rang(Marker.of('kept'))]);

    expect(
      (await kindsRecorded(['bell.rang', 'bell.published-rang.v1'])).length,
    ).toBe(before + 2);
  });

  it('deletes delivered events after a week, and keeps pending ones and the dead letters that a registered subscriber still hears', async () => {
    const at = new Date('2026-11-01T00:00:00.000Z');
    const old = new Date(at.getTime() - OUTBOX_RETENTION_MS - 1);
    const recent = new Date(at.getTime() - OUTBOX_RETENTION_MS + 60_000);
    const event = async (
      recordedAt: Date,
      deliveries: {
        deliveredAt: Date | null;
        deadLetteredAt: Date | null;
        subscriber?: string;
      }[],
      subscriber = 'test.retained',
      kind = 'bell.retained',
    ) => {
      const id = randomUUID();
      await database.db.insert(eventOutbox).values({
        id,
        kind,
        payload: {},
        recordedAt,
      });
      for (const [index, each] of deliveries.entries()) {
        await database.db.insert(eventDelivery).values({
          eventId: id,
          subscriber: `${subscriber}-${index}`,
          dueAt: recordedAt,
          ...each,
        });
      }
      return id;
    };
    const delivered = { deliveredAt: old, deadLetteredAt: null };
    const pending = { deliveredAt: null, deadLetteredAt: null };
    const deadLettered = { deliveredAt: null, deadLetteredAt: old };

    const oldDelivered = await event(old, [delivered, delivered]);
    const oldPartly = await event(old, [delivered, pending]);
    const oldDead = await event(old, [deadLettered]);
    const oldDeadOfGone = await event(old, [deadLettered], 'test.gone');
    const deadOfGone = { ...deadLettered, subscriber: 'test.gone-0' };
    const oldDeadOfGoneAndPending = await event(old, [
      deadOfGone,
      { ...pending, subscriber: 'test.retained-1' },
    ]);
    const oldDeadOfGoneAndOfRegistered = await event(old, [
      deadOfGone,
      { ...deadLettered, subscriber: 'test.retained-0' },
    ]);
    const oldDeadOfUnheardKind = await event(
      old,
      [deadLettered],
      'test.retained',
      'bell.unheard',
    );
    const recentDelivered = await event(recent, [delivered]);
    const registered = new EventSubscribers();
    registered.register([
      subscribing('test.retained-0', ['bell.retained'], async () => []),
      subscribing('test.retained-1', ['bell.retained'], async () => []),
    ]);

    const deleted = await new OutboxRetention(
      context,
      { now: () => at } as ClockPort,
      registered,
    ).sweep();

    const left = (
      await database.db
        .select({ id: eventOutbox.id })
        .from(eventOutbox)
        .where(eq(eventOutbox.kind, 'bell.retained'))
    ).map((each) => each.id);

    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(left).not.toContain(oldDelivered);
    expect(left).not.toContain(oldDeadOfGone);
    expect(
      await database.db
        .select({ id: eventOutbox.id })
        .from(eventOutbox)
        .where(eq(eventOutbox.id, oldDeadOfUnheardKind)),
    ).toEqual([]);
    expect(left).toEqual(
      expect.arrayContaining([
        oldPartly,
        oldDead,
        oldDeadOfGoneAndPending,
        oldDeadOfGoneAndOfRegistered,
        recentDelivered,
      ]),
    );
    expect(
      await database.db
        .select({ subscriber: eventDelivery.subscriber })
        .from(eventDelivery)
        .where(eq(eventDelivery.eventId, oldDelivered)),
    ).toEqual([]);
  });

  it('queues again only the dead letters of the subscriber since the time, of the kinds it still hears', async () => {
    const since = new Date('2026-11-02T00:00:00.000Z');
    const queuedAt = new Date('2026-11-03T00:00:00.000Z');
    const row = async (
      kind: string,
      recordedAt: Date,
      subscriber: string,
      state: { deliveredAt: Date | null; deadLetteredAt: Date | null },
    ) => {
      const id = randomUUID();
      await database.db
        .insert(eventOutbox)
        .values({ id, kind, payload: {}, recordedAt });
      await database.db.insert(eventDelivery).values({
        eventId: id,
        subscriber,
        attempts: 8,
        dueAt: recordedAt,
        ...state,
      });
      return id;
    };
    const after = new Date(since.getTime() + 60_000);
    const dead = { deliveredAt: null, deadLetteredAt: after };
    const queued = await row('bell.kept', after, 'test.redeliver', dead);
    const untouched = [
      await row(
        'bell.kept',
        new Date(since.getTime() - 1),
        'test.redeliver',
        dead,
      ),
      await row('bell.dropped', after, 'test.redeliver', dead),
      await row('bell.kept', after, 'test.other', dead),
      await row('bell.kept', after, 'test.redeliver', {
        deliveredAt: after,
        deadLetteredAt: null,
      }),
      await row('bell.kept', after, 'test.redeliver', {
        deliveredAt: null,
        deadLetteredAt: null,
      }),
    ];
    const registered = new EventSubscribers();
    registered.register([
      subscribing('test.redeliver', ['bell.kept'], async () => []),
      subscribing('test.other', ['bell.kept'], async () => []),
    ]);
    const { outbox } = outboxWith();
    const redelivery = new EventDelivery(
      context,
      outbox,
      registered,
      { now: () => queuedAt } as ClockPort,
      logger,
      causation,
      { report: vi.fn() },
      new OtelTelemetry(),
    );
    const stateOf = async (eventId: string) =>
      (
        await database.db
          .select({
            attempts: eventDelivery.attempts,
            dueAt: eventDelivery.dueAt,
            deadLetteredAt: eventDelivery.deadLetteredAt,
            deliveredAt: eventDelivery.deliveredAt,
          })
          .from(eventDelivery)
          .where(eq(eventDelivery.eventId, eventId))
      )[0];
    const before = await Promise.all(untouched.map(stateOf));

    expect(await redelivery.redeliver('test.redeliver', since)).toBe(1);
    expect(await stateOf(queued)).toEqual({
      attempts: 0,
      dueAt: queuedAt,
      deadLetteredAt: null,
      deliveredAt: null,
    });
    expect(await Promise.all(untouched.map(stateOf))).toEqual(before);
  });

  const deliveryRow = async (
    id: string,
    kind: string,
    recordedAt: Date,
    subscriber: string,
  ) => {
    await database.db
      .insert(eventOutbox)
      .values({ id, kind, payload: {}, recordedAt });
    await database.db.insert(eventDelivery).values({
      eventId: id,
      subscriber,
      attempts: 8,
      dueAt: recordedAt,
      deliveredAt: null,
      deadLetteredAt: recordedAt,
    });
  };

  const keptIds = async (ids: readonly string[]) =>
    (
      await database.db
        .select({ id: eventOutbox.id })
        .from(eventOutbox)
        .where(inArray(eventOutbox.id, [...ids]))
    )
      .map((each) => each.id)
      .sort();

  it('keeps an event that another instance queues again between the read and the delete of a sweep', async () => {
    const at = new Date('2001-01-10T00:00:00.000Z');
    const old = new Date('2001-01-01T00:00:00.000Z');
    const id = randomUUID();
    await deliveryRow(id, 'bell.raced', old, 'test.raced');
    const elsewhere = new EventSubscribers();
    elsewhere.register([
      subscribing('test.raced', ['bell.raced'], async () => []),
    ]);
    const { outbox } = outboxWith();
    const redelivery = new EventDelivery(
      context,
      outbox,
      elsewhere,
      { now: () => at } as ClockPort,
      logger,
      causation,
      { report: vi.fn() },
      new OtelTelemetry(),
    );
    let deletes = 0;
    // The second delete of the sweep is the delete of the dead letters that nobody hears. The other instance queues the dead letter again just before it.
    const db = context.db;
    const racingDb = new Proxy(db, {
      get: (inner, member): unknown =>
        member === 'delete'
          ? (table: typeof eventOutbox) => ({
              where: (
                condition: Parameters<ReturnType<typeof db.delete>['where']>[0],
              ) => ({
                returning: async (columns: { id: typeof eventOutbox.id }) => {
                  deletes += 1;

                  if (deletes === 2) {
                    await redelivery.redeliver('test.raced', old);
                  }

                  return inner
                    .delete(table)
                    .where(condition)
                    .returning(columns);
                },
              }),
            })
          : (Reflect.get(inner, member) as unknown),
    });
    const racing = { db: racingDb } as unknown as DrizzleContext;

    await new OutboxRetention(
      racing,
      { now: () => at } as ClockPort,
      new EventSubscribers(),
    ).sweep();

    expect(deletes).toBe(2);
    expect(await keptIds([id])).toEqual([id]);
    expect(
      await database.db
        .select({
          attempts: eventDelivery.attempts,
          deadLetteredAt: eventDelivery.deadLetteredAt,
        })
        .from(eventDelivery)
        .where(eq(eventDelivery.eventId, id)),
    ).toEqual([{ attempts: 0, deadLetteredAt: null }]);

    await database.db.delete(eventOutbox).where(eq(eventOutbox.id, id));
  });

  it('goes on after the dead letters it keeps in the next sweep, and starts again once it reached the end', async () => {
    const at = new Date('1990-01-10T00:00:00.000Z');
    const old = new Date('1990-01-01T00:00:00.000Z');
    const idOf = (n: number) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const [u0, h1, h2, u1, u2] = [0, 1, 2, 3, 4].map(idOf);
    await deliveryRow(h1, 'bell.cursor', old, 'test.cursor');
    await deliveryRow(h2, 'bell.cursor', old, 'test.cursor');
    await deliveryRow(u1, 'bell.cursor', old, 'test.cursor-gone');
    await deliveryRow(u2, 'bell.cursor', old, 'test.cursor-gone');
    const registered = new EventSubscribers();
    registered.register([
      subscribing('test.cursor', ['bell.cursor'], async () => []),
    ]);
    const retention = new OutboxRetention(
      context,
      { now: () => at } as ClockPort,
      registered,
      { batch: 2, batches: 1 },
    );
    const all = [u0, h1, h2, u1, u2];

    expect(await retention.sweep()).toBe(0);
    expect(await keptIds(all)).toEqual([h1, h2, u1, u2]);
    expect(await retention.sweep()).toBe(2);
    expect(await keptIds(all)).toEqual([h1, h2]);

    await deliveryRow(u0, 'bell.cursor', old, 'test.cursor-gone');

    expect(await retention.sweep()).toBe(0);
    expect(await retention.sweep()).toBe(1);
    expect(await keptIds(all)).toEqual([h1, h2]);

    await database.db.delete(eventOutbox).where(inArray(eventOutbox.id, all));
  });
});

describe('the lanes of event delivery', () => {
  it('delivers to the other subscribers while a sink waits for a slow receiver', async () => {
    let release = () => undefined as void;
    const holding = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sunk: string[] = [];
    const { outbox, delivery } = outboxWith((subscribers) =>
      subscribers.registerSink(
        subscribing<{ kind: string; marker: string }>(
          'test.sink',
          [],
          async (event) => {
            await holding;
            sunk.push(event.marker);
          },
          { callsOut: true },
        ),
        { prefixes: ['bell.'] },
      ),
    );

    await outbox.record([new Rang(Marker.of('lane'))]);

    const sinking = delivery.processDue(100, 'sinks');

    await delivery.processDue();

    expect(received).toContain('rang lane');
    expect(sunk).toEqual([]);

    release();
    await sinking;

    expect(sunk).toEqual(['lane']);
  });
});
