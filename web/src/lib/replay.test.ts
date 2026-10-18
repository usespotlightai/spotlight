import { describe, expect, it } from 'vitest';
import type {
  EntryComparison,
  Replay,
  ReplayEntry,
  ReplaySet,
} from '@/lib/replay';
import {
  ceilingFrom,
  ceilingRate,
  comparisonInOrder,
  flippedTitles,
  formatCostDelta,
  formatJudgeScore,
  formatMsDelta,
  formatReference,
  latestOf,
  meanCostOf,
  meanMsOf,
  referenceLabel,
  referenceNoun,
  referenceRateOf,
  repeatsFrom,
  repeatsTally,
  replayPath,
  replaySetPath,
  spendBreakdown,
  startProblem,
  stationKeyPath,
} from '@/lib/replay';

const candidate = (kind: 'proposed' | 'searched' | 'oracle') =>
  ({ kind }) as Replay['candidate'];

const reference = (
  replayId: string,
  successRate: number | null,
  kind: 'proposed' | 'searched' | 'oracle' = 'proposed',
) => ({
  candidate: candidate(kind),
  referenceReplay: {
    replayId,
    successRate,
    interval:
      successRate === null
        ? null
        : { rate: successRate, low: successRate - 0.25, high: successRate },
  },
});

const repeat = (
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

  it('shows the rate of the replay the gain is against, named for what it is', () => {
    expect(referenceRateOf(reference('base', 0.5), 'base')).toEqual({
      label: 'Baseline',
      successRate: 0.5,
      interval: { rate: 0.5, low: 0.25, high: 0.5 },
    });
    expect(
      referenceRateOf(reference('live', 0.75, 'oracle'), 'base'),
    ).toMatchObject({ label: 'Live config', successRate: 0.75 });
  });

  it('shows no reference for a replay compared with nothing', () => {
    expect(
      referenceRateOf(
        { candidate: candidate('proposed'), referenceReplay: null },
        'base',
      ),
    ).toBeNull();
  });

  it('names a reference that has scored nothing yet, with no rate', () => {
    expect(referenceRateOf(reference('live', null, 'oracle'), 'base')).toEqual({
      label: 'Live config',
      successRate: null,
      interval: null,
    });
  });

  it('names the reference in lower case inside a sentence', () => {
    expect(referenceNoun({ label: 'Search’s starting config' })).toBe(
      'search’s starting config',
    );
    expect(referenceNoun({ label: 'Baseline' })).toBe('baseline');
  });

  it('reads repeats as a whole number from 1 to 5', () => {
    expect(repeatsFrom('3')).toBe(3);
    expect(repeatsFrom('0')).toBe('Please enter a whole number from 1 to 5.');
    expect(repeatsFrom('6')).toBe('Please enter a whole number from 1 to 5.');
    expect(repeatsFrom('2.5')).toBe('Please enter a whole number from 1 to 5.');
  });

  it('tallies a task’s repeats and averages their cost and time', () => {
    const repeats = [
      repeat('succeeded', 0.5, 60_000),
      repeat('failed', 1.5, null),
      repeat('unscored', 1, 120_000),
    ];

    expect(repeatsTally(repeats)).toEqual({ succeeded: 1, scored: 2 });
    expect(meanCostOf(repeats)).toEqual({ amount: 1, currency: 'USD' });
    expect(meanMsOf(repeats)).toBe(90_000);
    expect(meanCostOf([repeat('pending', null, null)])).toBeNull();
    expect(meanMsOf([repeat('pending', null, null)])).toBeNull();
  });

  it('names the tasks whose repeats went both ways', () => {
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

  it('takes the newest replay as the latest', () => {
    expect(
      latestOf([
        { startedAt: '2026-10-01T09:00:00.000Z', id: 'old' },
        { startedAt: '2026-10-02T09:00:00.000Z', id: 'new' },
      ] as Replay[])?.id,
    ).toBe('new');
    expect(latestOf([])).toBeNull();
  });

  it('splits what a replay spent into its runs, generation, judging and side-by-side judging, in its ceiling’s currency', () => {
    const usd = (amount: number) => ({ amount, currency: 'USD' });

    expect(
      spendBreakdown({
        ceiling: usd(5),
        entries: [
          {
            cost: usd(1),
            generationSpent: { spends: [usd(0.1)], unpriced: 0 },
            judgingSpent: null,
            pairingSpent: { spends: [usd(0.05)], unpriced: 0 },
          },
          {
            cost: { amount: 9, currency: 'EUR' },
            generationSpent: null,
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
      generation: usd(0.1),
      judging: usd(0.2),
      pairing: usd(0.05),
    });
  });

  it('caps the share of the ceiling spent at all of it', () => {
    const usd = (amount: number) => ({ amount, currency: 'USD' });

    expect(ceilingRate(usd(1), usd(4))).toBe(0.25);
    expect(ceilingRate(usd(6), usd(4))).toBe(1);
  });

  it('signs deltas, and shows none where there is none', () => {
    expect(formatCostDelta(-0.1, 'USD')).toBe('−$0.10');
    expect(formatCostDelta(null, 'USD')).toBe('–');
    expect(formatMsDelta(90_000)).toBe('+1m 30s');
  });

  it('names what a replay was set beside: the baseline, the search’s starting config, the live config or an earlier baseline', () => {
    expect(formatReference('base', candidate('proposed'), 'base')).toBe(
      'the baseline',
    );
    expect(formatReference('seed', candidate('searched'), 'base')).toBe(
      'the search’s starting config',
    );
    expect(formatReference('live', candidate('oracle'), 'base')).toBe(
      'the live config',
    );
    expect(formatReference('older', candidate('proposed'), 'base')).toBe(
      'an earlier baseline',
    );
  });

  it('labels what a replay is compared with, as a short noun', () => {
    expect(referenceLabel('base', candidate('oracle'), 'base')).toBe(
      'Baseline',
    );
    expect(referenceLabel('seed', candidate('searched'), 'base')).toBe(
      'Search’s starting config',
    );
    expect(referenceLabel('live', candidate('oracle'), 'base')).toBe(
      'Live config',
    );
    expect(referenceLabel('older', candidate('proposed'), 'base')).toBe(
      'Earlier baseline',
    );
    expect(referenceLabel('older', null, null)).toBe('Earlier baseline');
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
      claimResults: null,
      passThreshold: null,
      claims: [],
      reasons: [],
    });

    expect(formatJudgeScore(judged('yes-no', 1))).toBe('Yes');
    expect(formatJudgeScore(judged('number', 4))).toBe('4/5');
    expect(formatJudgeScore(null)).toBe('–');
    expect(
      formatJudgeScore({
        ...judged('number', 2 / 3),
        scale: 'claims',
        claimResults: [true, true, false],
        passThreshold: 1,
      }),
    ).toBe('2 of 3 claims met');
  });

  it('joins a station’s team, line and station keys into its path', () => {
    expect(stationKeyPath('core', 'delivery', 'build')).toBe(
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

  it('says why a replay of a set with no runs, or whose station is gone, cannot start', () => {
    const set = (over: Partial<ReplaySet>) =>
      ({ stationGone: false, entries: [{}], ...over }) as ReplaySet;

    expect(startProblem(set({}))).toBeNull();
    expect(startProblem(set({ entries: [] }))).toBe(
      'Please add runs to the set first.',
    );
    expect(startProblem(set({ stationGone: true }))).toBe(
      'The station is gone from its line.',
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
