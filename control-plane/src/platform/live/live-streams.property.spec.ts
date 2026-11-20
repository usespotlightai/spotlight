import type { MessageEvent } from '@nestjs/common';
import { Instance } from '@platform/cluster/instance';
import type {
  ChangeNotice,
  SequencedNotice,
} from '@platform/live/change-notices';
import { InMemoryLiveFeed } from '@platform/live/in-memory-live-feed';
import type {
  LiveChannel,
  LiveFeedPort,
  LiveListener,
  LiveMessage,
} from '@platform/live/live-feed.port';
import type {
  ChannelLog,
  LiveNoticeLogPort,
  LivePositions,
} from '@platform/live/live-notice-log.port';
import { LiveNoticeRetentionWorker } from '@platform/live/live-notice-retention.worker';
import { LiveNotices } from '@platform/live/live-notices';
import { REPLAY_LIMIT } from '@platform/live/live-replay';
import { LiveStreams } from '@platform/live/live-streams';
import { Leadership } from '@platform/redis/leadership';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import fc from 'fast-check';
import type { Subscription } from 'rxjs';
import { describe, it } from 'vitest';

const START = Date.parse('2026-11-20T09:00:00.000Z');
const HOUR_MS = 60 * 60_000;
const WATCHED: readonly LiveChannel[] = [
  'workspace:ws_1',
  'workspace:ws_2',
  'person:user_1',
];
const ELSEWHERE: readonly LiveChannel[] = ['workspace:ws_9', 'person:user_9'];
const CLIENTS = ['a', 'b'] as const;

type Client = (typeof CLIENTS)[number];
type Fault = 'none' | 'lost' | 'twice' | 'late';

interface Written {
  readonly channel: LiveChannel;
  readonly ids: Readonly<Record<string, string>>;
  readonly fault: Fault;
}

type Since =
  | { readonly kind: 'applied' }
  | { readonly kind: 'given'; readonly offsets: readonly (number | null)[] };

type Step =
  | { readonly kind: 'write'; readonly notices: readonly Written[] }
  | { readonly kind: 'number'; readonly pick: number; readonly fails: boolean }
  | { readonly kind: 'answer'; readonly pick: number }
  | { readonly kind: 'open'; readonly client: Client; readonly since: Since }
  | { readonly kind: 'read'; readonly pick: number; readonly fails: boolean }
  | { readonly kind: 'close'; readonly client: Client }
  | { readonly kind: 'late'; readonly pick: number }
  | { readonly kind: 'wait'; readonly ms: number }
  | { readonly kind: 'resync' }
  | { readonly kind: 'prune' };

const logger: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

interface Row extends SequencedNotice {
  readonly sequence: number;
  readonly recordedAt: number;
}

interface PendingAppend {
  readonly notices: readonly ChangeNotice[];
  readonly resolve: (notices: readonly SequencedNotice[]) => void;
  readonly reject: (error: Error) => void;
}

interface PendingRead {
  readonly channels: readonly LiveChannel[];
  readonly since: LivePositions;
  readonly limit: number;
  heads: ReadonlyMap<LiveChannel, number> | null;
  readonly resolve: (logs: ReadonlyMap<LiveChannel, ChannelLog>) => void;
  readonly reject: (error: Error) => void;
}

interface Read {
  readonly since: LivePositions;
  readonly failed: boolean;
  readonly holdsEveryMissed: boolean;
}

const picked = <T>(list: T[], pick: number): T | undefined =>
  list.splice(pick % Math.max(list.length, 1), 1)[0];

class SteppedLog implements LiveNoticeLogPort {
  readonly heads = new Map<LiveChannel, number>();
  readonly appended: Row[] = [];
  readonly appending: PendingAppend[] = [];
  readonly numbered: (() => void)[] = [];
  readonly reading: PendingRead[] = [];
  readonly reads: Read[] = [];
  rows: Row[] = [];
  now = START;

  append(
    notices: readonly ChangeNotice[],
  ): Promise<readonly SequencedNotice[]> {
    return new Promise((resolve, reject) => {
      this.appending.push({ notices, resolve, reject });
    });
  }

  logs(
    channels: readonly LiveChannel[],
    since: LivePositions,
    limit: number,
  ): Promise<ReadonlyMap<LiveChannel, ChannelLog>> {
    return new Promise((resolve, reject) => {
      this.reading.push({
        channels,
        since,
        limit,
        heads: null,
        resolve,
        reject,
      });
    });
  }

  async prune(before: Date, limit: number): Promise<number> {
    const old = new Set(
      this.rows
        .filter((row) => row.recordedAt < before.getTime())
        .slice(0, limit),
    );
    this.rows = this.rows.filter((row) => !old.has(row));

    return old.size;
  }

  headOf(channel: LiveChannel): number {
    return this.heads.get(channel) ?? 0;
  }

  number(pick: number, fails: boolean): void {
    const append = picked(this.appending, pick);

    if (!append) {
      return;
    }

    if (fails) {
      append.reject(new Error('database gone'));
      return;
    }

    const channels = [...new Set(append.notices.map((each) => each.channel))];
    const sequenced = channels.flatMap((channel) =>
      append.notices
        .filter((each) => each.channel === channel)
        .map((notice) => {
          const sequence = this.headOf(channel) + 1;
          const row = { ...notice, sequence, recordedAt: this.now };
          this.heads.set(channel, sequence);
          this.rows.push(row);
          this.appended.push(row);

          return { ...notice, sequence };
        }),
    );

    this.numbered.push(() => append.resolve(sequenced));
  }

  answer(pick: number): void {
    picked(this.numbered, pick)?.();
  }

  read(pick: number, fails: boolean): void {
    const read = this.reading[pick % Math.max(this.reading.length, 1)];

    if (!read) {
      return;
    }

    if (fails) {
      picked(this.reading, pick);
      this.reads.push({
        since: read.since,
        failed: true,
        holdsEveryMissed: false,
      });
      read.reject(new Error('database gone'));
      return;
    }

    if (read.heads === null) {
      read.heads = new Map(
        read.channels.map((channel) => [channel, this.headOf(channel)]),
      );
      return;
    }

    picked(this.reading, pick);
    const heads = read.heads;
    const kept = (channel: LiveChannel, sequence: number) =>
      this.rows.some(
        (row) => row.channel === channel && row.sequence === sequence,
      );

    this.reads.push({
      since: read.since,
      failed: false,
      holdsEveryMissed: read.channels.every((channel) => {
        const from = read.since.get(channel);
        const head = heads.get(channel) ?? 0;

        return (
          from !== undefined &&
          from <= head &&
          head - from <= REPLAY_LIMIT &&
          Array.from({ length: head - from }, (_, at) => from + at + 1).every(
            (sequence) => kept(channel, sequence),
          )
        );
      }),
    });
    read.resolve(
      new Map(
        read.channels.map((channel) => {
          const head = heads.get(channel) ?? 0;
          const from = read.since.get(channel);
          const after =
            from === undefined || from >= head
              ? []
              : this.rows
                  .filter(
                    (row) => row.channel === channel && row.sequence > from,
                  )
                  .sort((one, other) => one.sequence - other.sequence)
                  .slice(0, read.limit)
                  .filter((row) => row.sequence <= head)
                  .map(({ recordedAt: _, ...notice }) => notice);

          return [channel, { head, after }];
        }),
      ),
    );
  }

  pending(): boolean {
    return (
      this.appending.length > 0 ||
      this.numbered.length > 0 ||
      this.reading.length > 0
    );
  }
}

interface Fed {
  readonly channel: LiveChannel;
  readonly message: LiveMessage;
}

class FaultyFeed implements LiveFeedPort {
  readonly #inner = new InMemoryLiveFeed();
  readonly published: Fed[] = [];
  readonly late: Fed[] = [];
  lastFed: LiveMessage[] = [];
  owesResync = false;

  constructor(private readonly faultOf: (message: LiveMessage) => Fault) {}

  publish(channel: LiveChannel, message: LiveMessage): void {
    this.published.push({ channel, message });

    switch (this.faultOf(message)) {
      case 'lost':
        this.owesResync = true;
        return;
      case 'late':
        this.late.push({ channel, message });
        return;
      case 'twice':
        this.#inner.publish(channel, message);
        this.#inner.publish(channel, message);
        return;
      case 'none':
        this.#inner.publish(channel, message);
    }
  }

  subscribe(
    channels: readonly LiveChannel[],
    listener: LiveListener,
  ): () => void {
    const fed: LiveMessage[] = [];
    this.lastFed = fed;

    return this.#inner.subscribe(channels, (message) => {
      fed.push(message);
      listener(message);
    });
  }

  watched(): Promise<void> {
    return Promise.resolve();
  }

  deliverLate(pick: number): void {
    const late = picked(this.late, pick);

    if (late) {
      this.#inner.publish(late.channel, late.message);
    }
  }

  resync(): void {
    this.owesResync = false;
    this.#inner.resync();
  }
}

type Heard = MessageEvent;

interface Position {
  readonly channel: string;
  readonly sequence: number;
}

const positionIn = (event: Heard): Position | null => {
  if (event.type !== 'changed' || typeof event.data !== 'object') {
    return null;
  }

  const channel = 'channel' in event.data ? event.data.channel : undefined;
  const sequence = 'sequence' in event.data ? event.data.sequence : undefined;

  return typeof channel === 'string' && typeof sequence === 'number'
    ? { channel, sequence }
    : null;
};

const fieldOf = (event: Heard, field: string): unknown =>
  typeof event.data === 'object' && field in event.data
    ? Object.entries(event.data).find(([key]) => key === field)?.[1]
    : undefined;

interface Ready {
  readonly at: number;
  readonly complete: boolean;
  readonly heads: ReadonlyMap<string, number>;
}

const readyIn = (heard: readonly Heard[]): Ready | null => {
  const at = heard.findIndex((event) => event.type === 'ready');
  const ready = heard[at];

  if (!ready) {
    return null;
  }

  const heads = fieldOf(ready, 'heads');

  return {
    at,
    complete: fieldOf(ready, 'complete') === true,
    heads: new Map(
      typeof heads === 'object' && heads !== null
        ? Object.entries(heads).flatMap(([channel, head]) =>
            typeof head === 'number' ? [[channel, head] as const] : [],
          )
        : [],
    ),
  };
};

const positionOfFed = (message: LiveMessage): Position | null =>
  positionIn({ type: message.type, data: message.data });

interface Session {
  readonly client: Client;
  readonly since: LivePositions;
  readonly heard: Heard[];
  readonly fed: readonly LiveMessage[];
  readonly subscription: Subscription;
}

interface ClientState {
  applied: Map<string, number>;
  ahead: Map<string, Set<number>>;
  stale: boolean;
  session: Session | null;
  reloads: number;
}

const freshClient = (): ClientState => ({
  applied: new Map(),
  ahead: new Map(),
  stale: false,
  session: null,
  reloads: 0,
});

const absorbed = (state: ClientState, channel: string): void => {
  const ahead = state.ahead.get(channel) ?? new Set<number>();
  let applied = state.applied.get(channel) ?? 0;

  for (const sequence of ahead) {
    if (sequence <= applied) {
      ahead.delete(sequence);
    }
  }

  while (ahead.has(applied + 1)) {
    applied += 1;
    ahead.delete(applied);
  }

  state.applied.set(channel, applied);

  if (ahead.size === 0) {
    state.ahead.delete(channel);
  } else {
    state.ahead.set(channel, ahead);
  }
};

const flushed = () => new Promise<void>((resolve) => setImmediate(resolve));

class World {
  readonly log = new SteppedLog();
  readonly faults = new Map<unknown, Fault>();
  readonly feed = new FaultyFeed(
    (message) => this.faults.get(message.data.topic) ?? 'none',
  );
  readonly notices = new LiveNotices(this.feed, this.log, logger);
  readonly streams = new LiveStreams(this.feed, this.log, () => 0, logger);
  readonly worker = new LiveNoticeRetentionWorker(
    this.log,
    new Leadership(null, new Instance('http://10.0.0.2:3000'), logger),
    {
      now: () => new Date(this.log.now),
      sleep: async () => undefined,
    },
    logger,
  );
  readonly written: ChangeNotice[] = [];
  readonly sessions: Session[] = [];
  readonly clients: Record<Client, ClientState> = {
    a: freshClient(),
    b: freshClient(),
  };

  write(notices: readonly Written[]): void {
    const changes = notices.map(({ channel, ids, fault }) => {
      const topic = `notice_${this.written.length}`;
      const notice = { channel, topic, ids };
      this.faults.set(topic, fault);
      this.written.push(notice);

      return notice;
    });

    this.notices.publish(changes);
  }

  open(client: Client, since: Since): void {
    const state = this.clients[client];
    state.session?.subscription.unsubscribe();

    if (since.kind === 'given') {
      state.applied = new Map(
        WATCHED.flatMap((channel, at) => {
          const offset = since.offsets[at] ?? null;

          return offset === null
            ? []
            : [
                [channel, Math.max(0, this.log.headOf(channel) + offset)] as [
                  string,
                  number,
                ],
              ];
        }),
      );
    }

    state.ahead = new Map();
    state.stale = false;

    const positions: LivePositions = new Map(
      WATCHED.flatMap((channel) => {
        const applied = state.applied.get(channel);

        return applied === undefined ? [] : [[channel, applied] as const];
      }),
    );
    const heard: Heard[] = [];
    const subscription = this.streams
      .open(WATCHED, positions)
      .subscribe((event) => {
        heard.push(event);
        this.received(state, event);
      });
    const session: Session = {
      client,
      since: positions,
      heard,
      fed: this.feed.lastFed,
      subscription,
    };

    state.session = session;
    this.sessions.push(session);
  }

  close(client: Client): void {
    const state = this.clients[client];
    state.session?.subscription.unsubscribe();
    state.session = null;
  }

  private received(state: ClientState, event: Heard): void {
    if (event.type === 'resync') {
      state.stale = true;
      return;
    }

    if (event.type === 'ready') {
      const ready = readyIn([event]);

      if (ready?.complete) {
        for (const [channel, head] of ready.heads) {
          state.applied.set(
            channel,
            Math.max(state.applied.get(channel) ?? 0, head),
          );
          absorbed(state, channel);
        }
      } else {
        state.reloads += 1;

        for (const channel of new Set([
          ...state.applied.keys(),
          ...(ready?.heads.keys() ?? []),
        ])) {
          state.applied.set(
            channel,
            ready?.heads.get(channel) ??
              Math.max(
                state.applied.get(channel) ?? 0,
                ...(state.ahead.get(channel) ?? []),
              ),
          );
        }

        state.ahead.clear();
      }

      state.stale ||= WATCHED.some((channel) => !state.applied.has(channel));
      return;
    }

    const position = positionIn(event);

    if (!position || !state.applied.has(position.channel)) {
      return;
    }

    const ahead = state.ahead.get(position.channel) ?? new Set<number>();
    ahead.add(position.sequence);
    state.ahead.set(position.channel, ahead);
    absorbed(state, position.channel);
    state.stale ||= state.ahead.size > 0;
  }

  async settled(): Promise<void> {
    await flushed();

    while (
      this.log.pending() ||
      this.feed.late.length > 0 ||
      this.feed.owesResync
    ) {
      this.log.number(0, false);
      this.log.answer(0);
      this.log.read(0, false);
      this.feed.deliverLate(0);
      await flushed();

      if (this.feed.owesResync && this.feed.late.length === 0) {
        this.feed.resync();
      }

      await flushed();
    }
  }

  async caughtUp(): Promise<void> {
    await this.settled();

    for (let round = 0; round < 5; round++) {
      const behind = CLIENTS.filter(
        (client) =>
          this.clients[client].stale || this.clients[client].session === null,
      );

      if (behind.length === 0) {
        return;
      }

      for (const client of behind) {
        this.open(client, { kind: 'applied' });
      }

      await this.settled();
    }
  }

  end(): void {
    for (const session of this.sessions) {
      session.subscription.unsubscribe();
    }
  }
}

const apply = async (world: World, step: Step): Promise<void> => {
  switch (step.kind) {
    case 'write':
      world.write(step.notices);
      break;
    case 'number':
      world.log.number(step.pick, step.fails);
      break;
    case 'answer':
      world.log.answer(step.pick);
      break;
    case 'open':
      world.open(step.client, step.since);
      break;
    case 'read':
      world.log.read(step.pick, step.fails);
      break;
    case 'close':
      world.close(step.client);
      break;
    case 'late':
      world.feed.deliverLate(step.pick);
      break;
    case 'wait':
      world.log.now += step.ms;
      break;
    case 'resync':
      world.feed.resync();
      break;
    case 'prune':
      await world.worker.sweep();
      break;
  }

  await flushed();
};

const walked = async (steps: readonly Step[]): Promise<World> => {
  const world = new World();

  try {
    for (const step of steps) {
      await apply(world, step);
    }

    await world.caughtUp();
  } finally {
    world.end();
  }

  return world;
};

const written: fc.Arbitrary<Written> = fc.record({
  channel: fc.oneof(
    { weight: 6, arbitrary: fc.constantFrom(...WATCHED) },
    { weight: 1, arbitrary: fc.constantFrom(...ELSEWHERE) },
  ),
  ids: fc.constantFrom<Readonly<Record<string, string>>>(
    {},
    { taskId: 'task_1' },
    { taskId: 'task_2', teamId: 'team_1' },
  ),
  fault: fc.oneof(
    { weight: 12, arbitrary: fc.constant<Fault>('none') },
    { weight: 1, arbitrary: fc.constantFrom<Fault>('lost', 'twice', 'late') },
  ),
});

const offset = (above: number) =>
  fc.oneof(
    { weight: 1, arbitrary: fc.constant(null) },
    { weight: 6, arbitrary: fc.integer({ min: -6, max: above }) },
  );

const resumed = (above: number): fc.Arbitrary<Since> =>
  fc.oneof(
    { weight: 3, arbitrary: fc.constant<Since>({ kind: 'applied' }) },
    {
      weight: 2,
      arbitrary: fc.record({
        kind: fc.constant('given' as const),
        offsets: fc.tuple(offset(above), offset(above), offset(above)),
      }),
    },
  );

const client = fc.constantFrom(...CLIENTS);
const pick = fc.nat({ max: 20 });
const rarely = fc.oneof(
  { weight: 9, arbitrary: fc.constant(false) },
  { weight: 1, arbitrary: fc.constant(true) },
);

const stepOf = (above: number): fc.Arbitrary<Step> =>
  fc.oneof(
    {
      weight: 6,
      arbitrary: fc.record({
        kind: fc.constant('write' as const),
        notices: fc.array(written, { minLength: 1, maxLength: 3 }),
      }),
    },
    {
      weight: 5,
      arbitrary: fc.record({
        kind: fc.constant('number' as const),
        pick,
        fails: rarely,
      }),
    },
    {
      weight: 5,
      arbitrary: fc.record({ kind: fc.constant('answer' as const), pick }),
    },
    {
      weight: 3,
      arbitrary: fc.record({
        kind: fc.constant('open' as const),
        client,
        since: resumed(above),
      }),
    },
    {
      weight: 4,
      arbitrary: fc.record({
        kind: fc.constant('read' as const),
        pick,
        fails: rarely,
      }),
    },
    {
      weight: 1,
      arbitrary: fc.record({ kind: fc.constant('close' as const), client }),
    },
    {
      weight: 1,
      arbitrary: fc.record({ kind: fc.constant('late' as const), pick }),
    },
    {
      weight: 2,
      arbitrary: fc.record({
        kind: fc.constant('wait' as const),
        ms: fc.oneof(
          fc.integer({ min: 0, max: HOUR_MS }),
          fc.integer({ min: 20 * HOUR_MS, max: 30 * HOUR_MS }),
        ),
      }),
    },
    { weight: 1, arbitrary: fc.constant<Step>({ kind: 'resync' }) },
    { weight: 2, arbitrary: fc.constant<Step>({ kind: 'prune' }) },
  );

const walks = (above: number) =>
  fc.array(stepOf(above), { maxLength: 80, size: 'max' });

const RUNS = { numRuns: 200 };

const walking = (holds: (world: World) => boolean, above = 0) =>
  fc.asyncProperty(walks(above), async (steps) => holds(await walked(steps)));

const replayedIn = (session: Session, ready: Ready) =>
  session.heard.slice(0, ready.at);

const rowOf = (world: World, position: Position) =>
  world.log.appended.find(
    (row) =>
      row.channel === position.channel && row.sequence === position.sequence,
  );

const sameNotice = (
  event: Heard,
  notice: { readonly topic: string; readonly ids: object },
) =>
  fieldOf(event, 'topic') === notice.topic &&
  JSON.stringify(fieldOf(event, 'ids')) === JSON.stringify(notice.ids);

const leavesNoSilentGap = (world: World) =>
  world.sessions.every((session) => {
    const ready = readyIn(session.heard);

    if (!ready) {
      return true;
    }

    const sent = new Set(
      session.heard
        .map(positionIn)
        .flatMap((position) =>
          position ? [`${position.channel}@${position.sequence}`] : [],
        ),
    );

    return session.fed.every((message) => {
      const position = positionOfFed(message);

      if (!position) {
        return true;
      }

      const floor = ready.complete
        ? (ready.heads.get(position.channel) ?? 0)
        : (ready.heads.get(position.channel) ??
          session.since.get(position.channel as LiveChannel) ??
          0);

      return (
        position.sequence <= floor ||
        sent.has(`${position.channel}@${position.sequence}`)
      );
    });
  });

describe('live streams under random publishes, reconnects, trims and feed faults', () => {
  it('replays the missed notices once each, in order and with no gap, before it says it is ready', async () => {
    await fc.assert(
      walking((world) =>
        world.sessions.every((session) => {
          const ready = readyIn(session.heard);

          if (!ready) {
            return true;
          }

          const replayed = replayedIn(session, ready);

          return (
            replayed.every((event) => positionIn(event) !== null) &&
            WATCHED.every((channel) => {
              const sequences = replayed
                .map(positionIn)
                .flatMap((position) =>
                  position?.channel === channel ? [position.sequence] : [],
                );
              const from = session.since.get(channel);

              return (
                (sequences.length === 0 || from !== undefined) &&
                sequences.every(
                  (sequence, at) => sequence === (from ?? 0) + at + 1,
                ) &&
                (!ready.complete ||
                  (from !== undefined &&
                    (sequences[sequences.length - 1] ?? from) ===
                      ready.heads.get(channel)))
              );
            })
          );
        }),
      ),
      RUNS,
    );
  }, 120_000);

  it('says it is complete exactly when the log still holds every notice the client missed', async () => {
    await fc.assert(
      walking((world) =>
        world.sessions.every((session) => {
          const ready = readyIn(session.heard);
          const read = world.log.reads.find(
            (each) => each.since === session.since,
          );

          return (
            !ready ||
            !read ||
            ready.complete === (!read.failed && read.holdsEveryMissed)
          );
        }),
      ),
      RUNS,
    );
  }, 120_000);

  it('passes on every later notice the feed brings, so a client never misses one silently', async () => {
    await fc.assert(walking(leavesNoSilentGap), RUNS);
  }, 120_000);

  it('sends a notice once, unless the feed itself brought it twice', async () => {
    await fc.assert(
      walking((world) =>
        world.sessions.every((session) => {
          const ready = readyIn(session.heard);
          const replayed = new Set(
            (ready ? replayedIn(session, ready) : [])
              .map(positionIn)
              .flatMap((position) =>
                position ? [`${position.channel}@${position.sequence}`] : [],
              ),
          );
          const countOf = (list: readonly (Position | null)[], key: string) =>
            list.filter(
              (position) =>
                position && `${position.channel}@${position.sequence}` === key,
            ).length;
          const passed = session.heard
            .slice(ready ? ready.at + 1 : session.heard.length)
            .map(positionIn);
          const fed = session.fed.map(positionOfFed);

          return passed.every((position) => {
            if (!position) {
              return true;
            }

            const key = `${position.channel}@${position.sequence}`;

            return (
              !replayed.has(key) && countOf(passed, key) <= countOf(fed, key)
            );
          });
        }),
      ),
      RUNS,
    );
  }, 120_000);

  it('sends a client only real notices of the channels it watches', async () => {
    await fc.assert(
      walking((world) =>
        world.sessions.every((session) =>
          session.heard
            .filter((event) => event.type === 'changed')
            .every((event) => {
              const channel = fieldOf(event, 'channel');
              const position = positionIn(event);
              const row = position ? rowOf(world, position) : undefined;
              const notice = world.written.find(
                (each) => each.topic === fieldOf(event, 'topic'),
              );

              return (
                WATCHED.some((each) => each === channel) &&
                notice !== undefined &&
                notice.channel === channel &&
                sameNotice(event, notice) &&
                (!position || (row !== undefined && sameNotice(event, row)))
              );
            }),
        ),
      ),
      RUNS,
    );
  }, 120_000);

  it('publishes every notice once on its channel, with the sequence the log gave it or none when numbering failed', async () => {
    await fc.assert(
      walking((world) =>
        world.written.every((notice) => {
          const published = world.feed.published.filter(
            (each) => each.message.data.topic === notice.topic,
          );
          const row = world.log.appended.find(
            (each) => each.topic === notice.topic,
          );

          return (
            published.length === 1 &&
            published.every(
              ({ channel, message }) =>
                channel === notice.channel &&
                message.data.channel === notice.channel &&
                message.data.sequence === row?.sequence,
            )
          );
        }),
      ),
      RUNS,
    );
  }, 120_000);

  it('brings a client that reopens on a gap or a resync up to every head, or tells it to fetch everything again', async () => {
    await fc.assert(
      walking((world) =>
        CLIENTS.every((each) => {
          const state = world.clients[each];

          return (
            !state.stale &&
            state.ahead.size === 0 &&
            WATCHED.every(
              (channel) =>
                state.applied.get(channel) === world.log.headOf(channel),
            )
          );
        }),
      ),
      RUNS,
    );
  }, 120_000);

  it.fails('passes on every later notice to a client that resumes from beyond the head', async () => {
    await fc.assert(walking(leavesNoSilentGap, 3), RUNS);
  }, 120_000);
});
