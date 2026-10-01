import { describe, expect, it } from 'vitest';
import type { LineResponseDto } from '@/lib/api';
import {
  deltaOf,
  filterValueShown,
  type Headline,
  headlineTiles,
  insightsPath,
  lasted,
  lastPageOf,
  outputDays,
  paramsOf,
  runFailureShown,
  runsShownOf,
  sankeyOf,
  signalShown,
  sliceFilter,
  sliceNamer,
  spreadShown,
  stationNamesOf,
  stationShown,
  taskFailureShown,
  viewOf,
} from '@/lib/insights';

const HOUR = 3_600_000;

const headline = (over: Partial<Headline> = {}): Headline => ({
  spend: { amount: 120, currency: 'USD' },
  unpriced: 0,
  mixedCurrencies: false,
  runs: 40,
  tasks: 10,
  mergedPullRequests: 8,
  closedPullRequests: 2,
  mergeRate: 0.8,
  costPerMerge: { amount: 15, currency: 'USD' },
  taskToMerge: { p50Ms: 26 * HOUR, p90Ms: 72 * HOUR, count: 8 },
  touches: 30,
  touchesPerTask: 3,
  activePeople: 4,
  mergedTaskIds: [],
  peopleIds: [],
  ...over,
});

const LINES = [
  {
    id: 'line_1',
    key: 'delivery',
    name: 'Delivery',
    reactions: [],
    repositories: [],
    stations: [
      {
        id: 'station_build',
        key: 'build',
        name: 'Implementation',
        position: 1,
        color: '#5c66d9',
        kind: 'work',
      },
    ],
  },
] as unknown as LineResponseDto[];

describe('the insights view in the address', () => {
  it('opens on the overview for the last 30 days', () => {
    expect(viewOf(new URLSearchParams())).toEqual({
      tab: 'overview',
      period: '30d',
      filter: {},
      page: 1,
    });
  });

  it('reads the tab, the period, the run filters and the page', () => {
    expect(
      viewOf(
        new URLSearchParams(
          'tab=runs&period=7d&stationId=station_build&outcome=failed&page=3',
        ),
      ),
    ).toEqual({
      tab: 'runs',
      period: '7d',
      filter: { stationId: 'station_build', outcome: 'failed' },
      page: 3,
    });
  });

  it('falls back on what it does not know', () => {
    expect(
      viewOf(new URLSearchParams('tab=nowhere&period=1y&outcome=exploded')),
    ).toEqual({ tab: 'overview', period: '30d', filter: {}, page: 1 });
  });

  it('reads the drill-down filters the runs endpoint takes, and drops bad ones', () => {
    expect(
      viewOf(
        new URLSearchParams(
          'tab=runs&delivery=merged&next=sent-back&asked=true&taskIds=a,b&model=~default&repository=none',
        ),
      ).filter,
    ).toEqual({
      delivery: 'merged',
      next: 'sent-back',
      asked: 'true',
      taskIds: 'a,b',
      model: '~default',
      repository: 'none',
    });
    expect(
      viewOf(
        new URLSearchParams('tab=runs&delivery=lost&next=shrugged&asked=no'),
      ).filter,
    ).toEqual({});
  });

  it('keeps run filters to the runs tab', () => {
    expect(
      viewOf(new URLSearchParams('tab=cost&stationId=station_build')).filter,
    ).toEqual({});
  });

  it('writes only what differs from the defaults', () => {
    expect(
      paramsOf({ tab: 'overview', period: '30d', filter: {}, page: 1 }),
    ).toEqual({});
    expect(
      insightsPath('acme', 'team_1', {
        tab: 'runs',
        period: '90d',
        filter: { day: '2026-09-30' },
        page: 2,
      }),
    ).toBe(
      '/w/acme/team/team_1/insights?tab=runs&period=90d&day=2026-09-30&page=2',
    );
  });

  it('reads the pull request filters on the pull requests tab, and drops bad ones', () => {
    expect(
      viewOf(
        new URLSearchParams(
          'tab=pull-requests&repository=acme/api&author=spotlight&type=fix&state=merged&week=2026-09-28&reverted=true&rounds=3%2B&page=2&stationId=s',
        ),
      ),
    ).toEqual({
      tab: 'pull-requests',
      period: '30d',
      filter: {
        repository: 'acme/api',
        author: 'spotlight',
        type: 'fix',
        state: 'merged',
        week: '2026-09-28',
        reverted: 'true',
        rounds: '3+',
      },
      page: 2,
    });
    expect(
      viewOf(
        new URLSearchParams(
          'tab=pull-requests&author=robots&type=epic&state=draft&week=monday&reverted=no&rounds=9',
        ),
      ).filter,
    ).toEqual({});
  });

  it('keeps pull request filters, so they survive a reload', () => {
    const view = {
      tab: 'pull-requests' as const,
      period: '90d' as const,
      filter: { author: 'people', repository: 'acme/api,acme/web' },
      page: 3,
    };

    expect(viewOf(new URLSearchParams(paramsOf(view)))).toEqual(view);
  });

  it('round-trips through the address', () => {
    const view = {
      tab: 'runs' as const,
      period: '7d' as const,
      filter: { model: 'opus', personId: 'user_1' },
      page: 4,
    };

    expect(viewOf(new URLSearchParams(paramsOf(view)))).toEqual(view);
  });
});

describe('deltaOf', () => {
  it('says how much a number moved, and whether that is good', () => {
    expect(deltaOf(12, 10, 'up')).toEqual({ shown: '+20%', tone: 'good' });
    expect(deltaOf(12, 10, 'down')).toEqual({ shown: '+20%', tone: 'bad' });
    expect(deltaOf(5, 10, 'neither')).toEqual({ shown: '-50%', tone: 'flat' });
  });

  it('says no change, up from nothing, or nothing to compare', () => {
    expect(deltaOf(3, 3, 'up')).toEqual({ shown: 'No change', tone: 'flat' });
    expect(deltaOf(3, 0, 'up')).toEqual({ shown: 'Up from 0', tone: 'good' });
    expect(deltaOf(3, null, 'up')).toBeNull();
  });
});

describe('durations', () => {
  it('reads minutes, hours and days', () => {
    expect(lasted(90_000)).toBe('1m 30s');
    expect(lasted(2.5 * HOUR)).toBe('2h 30m');
    expect(lasted(50 * HOUR)).toBe('2d 2h');
  });

  it('shows a spread as its median and p90', () => {
    expect(spreadShown({ p50Ms: HOUR, p90Ms: 3 * HOUR, count: 4 })).toBe(
      '1h · p90 3h',
    );
    expect(spreadShown({ p50Ms: null, p90Ms: null, count: 0 })).toBe('–');
  });
});

describe('headlineTiles', () => {
  it('sets this period against the last and says where each number leads', () => {
    const tiles = headlineTiles(
      headline(),
      headline({
        mergedPullRequests: 4,
        spend: { amount: 100, currency: 'USD' },
      }),
    );

    expect(tiles.map((tile) => [tile.label, tile.value])).toEqual([
      ['Spend', '$120.00'],
      ['PRs merged', '8'],
      ['Merge rate', '80%'],
      ['Cost per merged PR', '$15.00'],
      ['Task to merge', '1d 2h'],
      ['Human touches per task', '3.0'],
      ['Active people', '4'],
    ]);
    expect(tiles[0]?.delta).toEqual({ shown: '+20%', tone: 'flat' });
    expect(tiles[1]?.delta).toEqual({ shown: '+100%', tone: 'good' });
    expect(tiles[0]?.drill).toEqual({ tab: 'runs' });
    expect(tiles[6]?.drill).toEqual({ tab: 'people' });
  });

  it('says plainly when spend cannot be summed', () => {
    const [spend] = headlineTiles(headline({ spend: null }), headline());

    expect(spend?.value).toBe('–');
    expect(spend?.detail).toBe('Nothing was priced');
    expect(spend?.delta).toBeNull();
  });

  it('says when spend could not be summed across currencies', () => {
    const [spend] = headlineTiles(
      headline({ spend: null, mixedCurrencies: true }),
      headline(),
    );

    expect(spend?.detail).toBe('Prices came in more than one currency');
  });

  it('drills from merged pull requests into the runs of the tasks that merged', () => {
    const tiles = headlineTiles(
      headline({ mergedTaskIds: ['task_1', 'task_2'] }),
      headline(),
    );

    expect(tiles[1]?.drill).toEqual({
      tab: 'runs',
      filter: { taskIds: 'task_1,task_2' },
    });
    expect(tiles[2]?.drill).toEqual({
      tab: 'runs',
      filter: { delivery: 'merged' },
    });
  });

  it('drills by delivery where there are too many merged tasks to name', () => {
    const many = Array.from({ length: 201 }, (_, at) => `task_${at}`);
    const tiles = headlineTiles(headline({ mergedTaskIds: many }), headline());

    expect(tiles[1]?.drill).toEqual({
      tab: 'runs',
      filter: { delivery: 'merged' },
    });
  });

  it('does not compare spend across currencies', () => {
    const [spend] = headlineTiles(
      headline(),
      headline({ spend: { amount: 90, currency: 'EUR' } }),
    );

    expect(spend?.delta).toBeNull();
  });
});

describe('station names', () => {
  it('names stations from the team’s lines, and says when one is gone', () => {
    const names = stationNamesOf(LINES);

    expect(stationShown(names, 'station_build')).toBe('Implementation');
    expect(names.get('station_build')?.lineName).toBe('Delivery');
    expect(stationShown(names, 'station_gone')).toBe('A removed station');
  });
});

describe('outputDays', () => {
  it('marks each day a station started a new config', () => {
    const days = outputDays(
      [
        {
          day: '2026-09-29',
          runs: 3,
          spend: null,
          merged: 0,
          mergedTaskIds: [],
          unpriced: 0,
          mixedCurrencies: false,
        },
        {
          day: '2026-09-30',
          runs: 5,
          spend: { amount: 4.2, currency: 'USD' },
          merged: 1,
          mergedTaskIds: [],
          unpriced: 0,
          mixedCurrencies: false,
        },
      ],
      [
        {
          lineId: 'line_1',
          stationId: 'station_build',
          fingerprint: 'abc',
          firstRunAt: '2026-09-30T10:00:00.000Z',
          runId: 'run_1',
        },
      ],
    );

    expect(days.map((day) => [day.day, day.spend, day.changes.length])).toEqual(
      [
        ['2026-09-29', null, 0],
        ['2026-09-30', 4.2, 1],
      ],
    );
  });
});

describe('what to show for failures and signals', () => {
  it('shows a task failure by source and code, with how often', () => {
    expect(
      taskFailureShown({
        source: 'hook:notify',
        code: 'loop',
        occurrences: 3,
        mostInARow: 3,
        taskIds: [],
      }),
    ).toBe('hook:notify · loop × 3');
    expect(runFailureShown({ failure: null, runs: 2, runIds: [] })).toBe(
      'No reason given × 2',
    );
  });

  it('sets a signal against the period before and the team', () => {
    expect(
      signalShown({
        signal: 'sent-back',
        now: 0.3,
        before: 0.1,
        team: 0.15,
        rose: true,
        trails: true,
        currency: null,
      }),
    ).toBe('Sent back 30% (was 10%, team 15%)');
    expect(
      signalShown({
        signal: 'cost',
        now: 1.5,
        before: null,
        team: null,
        rose: false,
        trails: true,
        currency: 'EUR',
      }),
    ).toBe('Cost per run 1.50 EUR');
  });
});

describe('cost', () => {
  const named = sliceNamer(stationNamesOf(LINES), [
    {
      id: 'claude-code',
      name: 'Claude Code',
      models: [],
      defaultModel: '',
      efforts: [],
    },
  ]);

  it('names slices, saying when the harness chose its own model or there was no repository', () => {
    expect(named('harness', 'claude-code')).toBe('Claude Code');
    expect(named('model', null)).toBe('Harness default');
    expect(named('repository', null)).toBe('No repository');
    expect(named('station', 'station_build')).toBe('Implementation');
  });

  it('drills into runs by the slice, the harness default and no repository included', () => {
    expect(sliceFilter('station', 'station_build')).toEqual({
      stationId: 'station_build',
    });
    expect(sliceFilter('model', null)).toEqual({ model: '~default' });
    expect(sliceFilter('repository', null)).toEqual({ repository: 'none' });
    expect(sliceFilter('harness', null)).toBeNull();
  });

  it('names what a drilled-in filter narrows to', () => {
    expect(filterValueShown('model', '~default')).toBe('Harness default');
    expect(filterValueShown('repository', 'none')).toBe('No repository');
    expect(filterValueShown('refusedServer', 'none')).toBe('No server');
    expect(filterValueShown('refusedServer', 'linear')).toBe('linear');
    expect(filterValueShown('taskIds', 'task_1,task_2')).toBe('2 tasks');
    expect(filterValueShown('next', 'sent-back')).toBe('Sent back');
    expect(filterValueShown('delivery', 'merged')).toBe('Merged');
  });

  it('lays the flow out by index for a Sankey, dropping what does not connect', () => {
    expect(
      sankeyOf(
        [
          { id: 'm', kind: 'model', key: null },
          { id: 's', kind: 'station', key: 'station_build' },
        ],
        [
          { source: 'm', target: 's', amount: 4 },
          { source: 'm', target: 'gone', amount: 1 },
          { source: 's', target: 'm', amount: 0 },
        ],
        named,
      ),
    ).toEqual({
      nodes: [
        { name: 'Harness default', kind: 'model' },
        { name: 'Implementation', kind: 'station' },
      ],
      links: [{ source: 0, target: 1, value: 4 }],
    });
  });
});

describe('pages of runs', () => {
  const page = (total: number, at: number) => ({
    period: {} as never,
    total,
    page: at,
    size: 50,
    runs: [],
    people: [],
  });

  it('says which runs a page shows', () => {
    expect(runsShownOf(page(120, 3))).toBe('101–120 of 120');
    expect(runsShownOf(page(0, 1))).toBe('No runs');
    expect(lastPageOf(page(120, 1))).toBe(3);
    expect(lastPageOf(page(0, 1))).toBe(1);
  });
});
