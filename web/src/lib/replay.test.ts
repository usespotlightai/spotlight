import { describe, expect, it } from 'vitest';
import type { EntryComparison, Replay, ReplaySet } from '@/lib/replay';
import {
  ceilingFrom,
  ceilingShare,
  comparisonInOrder,
  costDeltaShown,
  judgeScoreShown,
  latestOf,
  msDeltaShown,
  proposeCommand,
  replayPath,
  replaySetPath,
  spendBreakdown,
  startRefusal,
  stationAddress,
  successAgainst,
} from '@/lib/replay';

const totals = (successRate: number | null) =>
  ({ successRate }) as unknown as Replay['totals'];

const replay = (id: string, successRate: number | null) => ({
  id,
  totals: totals(successRate),
});

const row = (originalRunId: string, regressed: boolean) =>
  ({ originalRunId, regressed }) as EntryComparison;

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

describe('replays', () => {
  it('lists regressions first, keeping each group in the order given', () => {
    expect(
      comparisonInOrder([
        row('a', false),
        row('b', true),
        row('c', false),
        row('d', true),
      ]).map((each) => each.originalRunId),
    ).toEqual(['b', 'd', 'a', 'c']);
  });

  it('compares the success rate with the baseline in points', () => {
    expect(successAgainst(replay('r', 0.75), replay('b', 0.5))).toEqual({
      now: '75% succeeded',
      baseline: '50%',
      delta: { shown: '+25 pts', tone: 'good' },
    });
    expect(successAgainst(replay('r', 0.25), replay('b', 0.5)).delta).toEqual({
      shown: '−25 pts',
      tone: 'bad',
    });
  });

  it('compares nothing with itself, nor before anything is scored', () => {
    expect(successAgainst(replay('b', 0.5), replay('b', 0.5)).delta).toBeNull();
    expect(successAgainst(replay('r', null), replay('b', 0.5))).toEqual({
      now: 'No score yet',
      baseline: '50%',
      delta: null,
    });
  });

  it('takes the newest replay as the latest', () => {
    expect(
      latestOf([
        { startedAt: '2026-10-01T09:00:00.000Z', id: 'old' },
        { startedAt: '2026-10-02T09:00:00.000Z', id: 'new' },
      ] as Replay[])?.id,
    ).toBe('new');
    expect(latestOf([])).toBeNull();
  });

  it('splits what a replay spent into its runs, drafting and judging, in its ceiling’s currency', () => {
    const usd = (amount: number) => ({ amount, currency: 'USD' });

    expect(
      spendBreakdown({
        ceiling: usd(5),
        entries: [
          {
            cost: usd(1),
            draftingSpent: { spends: [usd(0.1)], unpriced: 0 },
            judgingSpent: null,
          },
          {
            cost: { amount: 9, currency: 'EUR' },
            draftingSpent: null,
            judgingSpent: {
              spends: [usd(0.2), { amount: 1, currency: 'EUR' }],
              unpriced: 1,
            },
          },
        ] as Replay['entries'],
      }),
    ).toEqual({ runs: usd(1), drafting: usd(0.1), judging: usd(0.2) });
  });

  it('caps the share of the ceiling spent at all of it', () => {
    const usd = (amount: number) => ({ amount, currency: 'USD' });

    expect(ceilingShare(usd(1), usd(4))).toBe(0.25);
    expect(ceilingShare(usd(6), usd(4))).toBe(1);
  });

  it('signs deltas, and shows none where there is none', () => {
    expect(costDeltaShown(-0.1, 'USD')).toBe('−$0.10');
    expect(costDeltaShown(null, 'USD')).toBe('–');
    expect(msDeltaShown(90_000)).toBe('+1m 30s');
  });

  it('shows a judge’s score on its own scale', () => {
    const judged = (scale: 'yes-no' | 'number', score: number) => ({
      state: 'judged' as const,
      scale,
      score,
      passed: null,
      referenced: null,
      model: null,
      unjudged: null,
    });

    expect(judgeScoreShown(judged('yes-no', 1))).toBe('Yes');
    expect(judgeScoreShown(judged('number', 4))).toBe('4/5');
    expect(judgeScoreShown(null)).toBe('–');
  });

  it('fills the station address into the propose command', () => {
    expect(proposeCommand(stationAddress('core', 'delivery', 'build'))).toBe(
      'spotlight replay propose --station core/delivery/build --name <name> <station.json>',
    );
  });

  it('takes a ceiling above nothing and at most a thousand, in three letters of currency', () => {
    expect(ceilingFrom('5', 'USD')).toEqual({ amount: 5, currency: 'USD' });
    expect(ceilingFrom('0', 'USD')).toBe('Give a ceiling above nothing.');
    expect(ceilingFrom('', 'USD')).toBe('Give a ceiling above nothing.');
    expect(ceilingFrom('1001', 'USD')).toBe('A ceiling is at most 1,000.');
    expect(ceilingFrom('5', 'US')).toBe(
      'Name the currency in three letters, like USD.',
    );
  });

  it('refuses to start a replay of a set with no runs, or whose station is gone', () => {
    const set = (over: Partial<ReplaySet>) =>
      ({ stationGone: false, entries: [{}], ...over }) as ReplaySet;

    expect(startRefusal(set({}))).toBeNull();
    expect(startRefusal(set({ entries: [] }))).toBe(
      'Add runs to the set first.',
    );
    expect(startRefusal(set({ stationGone: true }))).toBe(
      'Its station is gone from its line.',
    );
  });

  it('places sets and replays under their station', () => {
    expect(replaySetPath(AT, 'set_1')).toBe(
      '/w/acme/team/team_1/lines/line_1/stations/station_1/replay-sets/set_1',
    );
    expect(replayPath(AT, 'replay_1')).toBe(
      '/w/acme/team/team_1/lines/line_1/stations/station_1/replays/replay_1',
    );
  });
});
