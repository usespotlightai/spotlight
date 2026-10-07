import { describe, expect, it } from 'vitest';
import type { LineResponseDto, RunTallyResponseDto } from '@/lib/api';
import {
  type Change,
  changeShown,
  filterValueShown,
  type Headline,
  type HeadlineChanges,
  headlineTiles,
  insightsPath,
  lasted,
  lastPageOf,
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
  tallyTiles,
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

const change = (
  by: number | null,
  tone: Change['tone'] = 'flat',
  unit: Change['unit'] = 'percent',
): Change => ({
  unit,
  by,
  fromZero: by === null,
  direction: by === null || by > 0 ? 'up' : by < 0 ? 'down' : 'same',
  tone,
});

const UNCHANGED: HeadlineChanges = {
  spend: change(0),
  mergedPullRequests: change(0),
  mergeRate: change(0, 'flat', 'points'),
  costPerMerge: change(0),
  taskToMerge: change(0),
  touchesPerTask: change(0),
  activePeople: change(0),
};

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

  it('opens the overview for tabs Insights no longer has, keeping the period', () => {
    for (const gone of ['candidates', 'changes', 'flow', 'memory']) {
      const view = viewOf(
        new URLSearchParams(`tab=${gone}&period=7d&stationId=s&page=3`),
      );

      expect(view).toEqual({
        tab: 'overview',
        period: '7d',
        filter: {},
        page: 1,
      });
      expect(paramsOf(view)).toEqual({ period: '7d' });
    }
  });

  it('reads the station the Stations tab opens, and nothing else', () => {
    const view = viewOf(
      new URLSearchParams(
        'tab=stations&period=90d&stationId=station_build&outcome=failed&page=3',
      ),
    );

    expect(view).toEqual({
      tab: 'stations',
      period: '90d',
      filter: { stationId: 'station_build' },
      page: 1,
    });
    expect(paramsOf(view)).toEqual({
      tab: 'stations',
      period: '90d',
      stationId: 'station_build',
    });
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
          'tab=productivity&repository=acme/api&author=spotlight&type=fix&state=merged&week=2026-09-28&reverted=true&rounds=3%2B&page=2&stationId=s',
        ),
      ),
    ).toEqual({
      tab: 'productivity',
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
          'tab=productivity&author=robots&type=epic&state=draft&week=monday&reverted=no&rounds=9',
        ),
      ).filter,
    ).toEqual({});
  });

  it('keeps pull request filters, so they survive a reload', () => {
    const view = {
      tab: 'productivity' as const,
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

describe('changeShown', () => {
  it('shows a relative change as a signed percent, in the server’s tone', () => {
    expect(changeShown(change(0.2, 'good'))).toEqual({
      shown: '+20%',
      tone: 'good',
    });
    expect(changeShown(change(-0.5))).toEqual({ shown: '-50%', tone: 'flat' });
  });

  it('shows a rate’s change in points, to one decimal below a point', () => {
    expect(changeShown(change(0.05, 'good', 'points'))?.shown).toBe('+5 pts');
    expect(changeShown(change(-0.03, 'bad', 'points'))?.shown).toBe('−3 pts');
    expect(changeShown(change(0.004, 'good', 'points'))?.shown).toBe(
      '+0.4 pts',
    );
  });

  it('says no change, up from nothing, or nothing to compare', () => {
    expect(changeShown(change(0))).toEqual({
      shown: 'No change',
      tone: 'flat',
    });
    expect(changeShown(change(0, 'flat', 'points'))?.shown).toBe('No change');
    expect(changeShown(change(null, 'good'))).toEqual({
      shown: 'Up from 0',
      tone: 'good',
    });
    expect(changeShown(null)).toBeNull();
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
    const tiles = headlineTiles(headline(), {
      ...UNCHANGED,
      spend: change(0.2),
      mergedPullRequests: change(1, 'good'),
      mergeRate: change(0.05, 'good', 'points'),
    });

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
    expect(tiles[2]?.delta).toEqual({ shown: '+5 pts', tone: 'good' });
    expect(tiles[0]?.drill).toEqual({ tab: 'runs' });
    expect(tiles[6]?.drill).toEqual({ tab: 'people' });
  });

  it('says plainly when spend cannot be summed', () => {
    const [spend] = headlineTiles(headline({ spend: null }), {
      ...UNCHANGED,
      spend: null,
    });

    expect(spend?.value).toBe('–');
    expect(spend?.detail).toBe('No priced runs');
    expect(spend?.delta).toBeNull();
  });

  it('says when spend could not be summed across currencies', () => {
    const [spend] = headlineTiles(
      headline({ spend: null, mixedCurrencies: true }),
      UNCHANGED,
    );

    expect(spend?.detail).toBe('Prices in more than one currency');
  });

  it('drills from merged pull requests into the runs of the tasks that merged', () => {
    const tiles = headlineTiles(
      headline({ mergedTaskIds: ['task_1', 'task_2'] }),
      UNCHANGED,
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
    const tiles = headlineTiles(headline({ mergedTaskIds: many }), UNCHANGED);

    expect(tiles[1]?.drill).toEqual({
      tab: 'runs',
      filter: { delivery: 'merged' },
    });
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

describe('what to show for failures and signals', () => {
  it('names a task failure by source and code, and a run failure by its reason', () => {
    expect(
      taskFailureShown({
        source: 'hook:notify',
        code: 'loop',
        occurrences: 3,
        mostInARow: 3,
        taskIds: [],
      }),
    ).toBe('hook:notify · loop');
    expect(runFailureShown({ failure: null, runs: 2, runIds: [] })).toBe(
      'No reason given',
    );
  });

  it('sets a signal against the period before and all stations', () => {
    expect(
      signalShown({
        signal: 'sent-back',
        now: 0.3,
        before: 0.1,
        team: 0.15,
        rose: true,
        trails: true,
        flaggedAbove: 0.15,
        currency: null,
      }),
    ).toBe('Sent back 30% (was 10%, all stations 15%)');
    expect(
      signalShown({
        signal: 'cost',
        now: 1.5,
        before: null,
        team: null,
        rose: false,
        trails: true,
        flaggedAbove: 1.2,
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

const teamTally = (over: Partial<RunTallyResponseDto>): RunTallyResponseDto =>
  ({
    runs: 10,
    withdrawn: 0,
    failed: 2,
    failedShare: 0.2,
    stopped: 0,
    checksPassed: 0,
    checksFailed: 0,
    accepted: 4,
    sentBack: 0,
    handedOn: 0,
    merged: 0,
    cost: { amount: 5, currency: 'USD' },
    unpriced: 0,
    mixedCurrencies: false,
    medianMs: 60_000,
    p90Ms: 120_000,
    ...over,
  }) as RunTallyResponseDto;

describe('tallyTiles', () => {
  it('shows each count with its own change, leaving out counts the server saw at zero in both periods', () => {
    const tiles = tallyTiles(
      teamTally({}),
      { accepted: true, sentBack: false, merged: false },
      {
        runs: change(0.25),
        failed: change(-0.5, 'good'),
        accepted: change(0),
        sentBack: change(0),
        merged: change(0),
        cost: change(0),
        median: change(0),
      },
      [],
    );

    expect(tiles.map((tile) => tile.label)).toEqual([
      'Runs',
      'Failed',
      'Accepted',
      'Cost',
      'Median run',
    ]);
    expect(tiles[1]).toMatchObject({
      value: '2',
      detail: '20% of runs',
      delta: { tone: 'good' },
    });
  });
});
