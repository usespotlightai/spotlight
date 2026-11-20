import type { SequencedNotice } from '@platform/live/change-notices';
import type { LiveChannel } from '@platform/live/live-feed.port';
import type { ChannelLog } from '@platform/live/live-notice-log.port';
import { REPLAY_LIMIT, replayOf, sinceOf } from '@platform/live/live-replay';
import fc from 'fast-check';
import { describe, it } from 'vitest';

const WATCHED: readonly LiveChannel[] = [
  'workspace:ws_1',
  'workspace:ws_2',
  'person:user_1',
  'person:someone@example.com',
];

const RUNS = { numRuns: 500 };

const junk = fc.constantFrom(
  'workspace:ws_9@4',
  'workspace:ws_1@-1',
  'workspace:ws_2@x',
  'person:user_1@1.5',
  '@3',
  'nonsense',
  '',
);

describe('sinceOf', () => {
  it('reads back every position given on a watched channel, however the values are split, and nothing else', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({
            channel: fc.constantFrom(...WATCHED),
            sequence: fc.oneof(
              fc.nat({ max: 20 }),
              fc.constant(Number.MAX_SAFE_INTEGER),
            ),
          }),
          { selector: (each) => each.channel },
        ),
        fc.array(junk, { maxLength: 4 }),
        fc.array(fc.nat(), { minLength: 8, maxLength: 8 }),
        fc.array(fc.nat({ max: 3 }), { maxLength: 12 }),
        (positions, noise, order, cuts) => {
          const parts = [
            ...positions.map(
              ({ channel, sequence }) => `${channel}@${sequence}`,
            ),
            ...noise,
          ]
            .map((part, at) => ({ part, key: order[at] ?? at }))
            .sort((one, other) => one.key - other.key)
            .map(({ part }) => part);
          const values: string[] = [];
          let at = 0;

          for (const cut of cuts) {
            values.push(parts.slice(at, at + cut).join(','));
            at += cut;
          }

          values.push(parts.slice(at).join(','));

          const read = sinceOf(values, WATCHED);

          return (
            read.size === positions.length &&
            positions.every(
              ({ channel, sequence }) => read.get(channel) === sequence,
            )
          );
        },
      ),
      RUNS,
    );
  });
});

interface ChannelCase {
  readonly head: number;
  readonly from: number | null;
  readonly lost: readonly number[];
}

const channelCase: fc.Arbitrary<ChannelCase> = fc
  .record({
    head: fc.oneof(
      { weight: 3, arbitrary: fc.nat({ max: 12 }) },
      {
        weight: 1,
        arbitrary: fc.integer({
          min: REPLAY_LIMIT - 2,
          max: REPLAY_LIMIT + 14,
        }),
      },
    ),
    back: fc.oneof(
      { weight: 1, arbitrary: fc.constant(null) },
      { weight: 4, arbitrary: fc.integer({ min: -3, max: 12 }) },
      {
        weight: 1,
        arbitrary: fc.integer({ min: REPLAY_LIMIT - 1, max: REPLAY_LIMIT + 1 }),
      },
    ),
    lost: fc.oneof(
      { weight: 3, arbitrary: fc.constant([]) },
      { weight: 1, arbitrary: fc.array(fc.nat({ max: 12 }), { maxLength: 2 }) },
    ),
  })
  .map(({ head, back, lost }) => ({
    head,
    from: back === null ? null : Math.max(0, head - back),
    lost,
  }));

const logOf = (channel: LiveChannel, each: ChannelCase): ChannelLog => {
  const from = each.from ?? 0;
  const lost = new Set(each.lost.map((offset) => from + offset + 1));
  const after: SequencedNotice[] = [];

  for (let sequence = from + 1; sequence <= each.head; sequence++) {
    if (!lost.has(sequence)) {
      after.push({ channel, topic: 'task', ids: {}, sequence });
    }
  }

  return { head: each.head, after };
};

const replayable = ({ head, from, lost }: ChannelCase): boolean =>
  from !== null &&
  from <= head &&
  head - from <= REPLAY_LIMIT &&
  lost.every((offset) => from + offset + 1 > head);

describe('replayOf', () => {
  it('is complete exactly when every channel has a position and the log holds every notice after it, within the limit', () => {
    fc.assert(
      fc.property(fc.tuple(channelCase, channelCase, channelCase), (cases) => {
        const channels = WATCHED.slice(0, cases.length);
        const replay = replayOf(
          channels,
          new Map(
            channels.flatMap((channel, at) => {
              const from = cases[at]?.from;

              return from === null || from === undefined
                ? []
                : [[channel, from] as const];
            }),
          ),
          new Map(
            channels.flatMap((channel, at) => {
              const each = cases[at];

              return each ? [[channel, logOf(channel, each)] as const] : [];
            }),
          ),
        );

        return replay.complete === cases.every(replayable);
      }),
      RUNS,
    );
  });

  it('replays the notices of each channel it can, in order, and reports every head', () => {
    fc.assert(
      fc.property(fc.tuple(channelCase, channelCase, channelCase), (cases) => {
        const channels = WATCHED.slice(0, cases.length);
        const replay = replayOf(
          channels,
          new Map(
            channels.flatMap((channel, at) => {
              const from = cases[at]?.from;

              return from === null || from === undefined
                ? []
                : [[channel, from] as const];
            }),
          ),
          new Map(
            channels.flatMap((channel, at) => {
              const each = cases[at];

              return each ? [[channel, logOf(channel, each)] as const] : [];
            }),
          ),
        );
        const expected = channels.flatMap((channel, at) => {
          const each = cases[at];

          return each && replayable(each)
            ? logOf(channel, each).after.map(
                (notice) => `${notice.channel}@${notice.sequence}`,
              )
            : [];
        });

        return (
          JSON.stringify(
            replay.notices.map(
              (notice) => `${notice.channel}@${notice.sequence}`,
            ),
          ) === JSON.stringify(expected) &&
          channels.every(
            (channel, at) => replay.heads[channel] === cases[at]?.head,
          )
        );
      }),
      RUNS,
    );
  });
});
