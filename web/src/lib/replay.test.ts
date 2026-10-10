import { describe, expect, it } from 'vitest';
import type {
  EntryComparison,
  Replay,
  ReplayEntry,
  ReplaySet,
} from '@/lib/replay';
import {
  baselineTotalsFor,
  ceilingFrom,
  ceilingShare,
  comparisonInOrder,
  copiesTally,
  costDeltaShown,
  counterpartShown,
  flippedTitles,
  judgeScoreShown,
  latestOf,
  meanCostOf,
  meanMsOf,
  msDeltaShown,
  repeatsFrom,
  replayPath,
  replaySetPath,
  spendBreakdown,
  startRefusal,
  stationAddress,
  strongerAsked,
  strongerProblem,
  strongerRefusal,
} from '@/lib/replay';

const totals = (successRate: number | null) =>
  ({ successRate }) as unknown as Replay['totals'];

const replay = (id: string, successRate: number | null) => ({
  id,
  totals: totals(successRate),
});

const copy = (
  result: ReplayEntry['result'],
  amount: number | null,
  ms: number | null,
) =>
  ({
    result,
    cost: amount === null ? null : { amount, currency: 'USD' },
    ms,
  }) as ReplayEntry;

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

  it('compares with the baseline’s totals, but not the baseline with itself', () => {
    expect(
      baselineTotalsFor(replay('r', 0.75), replay('b', 0.5))?.successRate,
    ).toBe(0.5);
    expect(baselineTotalsFor(replay('b', 0.5), replay('b', 0.5))).toBeNull();
    expect(baselineTotalsFor(replay('r', 0.75), null)).toBeNull();
  });

  it('reads repeats as a whole number from 1 to 5', () => {
    expect(repeatsFrom('3')).toBe(3);
    expect(repeatsFrom('0')).toBe('Please enter a whole number from 1 to 5.');
    expect(repeatsFrom('6')).toBe('Please enter a whole number from 1 to 5.');
    expect(repeatsFrom('2.5')).toBe('Please enter a whole number from 1 to 5.');
  });

  it('tallies a task’s copies and averages their cost and time', () => {
    const copies = [
      copy('succeeded', 0.5, 60_000),
      copy('failed', 1.5, null),
      copy('unscored', 1, 120_000),
    ];

    expect(copiesTally(copies)).toEqual({ succeeded: 1, scored: 2 });
    expect(meanCostOf(copies)).toEqual({ amount: 1, currency: 'USD' });
    expect(meanMsOf(copies)).toBe(90_000);
    expect(meanCostOf([copy('pending', null, null)])).toBeNull();
    expect(meanMsOf([copy('pending', null, null)])).toBeNull();
  });

  it('names the tasks whose copies went both ways', () => {
    const set = {
      entries: [
        { taskId: 'task_a', title: 'Fix the queue' },
        { taskId: 'task_b', title: null },
      ],
    } as ReplaySet;

    expect(
      flippedTitles(set, {
        flippedTasks: ['task_a', 'task_b'],
      } as never),
    ).toEqual(['Fix the queue', 'A deleted task']);
  });

  it('asks only for what differs from the live config, and nothing when nothing does', () => {
    const live = { harness: 'claude-code', model: 'sonnet', effort: 'medium' };

    expect(strongerAsked(live, 'opus', 'medium')).toEqual({ model: 'opus' });
    expect(strongerAsked(live, 'sonnet', 'high')).toEqual({ effort: 'high' });
    expect(strongerAsked(live, 'sonnet', 'medium')).toBeNull();
    expect(strongerAsked(live, '', '')).toBeNull();
  });

  it('wants a model the harness offers, or an effort higher than the live one', () => {
    const live = { harness: 'claude-code', model: 'sonnet', effort: 'medium' };
    const offer = {
      models: ['sonnet', 'opus'],
      efforts: ['low', 'medium', 'high'],
    };

    expect(strongerProblem(live, 'opus', 'high', offer)).toBeNull();
    expect(strongerProblem(live, 'sonnet', 'medium', offer)).toBe(
      'Choose a model or effort other than the live config’s.',
    );
    expect(strongerProblem(live, 'sonnet', 'low', offer)).toBe(
      'Effort isn’t higher than the live config’s. Pick a higher one, or keep the live effort.',
    );
    expect(strongerProblem(live, 'haiku', 'medium', offer)).toBe(
      'Harness doesn’t offer that model.',
    );
    expect(
      strongerProblem({ ...live, effort: null }, 'sonnet', 'low', offer),
    ).toBe(
      'Effort isn’t higher than the live config’s. Pick a higher one, or keep the live effort.',
    );
    expect(
      strongerProblem({ ...live, effort: null }, 'sonnet', 'medium', offer),
    ).toBeNull();
  });

  it('cannot try a stronger model at a station without a harness', () => {
    const set = {
      stationGone: false,
      entries: [{ taskId: 'task_a' }],
    } as ReplaySet;

    expect(
      strongerRefusal(set, { harness: null, model: null, effort: null }),
    ).toBe('Station names no harness. No model to choose.');
    expect(
      strongerRefusal(set, {
        harness: 'claude-code',
        model: null,
        effort: null,
      }),
    ).toBeNull();
    expect(
      strongerRefusal(
        { ...set, entries: [] },
        { harness: 'claude-code', model: null, effort: null },
      ),
    ).toBe('Add runs to the set first.');
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

  it('splits what a replay spent into its runs, drafting, judging and side-by-side judging, in its ceiling’s currency', () => {
    const usd = (amount: number) => ({ amount, currency: 'USD' });

    expect(
      spendBreakdown({
        ceiling: usd(5),
        entries: [
          {
            cost: usd(1),
            draftingSpent: { spends: [usd(0.1)], unpriced: 0 },
            judgingSpent: null,
            pairingSpent: { spends: [usd(0.05)], unpriced: 0 },
          },
          {
            cost: { amount: 9, currency: 'EUR' },
            draftingSpent: null,
            judgingSpent: {
              spends: [usd(0.2), { amount: 1, currency: 'EUR' }],
              unpriced: 1,
            },
            pairingSpent: null,
          },
        ] as Replay['entries'],
      }),
    ).toEqual({
      runs: usd(1),
      drafting: usd(0.1),
      judging: usd(0.2),
      pairing: usd(0.05),
    });
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

  it('names what a replay was set beside: the baseline, the search’s starting config, the live config or an earlier baseline', () => {
    const candidate = (kind: 'proposed' | 'searched' | 'sanity') =>
      ({ kind }) as Replay['candidate'];

    expect(counterpartShown('base', candidate('proposed'), 'base')).toBe(
      'the baseline',
    );
    expect(counterpartShown('seed', candidate('searched'), 'base')).toBe(
      'the search’s starting config',
    );
    expect(counterpartShown('live', candidate('sanity'), 'base')).toBe(
      'the live config',
    );
    expect(counterpartShown('older', candidate('proposed'), 'base')).toBe(
      'an earlier baseline',
    );
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
      marks: null,
      passShare: null,
      claims: [],
      reasons: [],
    });

    expect(judgeScoreShown(judged('yes-no', 1))).toBe('Yes');
    expect(judgeScoreShown(judged('number', 4))).toBe('4/5');
    expect(judgeScoreShown(null)).toBe('–');
    expect(
      judgeScoreShown({
        ...judged('number', 2 / 3),
        scale: 'claims',
        marks: [true, true, false],
        passShare: 1,
      }),
    ).toBe('2 of 3 claims met');
  });

  it('addresses a station by its team, line and station keys', () => {
    expect(stationAddress('core', 'delivery', 'build')).toBe(
      'core/delivery/build',
    );
  });

  it('takes a ceiling above nothing and at most a thousand, in three letters of currency', () => {
    expect(ceilingFrom('5', 'USD')).toEqual({ amount: 5, currency: 'USD' });
    expect(ceilingFrom('0', 'USD')).toBe('Please enter a ceiling above 0.');
    expect(ceilingFrom('', 'USD')).toBe('Please enter a ceiling above 0.');
    expect(ceilingFrom('1001', 'USD')).toBe('Maximum ceiling: 1,000');
    expect(ceilingFrom('5', 'US')).toBe(
      'Please enter a three-letter currency code, like USD.',
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
      'Station is gone from its line.',
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
