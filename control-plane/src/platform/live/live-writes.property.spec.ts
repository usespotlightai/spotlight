import type { SequencedNotice } from '@platform/live/change-notices';
import type { LiveChannel } from '@platform/live/live-feed.port';
import { LiveWrites } from '@platform/live/live-writes';
import fc from 'fast-check';
import { describe, it } from 'vitest';

const CHANNELS: readonly LiveChannel[] = [
  'workspace:ws_1',
  'workspace:ws_2',
  'person:user_1',
];

interface Publish {
  readonly notices: readonly {
    readonly channel: LiveChannel;
    readonly sequence: number | null;
  }[];
  readonly hops: number;
  readonly outside: boolean;
}

interface Request {
  readonly before: number;
  readonly publishes: readonly Publish[];
}

const publish: fc.Arbitrary<Publish> = fc.record({
  notices: fc.array(
    fc.record({
      channel: fc.constantFrom(...CHANNELS),
      sequence: fc.oneof(
        { weight: 6, arbitrary: fc.integer({ min: 1, max: 40 }) },
        { weight: 1, arbitrary: fc.constant(null) },
      ),
    }),
    { maxLength: 3 },
  ),
  hops: fc.nat({ max: 6 }),
  outside: fc.oneof(
    { weight: 5, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
});

const request: fc.Arbitrary<Request> = fc.record({
  before: fc.nat({ max: 4 }),
  publishes: fc.array(publish, { maxLength: 4 }),
});

const hopped = async (hops: number): Promise<void> => {
  for (let each = 0; each < hops; each++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
};

const sequencedOf = (each: Publish): readonly SequencedNotice[] =>
  each.notices.map(({ channel, sequence }) => ({
    channel,
    topic: 'task',
    ids: {},
    sequence,
  }));

const served = async (each: Request): Promise<string | null> => {
  const published: Promise<readonly SequencedNotice[]>[] = [];

  await LiveWrites.within(published, async () => {
    await hopped(each.before);

    for (const one of each.publishes) {
      const tracked = hopped(one.hops).then(() => sequencedOf(one));

      if (one.outside) {
        LiveWrites.outside(() => LiveWrites.track(tracked));
      } else {
        LiveWrites.track(tracked);
      }

      await hopped(1);
    }
  });

  return LiveWrites.headerOf(published);
};

const expectedHeader = (each: Request): string | null => {
  const last = new Map<string, number>();

  for (const one of each.publishes.filter((publish) => !publish.outside)) {
    for (const { channel, sequence } of one.notices) {
      if (sequence !== null) {
        last.set(channel, Math.max(last.get(channel) ?? 0, sequence));
      }
    }
  }

  return last.size === 0
    ? null
    : [...last]
        .map(([channel, sequence]) => `${channel}@${sequence}`)
        .sort()
        .join(',');
};

const sorted = (header: string | null) =>
  header === null ? null : header.split(',').sort().join(',');

describe('LiveWrites across requests served at the same time', () => {
  it('tells each write the last sequence of its own changes on each channel, and nothing of the others', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(request, { minLength: 1, maxLength: 5 }),
        async (requests) => {
          const headers = await Promise.all(requests.map(served));

          return requests.every(
            (each, at) => sorted(headers[at] ?? null) === expectedHeader(each),
          );
        },
      ),
      { numRuns: 300 },
    );
  });
});
