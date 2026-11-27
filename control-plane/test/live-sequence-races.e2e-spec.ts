import { randomUUID } from 'node:crypto';
import { setTimeout as waited } from 'node:timers/promises';

import type { MessageEvent } from '@nestjs/common';
import { CauseCarrier } from '@platform/events/cause-carrier';
import { EventOutbox } from '@platform/events/event-outbox';
import { EventProjections } from '@platform/events/event-projections';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import {
  ChangeNotices,
  changedIn,
  noticing,
  type SequencedNotice,
} from '@platform/live/change-notices';
import { DrizzleLiveNoticeLog } from '@platform/live/drizzle-live-notice-log';
import { InMemoryLiveFeed } from '@platform/live/in-memory-live-feed';
import {
  type LiveChannel,
  type LiveFeedPort,
  type LiveListener,
  type LiveMessage,
  workspaceChannel,
} from '@platform/live/live-feed.port';
import { LiveNotices } from '@platform/live/live-notices';
import { LiveStreams } from '@platform/live/live-streams';
import { LiveWrites } from '@platform/live/live-writes';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  liveChannel,
  liveNotice,
} from '@platform/persistence/drizzle/schemas/live.schema';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { itemAt } from '@shared-kernel/domain/item-at';
import { inArray } from 'drizzle-orm';
import fc from 'fast-check';
import type { Subscription } from 'rxjs';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

const TOUCHED = 'live-race.touched';
const READY_WAIT_MS = 10_000;

class Touched implements DomainEvent {
  readonly kind = TOUCHED;

  constructor(
    readonly marker: string,
    readonly workspaceIds: readonly string[],
  ) {}
}

class RolledBack extends Error {}

const logger: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

class RecordingFeed implements LiveFeedPort {
  readonly #inner = new InMemoryLiveFeed();
  readonly published: { channel: LiveChannel; message: LiveMessage }[] = [];

  publish(channel: LiveChannel, message: LiveMessage): void {
    this.published.push({ channel, message });
    this.#inner.publish(channel, message);
  }

  subscribe(
    channels: readonly LiveChannel[],
    listener: LiveListener,
  ): () => void {
    return this.#inner.subscribe(channels, listener);
  }

  watched(): Promise<void> {
    return Promise.resolve();
  }
}

let database: TestDatabase;
let db: DrizzleDatabase;
let context: DrizzleContext;
let log: DrizzleLiveNoticeLog;

beforeAll(async () => {
  database = await openDatabase('live_sequence_races');
  db = database.db;
  context = new DrizzleContext(db);
  log = new DrizzleLiveNoticeLog(db, logger);
}, 60_000);

afterAll(async () => {
  await database.close();
});

const wiredTo = (feed: RecordingFeed): EventOutbox => {
  const types = new PayloadTypes();
  types.register('live-race', [Touched]);
  const notices = new ChangeNotices();
  notices.register([
    noticing<Touched>('live-race.touched', [TOUCHED], (event) =>
      event.workspaceIds.map((workspaceId) =>
        changedIn(workspaceId, 'race', { marker: event.marker }),
      ),
    ),
  ]);

  return new EventOutbox(
    context,
    new EventSubscribers(),
    types,
    new IntegrationEventMappers(),
    new EventProjections(),
    notices,
    new LiveNotices(feed, log, logger),
    { generate: () => randomUUID() },
    { now: () => new Date(), sleep: () => Promise.resolve(undefined) },
    new CauseCarrier(),
    logger,
    telemetryInMemory(),
  );
};

type Ending = 'commit' | 'rollback' | 'savepoint';

interface Writer {
  readonly on: readonly (0 | 1)[];
  readonly ending: Ending;
}

interface Race {
  readonly before: number;
  readonly resumeBack: number;
  readonly writers: readonly Writer[];
  readonly opensAfterMs: number;
  readonly trimsAfterMs: number | null;
}

const writer: fc.Arbitrary<Writer> = fc.record({
  on: fc.array(fc.constantFrom<0 | 1>(0, 1), { minLength: 1, maxLength: 3 }),
  ending: fc.oneof(
    { weight: 3, arbitrary: fc.constant<Ending>('commit') },
    { weight: 1, arbitrary: fc.constant<Ending>('rollback') },
    { weight: 1, arbitrary: fc.constant<Ending>('savepoint') },
  ),
});

const race: fc.Arbitrary<Race> = fc
  .record({
    before: fc.integer({ min: 0, max: 4 }),
    back: fc.nat({ max: 4 }),
    writers: fc.array(writer, { minLength: 2, maxLength: 5 }),
    opensAfterMs: fc.integer({ min: 0, max: 6 }),
    trimsAfterMs: fc.oneof(
      { weight: 3, arbitrary: fc.constant(null) },
      { weight: 2, arbitrary: fc.integer({ min: 0, max: 6 }) },
    ),
  })
  .map(({ before, back, ...rest }) => ({
    before,
    resumeBack: Math.min(back, before),
    ...rest,
  }));

interface Written {
  readonly marker: string;
  readonly kept: boolean;
}

interface Done {
  readonly written: readonly Written[];
  readonly sequenced: readonly (readonly SequencedNotice[])[];
  readonly header: string | null;
}

interface Raced {
  readonly input: Race;
  readonly channels: readonly [LiveChannel, LiveChannel];
  readonly done: readonly Done[];
  readonly feed: RecordingFeed;
  readonly stored: readonly { channel: string; sequence: number }[];
  readonly heads: ReadonlyMap<string, number>;
  readonly since: ReadonlyMap<LiveChannel, number>;
  readonly heard: readonly MessageEvent[];
}

const markerOf = (data: unknown): unknown => {
  if (typeof data !== 'object' || data === null || !('ids' in data)) {
    return undefined;
  }

  const ids = data.ids;

  return typeof ids === 'object' && ids !== null && 'marker' in ids
    ? ids.marker
    : undefined;
};

const positionIn = (
  event: MessageEvent,
): { readonly channel: string; readonly sequence: number } | null => {
  if (event.type !== 'changed' || typeof event.data !== 'object') {
    return null;
  }

  const channel = 'channel' in event.data ? event.data.channel : undefined;
  const sequence = 'sequence' in event.data ? event.data.sequence : undefined;

  return typeof channel === 'string' && typeof sequence === 'number'
    ? { channel, sequence }
    : null;
};

const writing = async (
  outbox: EventOutbox,
  workspaceIds: readonly [string, string],
  each: Writer,
): Promise<Done> => {
  const published: Promise<readonly SequencedNotice[]>[] = [];
  const touched = (marker: string) =>
    new Touched(
      marker,
      [...new Set(each.on)].map((at) => workspaceIds[at]),
    );
  const first = randomUUID();
  const second = randomUUID();

  await LiveWrites.within(published, async () => {
    if (each.ending === 'commit') {
      await outbox.record([touched(first)]);
      return;
    }

    if (each.ending === 'rollback') {
      await context
        .inTransaction(async () => {
          await outbox.record([touched(first)]);
          throw new RolledBack();
        })
        .catch((error: unknown) => {
          if (!(error instanceof RolledBack)) {
            throw error;
          }
        });
      return;
    }

    await context.inTransaction(async () => {
      await outbox.record([touched(first)]);
      await context
        .inSavepoint(async () => {
          await outbox.record([touched(second)]);
          throw new RolledBack();
        })
        .catch((error: unknown) => {
          if (!(error instanceof RolledBack)) {
            throw error;
          }
        });
    });
  });

  return {
    written: [
      { marker: first, kept: each.ending !== 'rollback' },
      ...(each.ending === 'savepoint' ? [{ marker: second, kept: false }] : []),
    ],
    sequenced: await Promise.all(published),
    header: await LiveWrites.headerOf(published),
  };
};

const raced = async (input: Race): Promise<Raced> => {
  const workspaceIds = [`ws_${randomUUID()}`, `ws_${randomUUID()}`] as const;
  const channels = [
    workspaceChannel(workspaceIds[0]),
    workspaceChannel(workspaceIds[1]),
  ] as const;
  const feed = new RecordingFeed();
  const outbox = wiredTo(feed);

  for (let each = 0; each < input.before; each++) {
    await writing(outbox, workspaceIds, { on: [0], ending: 'commit' });
  }

  feed.published.length = 0;
  const since = new Map<LiveChannel, number>([
    [channels[0], input.before - input.resumeBack],
    [channels[1], 0],
  ]);
  const heard: MessageEvent[] = [];
  const streams = new LiveStreams(feed, log, () => 0, logger);
  const subscriptions: Subscription[] = [];
  const opened = async () => {
    await waited(input.opensAfterMs);
    subscriptions.push(
      streams.open(channels, since).subscribe((event) => heard.push(event)),
    );

    return null;
  };
  const trimmed = async (ms: number) => {
    await waited(ms);
    await log.prune(new Date(Date.now() + 60_000), 1_000);

    return null;
  };

  try {
    const results = await Promise.allSettled([
      ...input.writers.map((each) => writing(outbox, workspaceIds, each)),
      opened(),
      ...(input.trimsAfterMs === null ? [] : [trimmed(input.trimsAfterMs)]),
    ]);
    const done = results.flatMap((result) => {
      if (result.status === 'rejected') {
        throw result.reason;
      }

      return result.value === null ? [] : [result.value];
    });

    for (
      let spent = 0;
      spent < READY_WAIT_MS && !heard.some((event) => event.type === 'ready');
      spent += 5
    ) {
      await waited(5);
    }

    const stored = await db
      .select({ channel: liveNotice.channel, sequence: liveNotice.sequence })
      .from(liveNotice)
      .where(inArray(liveNotice.channel, [...channels]));
    const heads = await db
      .select({
        channel: liveChannel.channel,
        lastSequence: liveChannel.lastSequence,
      })
      .from(liveChannel)
      .where(inArray(liveChannel.channel, [...channels]));

    return {
      input,
      channels,
      done,
      feed,
      stored,
      heads: new Map(heads.map((row) => [row.channel, row.lastSequence])),
      since,
      heard: [...heard],
    };
  } finally {
    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }
  }
};

const RUNS = { numRuns: 60 };

const racing = (holds: (result: Raced) => boolean) =>
  fc.asyncProperty(race, async (input) => holds(await raced(input)));

const raceSequences = (result: Raced, channel: LiveChannel) =>
  result.done
    .flatMap((each) => each.sequenced.flat())
    .filter((notice) => notice.channel === channel)
    .map((notice) => notice.sequence);

describe('writers publishing live changes at the same moment', () => {
  it('gives every committed notice its own sequence, so a channel counts up by one with no gap', async () => {
    await fc.assert(
      racing((result) =>
        result.channels.every((channel, at) => {
          const before = at === 0 ? result.input.before : 0;
          const sequences = raceSequences(result, channel);
          const head = result.heads.get(channel) ?? 0;

          return (
            sequences.every((sequence) => sequence !== null) &&
            new Set(sequences).size === sequences.length &&
            head === before + sequences.length &&
            sequences.every((sequence) => sequence > before && sequence <= head)
          );
        }),
      ),
      RUNS,
    );
  }, 180_000);

  it('gives the notices of one write on one channel a block of sequences no other write breaks into', async () => {
    await fc.assert(
      racing((result) =>
        result.done.every((each) =>
          each.sequenced.every((notices) =>
            result.channels.every((channel) => {
              const sequences = notices
                .filter((notice) => notice.channel === channel)
                .map((notice) => notice.sequence ?? 0);

              return sequences.every(
                (sequence, at) => sequence === (sequences[0] ?? 0) + at,
              );
            }),
          ),
        ),
      ),
      RUNS,
    );
  }, 180_000);

  it('never numbers or sends a notice of a rolled-back transaction, and sends each committed one once', async () => {
    await fc.assert(
      racing((result) => {
        const sent = result.feed.published.map((each) =>
          markerOf(each.message.data),
        );
        const numbered = result.done.flatMap((each) =>
          each.sequenced.flat().map((notice) => notice.ids.marker),
        );

        return result.done.every((each) =>
          each.written.every(({ marker, kept }) => {
            const channels = kept
              ? new Set(
                  result.input.writers[result.done.indexOf(each)]?.on ?? [],
                ).size
              : 0;

            return (
              sent.filter((one) => one === marker).length === channels &&
              numbered.filter((one) => one === marker).length === channels
            );
          }),
        );
      }),
      RUNS,
    );
  }, 180_000);

  it('stores a notice for every sequence it hands out, unless retention trimmed it', async () => {
    await fc.assert(
      racing(
        (result) =>
          result.input.trimsAfterMs !== null ||
          result.channels.every((channel) => {
            const stored = result.stored
              .filter((row) => row.channel === channel)
              .map((row) => row.sequence)
              .sort((one, other) => one - other);

            return (
              stored.length === (result.heads.get(channel) ?? 0) &&
              stored.every((sequence, at) => sequence === at + 1)
            );
          }),
      ),
      RUNS,
    );
  }, 180_000);

  it('tells each write the last sequence of its own notices on each channel, and nothing of the others', async () => {
    await fc.assert(
      racing((result) =>
        result.done.every((each) => {
          const last = new Map<string, number>();

          for (const notice of each.sequenced.flat()) {
            last.set(
              notice.channel,
              Math.max(last.get(notice.channel) ?? 0, notice.sequence ?? 0),
            );
          }

          const expected =
            last.size === 0
              ? null
              : [...last]
                  .map(([channel, sequence]) => `${channel}@${sequence}`)
                  .sort()
                  .join(',');

          return (
            (each.header?.split(',').sort().join(',') ?? null) === expected
          );
        }),
      ),
      RUNS,
    );
  }, 180_000);

  it('brings a stream opened during the race up to every head, after a full replay or a told reload', async () => {
    await fc.assert(
      racing((result) => {
        const at = result.heard.findIndex((event) => event.type === 'ready');
        const ready = itemAt(result.heard, at);
        const data =
          ready && typeof ready.data === 'object' ? ready.data : undefined;
        const complete = data && 'complete' in data ? data.complete : undefined;
        const heads = data && 'heads' in data ? data.heads : undefined;

        if (typeof heads !== 'object' || heads === null) {
          return false;
        }

        const reported = new Map(
          Object.entries(heads).flatMap(([channel, head]) =>
            typeof head === 'number' ? [[channel, head] as const] : [],
          ),
        );
        const known = new Set(
          result.heard
            .map(positionIn)
            .flatMap((position) =>
              position ? [`${position.channel}@${position.sequence}`] : [],
            ),
        );

        return (
          (complete === true || result.input.trimsAfterMs !== null) &&
          result.channels.every((channel) => {
            const head = result.heads.get(channel) ?? 0;
            const from =
              complete === true
                ? (result.since.get(channel) ?? 0)
                : (reported.get(channel) ?? 0);

            return Array.from(
              { length: Math.max(0, head - from) },
              (_, each) => from + each + 1,
            ).every((sequence) => known.has(`${channel}@${sequence}`));
          })
        );
      }),
      RUNS,
    );
  }, 180_000);
});
