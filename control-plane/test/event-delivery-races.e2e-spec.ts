import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';

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
import { ChangeNotices } from '@platform/live/change-notices';
import { InMemoryLiveFeed } from '@platform/live/in-memory-live-feed';
import { LiveNotices } from '@platform/live/live-notices';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { type DomainEventSubscriber } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { and, eq, isNull } from 'drizzle-orm';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

const START = new Date('2026-11-01T09:00:00.000Z').getTime();
const SETTLE_MS = 2 * 60 * 60 * 1000;
const RANG = 'race.rang';
const ANSWERED = 'race.answered';
const STEADY = 'race.steady';
const FLAKY = 'race.flaky';
const CALL_OUT = 'race.call-out';
const HEAR_ANSWER = 'race.hear-answer';
const HEARING_RANG = [STEADY, FLAKY, CALL_OUT] as const;
const RAISING = [FLAKY, CALL_OUT] as const;

class Rang implements DomainEvent {
  readonly kind = RANG;

  constructor(
    readonly marker: string,
    readonly workspaceId: string,
  ) {}
}

class Answered implements DomainEvent {
  readonly kind = ANSWERED;

  constructor(
    readonly marker: string,
    readonly by: string,
  ) {}
}

class RolledBack extends Error {}

type Failure = 'error' | 'long message' | 'NUL byte' | 'at once';

type CallStyle = 'quick' | 'slow' | 'stall';

type Ending = 'commit' | 'rollback' | 'savepoint';

interface Plan {
  readonly flaky: number;
  readonly callOut: number;
  readonly style: CallStyle;
  readonly failure: Failure;
  readonly slowMs: number;
}

type Action =
  | {
      readonly kind: 'commit';
      readonly plans: readonly Plan[];
      readonly ending: Ending;
      readonly holdMs: number;
      readonly afterMs: number;
    }
  | { readonly kind: 'work'; readonly afterMs: number }
  | { readonly kind: 'jump'; readonly byMs: number; readonly afterMs: number }
  | {
      readonly kind: 'sweep';
      readonly aheadMs: number;
      readonly afterMs: number;
    };

const failures = fc.oneof(
  { arbitrary: fc.constant(0), weight: 4 },
  { arbitrary: fc.integer({ min: 1, max: 3 }), weight: 2 },
  {
    arbitrary: fc.integer({
      min: DEFAULT_RETRY.maxAttempts - 1,
      max: DEFAULT_RETRY.maxAttempts + 1,
    }),
    weight: 1,
  },
);

const plan: fc.Arbitrary<Plan> = fc.record({
  flaky: failures,
  callOut: failures,
  style: fc.oneof(
    { arbitrary: fc.constant<CallStyle>('quick'), weight: 2 },
    { arbitrary: fc.constant<CallStyle>('slow'), weight: 2 },
    { arbitrary: fc.constant<CallStyle>('stall'), weight: 1 },
  ),
  failure: fc.constantFrom<Failure>(
    'error',
    'long message',
    'NUL byte',
    'at once',
  ),
  slowMs: fc.integer({ min: 0, max: 30 }),
});

const afterMs = fc.integer({ min: 0, max: 25 });

const commit: fc.Arbitrary<Action> = fc.record({
  kind: fc.constant('commit' as const),
  plans: fc.array(plan, { minLength: 1, maxLength: 3 }),
  ending: fc.oneof(
    { arbitrary: fc.constant<Ending>('commit'), weight: 3 },
    { arbitrary: fc.constant<Ending>('rollback'), weight: 1 },
    { arbitrary: fc.constant<Ending>('savepoint'), weight: 1 },
  ),
  holdMs: fc.integer({ min: 0, max: 20 }),
  afterMs,
});

const work: fc.Arbitrary<Action> = fc.record({
  kind: fc.constant('work' as const),
  afterMs,
});

const jump: fc.Arbitrary<Action> = fc.record({
  kind: fc.constant('jump' as const),
  byMs: fc.oneof(
    { arbitrary: fc.constant(LEASE_MS + 1_000), weight: 3 },
    { arbitrary: fc.integer({ min: 500, max: 20_000 }), weight: 3 },
    { arbitrary: fc.integer({ min: 1_000, max: 60 * 60 * 1000 }), weight: 1 },
    { arbitrary: fc.constant(OUTBOX_RETENTION_MS + 1), weight: 1 },
  ),
  afterMs,
});

const sweep: fc.Arbitrary<Action> = fc.record({
  kind: fc.constant('sweep' as const),
  aheadMs: fc.constantFrom(0, OUTBOX_RETENTION_MS + 1),
  afterMs,
});

const round: fc.Arbitrary<readonly Action[]> = fc
  .tuple(
    fc.array(work, { minLength: 2, maxLength: 4 }),
    fc.array(
      fc.oneof(
        { arbitrary: commit, weight: 4 },
        { arbitrary: jump, weight: 3 },
        { arbitrary: sweep, weight: 2 },
      ),
      { minLength: 1, maxLength: 4, size: 'max' },
    ),
  )
  .map(([workers, others]) => [...others, ...workers]);

const rounds = fc.array(round, { minLength: 1, maxLength: 4, size: 'max' });

const paces = fc.array(
  fc.oneof(
    { arbitrary: fc.integer({ min: 500, max: 20_000 }), weight: 3 },
    { arbitrary: fc.integer({ min: 20_000, max: SETTLE_MS }), weight: 1 },
  ),
  { maxLength: 6 },
);

interface Holding {
  readonly lower: number;
}

interface Seen {
  readonly plans: Map<string, Plan>;
  readonly committed: string[];
  readonly rolledBack: string[];
  readonly calls: Map<string, number[]>;
  readonly heard: Map<string, number>;
  readonly holding: Map<string, Holding[]>;
  readonly overlaps: string[];
  readonly reports: string[];
  readonly outcomes: Map<string, number>;
}

const seeing = (): Seen => ({
  plans: new Map(),
  committed: [],
  rolledBack: [],
  calls: new Map(),
  heard: new Map(),
  holding: new Map(),
  overlaps: [],
  reports: [],
  outcomes: new Map(),
});

const keyOf = (subscriber: string, marker: string): string =>
  `${subscriber} ${marker}`;

const bumped = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

let database: TestDatabase;
let context: DrizzleContext;
let outbox: EventOutbox;
let subscribers: EventSubscribers;
let now = START;
let seen = seeing();
const holders = new AsyncLocalStorage<{ since: number }>();

const clock: ClockPort = {
  now: () => new Date(now),
  sleep: async () => {},
};

const logger: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const reports: ErrorReportsPort = {
  report: (_error, about) => {
    seen.reports.push(keyOf(about.source, about.workspaceId ?? ''));
  },
};

const telemetry: TelemetryPort = {
  inSpan: (_name, _ids, work) => work(),
  count: (_metric, attributes) => {
    bumped(
      seen.outcomes,
      keyOf(
        attributes?.['spotlight.subscriber'] ?? '',
        attributes?.['spotlight.delivery.outcome'] ?? '',
      ),
    );
  },
  measure: () => undefined,
};

const causes = new CauseCarrier();

const deliveryFor = (): EventDelivery =>
  new EventDelivery(
    context,
    outbox,
    subscribers,
    clock,
    logger,
    causes,
    reports,
    telemetry,
  );

const worked = (): Promise<number> =>
  holders.run({ since: now }, () => deliveryFor().processDue('contexts', 1000));

const planOf = (marker: string): Plan => {
  const found = seen.plans.get(marker);

  if (!found) {
    throw new Error(`No plan for ${marker}`);
  }

  return found;
};

const held = (subscriber: string, marker: string, exclusive: boolean) => {
  const key = keyOf(subscriber, marker);
  const at = now;
  const others = seen.holding.get(key) ?? [];
  const mine: Holding = {
    lower: holders.getStore()?.since ?? Number.NEGATIVE_INFINITY,
  };

  if (others.some((other) => exclusive || at < other.lower + LEASE_MS)) {
    seen.overlaps.push(key);
  }

  seen.holding.set(key, [...others, mine]);
  seen.calls.set(key, [...(seen.calls.get(key) ?? []), at]);

  return {
    call: seen.calls.get(key)?.length ?? 0,
    release: () => {
      seen.holding.set(
        key,
        (seen.holding.get(key) ?? []).filter((each) => each !== mine),
      );
      const store = holders.getStore();

      if (store) {
        store.since = now;
      }
    },
  };
};

const failed = (failure: Failure, subscriber: string): Promise<never> =>
  Promise.reject(
    new Error(
      failure === 'long message'
        ? `${subscriber} failed: ${'output '.repeat(500)}`
        : failure === 'NUL byte'
          ? `${subscriber} failed reading \u0000`
          : `${subscriber} failed`,
    ),
  );

const hearing = (
  name: string,
  callsOut: boolean,
  failuresIn: (plan: Plan) => number,
  then: (
    rang: Rang,
    plan: Plan,
    call: number,
  ) => Promise<readonly DomainEvent[]>,
): DomainEventSubscriber => ({
  name,
  kinds: [RANG],
  callsOut,
  handle: (event) => {
    if (!(event instanceof Rang)) {
      throw new Error(`${name} heard ${event.kind}`);
    }

    const plan = planOf(event.marker);
    const holding = held(name, event.marker, !callsOut);
    const failing = holding.call <= failuresIn(plan);

    if (failing && plan.failure === 'at once') {
      holding.release();
      throw new Error(`${name} failed at once`);
    }

    return then(event, plan, holding.call)
      .then((raised) => (failing ? failed(plan.failure, name) : raised))
      .finally(holding.release);
  },
});

const heardInTransaction = (subscriber: string, marker: string): void => {
  context.afterCommit(() => bumped(seen.heard, keyOf(subscriber, marker)));
};

const raceSubscribers = (): readonly DomainEventSubscriber[] => [
  hearing(
    STEADY,
    false,
    () => 0,
    async (rang, plan) => {
      await pause(plan.style === 'slow' ? plan.slowMs : 0);
      heardInTransaction(STEADY, rang.marker);

      return [];
    },
  ),
  hearing(
    FLAKY,
    false,
    (plan) => plan.flaky,
    async (rang, plan, call) => {
      if (call > plan.flaky) {
        heardInTransaction(FLAKY, rang.marker);
      }

      return [new Answered(rang.marker, FLAKY)];
    },
  ),
  hearing(
    CALL_OUT,
    true,
    (plan) => plan.callOut,
    async (rang, plan, call) => {
      if (plan.style === 'slow') {
        await pause(plan.slowMs);
      }

      if (plan.style === 'stall' && call === 1) {
        now += LEASE_MS + 1_000;
        await worked();
      }

      if (call > plan.callOut) {
        bumped(seen.heard, keyOf(CALL_OUT, rang.marker));
      }

      return [new Answered(rang.marker, CALL_OUT)];
    },
  ),
  {
    name: HEAR_ANSWER,
    kinds: [ANSWERED],
    callsOut: false,
    handle: async (event) => {
      if (!(event instanceof Answered)) {
        throw new Error(`${HEAR_ANSWER} heard ${event.kind}`);
      }

      const holding = held(HEAR_ANSWER, `${event.by} ${event.marker}`, true);
      context.afterCommit(() =>
        bumped(seen.heard, keyOf(HEAR_ANSWER, `${event.by} ${event.marker}`)),
      );
      holding.release();

      return [];
    },
  },
];

const committed = async (
  prefix: string,
  action: Extract<Action, { kind: 'commit' }>,
): Promise<void> => {
  const markers = action.plans.map((_, at) => `${prefix}.${at}`);

  for (const [at, marker] of markers.entries()) {
    seen.plans.set(marker, action.plans[at] ?? planOf(marker));
  }

  const events = markers.map((marker) => new Rang(marker, `ws_${marker}`));
  const rolledBack = (error: unknown) => {
    if (!(error instanceof RolledBack)) {
      throw error;
    }
  };

  switch (action.ending) {
    case 'commit':
      await context.inTransaction(async () => {
        await outbox.record(events);
        await pause(action.holdMs);
      });
      seen.committed.push(...markers);
      return;
    case 'rollback':
      await context
        .inTransaction(async () => {
          await outbox.record(events);
          await pause(action.holdMs);
          throw new RolledBack('the command failed');
        })
        .catch(rolledBack);
      seen.rolledBack.push(...markers);
      return;
    case 'savepoint':
      await context.inTransaction(async () => {
        await context
          .inSavepoint(async () => {
            await outbox.record(events);
            throw new RolledBack('the step failed');
          })
          .catch(rolledBack);
        await pause(action.holdMs);
      });
      seen.rolledBack.push(...markers);
      return;
  }
};

const performed = async (prefix: string, action: Action): Promise<void> => {
  await pause(action.afterMs);

  switch (action.kind) {
    case 'commit':
      return committed(prefix, action);
    case 'work':
      await worked();
      return;
    case 'jump':
      now += action.byMs;
      return;
    case 'sweep':
      await new OutboxRetention(
        context,
        {
          now: () => new Date(now + action.aheadMs),
          sleep: async () => {},
        },
        subscribers,
      ).sweep();
      return;
  }
};

interface Row {
  readonly marker: string;
  readonly kind: string;
  readonly subscriber: string;
  readonly attempts: number;
  readonly delivered: boolean;
  readonly deadLettered: boolean;
}

interface Raced {
  readonly seen: Seen;
  readonly rows: readonly Row[];
  readonly pending: number;
  readonly keptAfterAWeek: readonly string[];
}

const markerOf = (payload: unknown): string => {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'marker' in payload &&
    typeof payload.marker === 'string'
  ) {
    return payload.marker;
  }

  throw new Error('An event without a marker');
};

const pending = async (): Promise<number> =>
  (
    await database.db
      .select({ eventId: eventDelivery.eventId })
      .from(eventDelivery)
      .where(
        and(
          isNull(eventDelivery.deliveredAt),
          isNull(eventDelivery.deadLetteredAt),
        ),
      )
  ).length;

const stored = async (): Promise<readonly Row[]> =>
  (
    await database.db
      .select({
        payload: eventOutbox.payload,
        kind: eventOutbox.kind,
        subscriber: eventDelivery.subscriber,
        attempts: eventDelivery.attempts,
        deliveredAt: eventDelivery.deliveredAt,
        deadLetteredAt: eventDelivery.deadLetteredAt,
      })
      .from(eventDelivery)
      .innerJoin(eventOutbox, eq(eventOutbox.id, eventDelivery.eventId))
  ).map((each) => ({
    marker: markerOf(each.payload),
    kind: each.kind,
    subscriber: each.subscriber,
    attempts: each.attempts,
    delivered: each.deliveredAt !== null,
    deadLettered: each.deadLetteredAt !== null,
  }));

const settled = async (paced: readonly number[]): Promise<void> => {
  for (const pace of paced) {
    now += pace;
    await Promise.all([worked(), worked()]);
  }

  for (
    let pass = 0;
    pass <= DEFAULT_RETRY.maxAttempts + 1 && (await pending()) > 0;
    pass += 1
  ) {
    now += SETTLE_MS;
    await Promise.all([worked(), worked()]);
  }
};

const raced = async (
  all: readonly (readonly Action[])[],
  paced: readonly number[],
): Promise<Raced> => {
  await database.db.delete(eventOutbox);
  now = START;
  seen = seeing();

  for (const [at, actions] of all.entries()) {
    const outcomes = await Promise.allSettled(
      actions.map((action, index) => performed(`m${at}.${index}`, action)),
    );

    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        throw outcome.reason;
      }
    }
  }

  await settled(paced);
  const rows = await stored();
  const left = await pending();

  now += OUTBOX_RETENTION_MS + 1;
  await new OutboxRetention(context, clock, subscribers).sweep();

  const kept = await database.db
    .select({ payload: eventOutbox.payload })
    .from(eventOutbox);

  return {
    seen: { ...seen },
    rows,
    pending: left,
    keptAfterAWeek: kept.map((each) => markerOf(each.payload)),
  };
};

const rowOf = (
  result: Raced,
  subscriber: string,
  marker: string,
): Row | undefined =>
  result.rows.find(
    (each) =>
      each.kind === RANG &&
      each.subscriber === subscriber &&
      each.marker === marker,
  );

const gaveUp = (result: Raced, subscriber: string, marker: string): boolean =>
  rowOf(result, subscriber, marker)?.deadLettered ?? false;

const heard = (result: Raced, subscriber: string, marker: string): number =>
  result.seen.heard.get(keyOf(subscriber, marker)) ?? 0;

const answers = (result: Raced, by: string, marker: string): number =>
  heard(result, HEAR_ANSWER, `${by} ${marker}`);

const backoffMs = (attempts: number): number =>
  Math.min(2 ** attempts * 1000, 60 * 60 * 1000);

const RUNS = { numRuns: 30 };

const race = (holds: (result: Raced) => boolean) =>
  fc.asyncProperty(rounds, paces, async (all, paced) =>
    holds(await raced(all, paced)),
  );

beforeAll(async () => {
  database = await openDatabase('event_delivery_races');
  context = new DrizzleContext(database.db);
  const types = new PayloadTypes();
  types.register('race', [Rang, Answered]);
  subscribers = new EventSubscribers();
  subscribers.register(raceSubscribers());
  outbox = new EventOutbox(
    context,
    subscribers,
    types,
    new IntegrationEventMappers(),
    new EventProjections(),
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
    causes,
    logger,
    telemetry,
  );
}, 60_000);

afterAll(async () => {
  await database.close();
});

describe('domain events raced by delivery workers, failing subscribers, lost leases and the clock', () => {
  it('delivers every committed event to each subscriber, unless it gave the delivery up', async () => {
    await fc.assert(
      race(
        (result) =>
          result.pending === 0 &&
          result.rows.every((each) => !(each.delivered && each.deadLettered)) &&
          result.seen.committed.every((marker) =>
            HEARING_RANG.every(
              (subscriber) =>
                gaveUp(result, subscriber, marker) ||
                (heard(result, subscriber, marker) > 0 &&
                  (rowOf(result, subscriber, marker)?.delivered ?? true)),
            ),
          ),
      ),
      RUNS,
    );
  }, 300_000);

  it('gives a delivery up exactly once, after its last attempt', async () => {
    await fc.assert(
      race(
        (result) =>
          result.rows.every(
            (each) =>
              each.attempts <= DEFAULT_RETRY.maxAttempts &&
              (!each.deadLettered ||
                each.attempts === DEFAULT_RETRY.maxAttempts),
          ) &&
          result.seen.committed.every((marker) =>
            HEARING_RANG.every(
              (subscriber) =>
                result.seen.reports.filter(
                  (each) => each === keyOf(subscriber, `ws_${marker}`),
                ).length === (gaveUp(result, subscriber, marker) ? 1 : 0),
            ),
          ) &&
          HEARING_RANG.every(
            (subscriber) =>
              (result.seen.outcomes.get(keyOf(subscriber, 'dead_lettered')) ??
                0) ===
              result.rows.filter(
                (each) => each.subscriber === subscriber && each.deadLettered,
              ).length,
          ),
      ),
      RUNS,
    );
  }, 300_000);

  it('lets no two workers hold the same delivery while its lease lasts', async () => {
    await fc.assert(
      race((result) => result.seen.overlaps.length === 0),
      RUNS,
    );
  }, 300_000);

  it('never delivers an event whose transaction rolled back', async () => {
    await fc.assert(
      race((result) =>
        result.seen.rolledBack.every(
          (marker) =>
            [...HEARING_RANG].every(
              (subscriber) => !result.seen.calls.has(keyOf(subscriber, marker)),
            ) && result.rows.every((each) => each.marker !== marker),
        ),
      ),
      RUNS,
    );
  }, 300_000);

  it('settles each delivery once, and records what its subscriber raised once', async () => {
    await fc.assert(
      race((result) =>
        result.seen.committed.every(
          (marker) =>
            [STEADY, FLAKY].every(
              (subscriber) =>
                heard(result, subscriber, marker) ===
                (gaveUp(result, subscriber, marker) ? 0 : 1),
            ) &&
            RAISING.every(
              (by) =>
                answers(result, by, marker) ===
                (gaveUp(result, by, marker) ? 0 : 1),
            ) &&
            HEARING_RANG.every(
              (subscriber) =>
                (result.seen.outcomes.get(keyOf(subscriber, 'delivered')) ??
                  0) ===
                result.seen.committed.filter(
                  (each) => !gaveUp(result, subscriber, each),
                ).length,
            ),
        ),
      ),
      RUNS,
    );
  }, 300_000);

  it('tries a subscriber in the claiming transaction once per attempt, each after the backoff of the last', async () => {
    await fc.assert(
      race((result) =>
        result.seen.committed.every((marker) => {
          const failing = result.seen.plans.get(marker)?.flaky ?? 0;
          const calls = result.seen.calls.get(keyOf(FLAKY, marker)) ?? [];

          return (
            calls.length === Math.min(failing + 1, DEFAULT_RETRY.maxAttempts) &&
            gaveUp(result, FLAKY, marker) ===
              failing >= DEFAULT_RETRY.maxAttempts &&
            calls.every(
              (at, index) =>
                index === 0 ||
                at - (calls[index - 1] ?? at) >= backoffMs(index),
            )
          );
        }),
      ),
      RUNS,
    );
  }, 300_000);

  it('keeps an event a week on only while a subscriber gave its delivery up', async () => {
    await fc.assert(
      race(
        (result) =>
          [...new Set(result.keptAfterAWeek)].sort().join() ===
          result.seen.committed
            .filter((marker) =>
              HEARING_RANG.some((subscriber) =>
                gaveUp(result, subscriber, marker),
              ),
            )
            .sort()
            .join(),
      ),
      RUNS,
    );
  }, 300_000);
});
