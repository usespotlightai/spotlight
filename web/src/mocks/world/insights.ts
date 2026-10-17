import type {
  CostFlowLinkResponseDto,
  CostFlowNodeResponseDto,
  CostSliceResponseDto,
  InsightsCostResponseDto,
  InsightsFlowResponseDto,
  InsightsOverviewResponseDto,
  InsightsPeopleResponseDto,
  InsightsRunResponseDto,
  InsightsRunsResponseDto,
  InsightsStationsResponseDto,
  ListInsightsRunsData,
  SignalReadingResponseDto,
  StationCacheUseResponseDto,
  StationReportResponseDto,
  StationWorthImprovingResponseDto,
  TallyChangesResponseDto,
} from '@/lib/api';
import { type HistoryRun, tasksOfTeam } from '@/mocks/world/insights-history';
import {
  type Better,
  cents,
  changeOf,
  DAY_MS,
  dayOf,
  distinct,
  NO_CHANGE,
  type PeriodName,
  periodNameOf,
  type Span,
  shareOf,
  spanOf,
  spreadOf,
  sumOf,
  type Window,
  weekOf,
  within,
} from '@/mocks/world/insights-measures';
import {
  costPerRunOf,
  mergedIn,
  moneyOf,
  owedAsks,
  peopleNamed,
  profilesOfTeam,
  pullRequestsClosedIn,
  runsIn,
  spendOf,
  tallyOf,
  versionChangesOf,
} from '@/mocks/world/insights-tally';
import { PEOPLE } from '@/mocks/world/people';

const dayWindow = (day: string): Window => {
  const from = Date.parse(`${day}T00:00:00.000Z`);
  return { from, to: from + DAY_MS };
};

const headlineOf = (teamId: string, window: Window) => {
  const runs = runsIn(teamId, window);
  const tasks = distinct(runs.map((run) => run.taskId));
  const finished = pullRequestsClosedIn(teamId, window);
  const merged = mergedIn(teamId, window);
  const spend = spendOf(runs);
  const touches = runs.filter((run) => run.next !== null).length;
  const people = distinct(
    tasksOfTeam(teamId)
      .filter(
        (task) =>
          within(task.openedAt, window) || tasks.some((id) => id === task.id),
      )
      .map((task) => task.openedBy),
  );

  return {
    spend: moneyOf(spend),
    unpriced: runs.filter((run) => run.cost === null).length,
    mixedCurrencies: false,
    runs: runs.length,
    tasks: tasks.length,
    mergedPullRequests: merged.length,
    closedPullRequests: finished.length - merged.length,
    mergeRate: shareOf(merged.length, finished.length),
    costPerMerge:
      spend === null || merged.length === 0
        ? null
        : moneyOf(spend / merged.length),
    taskToMerge: spreadOf(
      merged.map((task) => (task.pullRequest?.closedAt ?? 0) - task.openedAt),
    ),
    touches,
    touchesPerTask: shareOf(touches, tasks.length),
    activePeople: people.length,
    mergedTaskIds: merged.map((task) => task.id),
    peopleIds: people,
  };
};

const SIGNAL_FLOOR = 20;

type SignalRule = {
  readonly signal: SignalReadingResponseDto['signal'];
  readonly share: boolean;
  readonly of: (runs: readonly HistoryRun[]) => number | null;
};

const SIGNALS: readonly SignalRule[] = [
  {
    signal: 'sent-back',
    share: true,
    of: (runs) =>
      shareOf(
        runs.filter((run) => run.next?.act === 'sent-back').length,
        runs.length,
      ),
  },
  {
    signal: 'run-failures',
    share: true,
    of: (runs) =>
      shareOf(
        runs.filter((run) => run.ending === 'failed').length,
        runs.length,
      ),
  },
  { signal: 'cost', share: false, of: costPerRunOf },
];

const worseLine = (value: number | null, share: boolean): number | null =>
  value === null
    ? null
    : share
      ? Math.max(value * 1.25, value + 0.05)
      : value * 1.25;

const signalOf = (
  rule: SignalRule,
  now: readonly HistoryRun[],
  before: readonly HistoryRun[],
  team: readonly HistoryRun[],
): SignalReadingResponseDto | null => {
  const reading = rule.of(now);
  const was = before.length >= SIGNAL_FLOOR ? rule.of(before) : null;
  const all = rule.of(team);
  const lines = [worseLine(was, rule.share), worseLine(all, rule.share)].filter(
    (line): line is number => line !== null,
  );
  if (reading === null || lines.length === 0) {
    return null;
  }
  const flaggedAbove = Math.min(...lines);
  if (reading <= flaggedAbove) {
    return null;
  }
  const round = (value: number | null) =>
    value === null ? null : Math.round(value * 1000) / 1000;

  return {
    signal: rule.signal,
    now: round(reading) ?? 0,
    before: round(was),
    team: round(all),
    rose: was !== null && reading > (worseLine(was, rule.share) ?? reading),
    trails: all !== null && reading > (worseLine(all, rule.share) ?? reading),
    flaggedAbove: round(flaggedAbove) ?? 0,
    currency: rule.share ? null : 'USD',
  };
};

const worthImprovingOf = (
  teamId: string,
  span: Span,
): StationWorthImprovingResponseDto[] => {
  const team = runsIn(teamId, span.now);
  const before = runsIn(teamId, span.before);

  return profilesOfTeam(teamId)
    .flatMap((profile) => {
      const now = team.filter((run) => run.stationId === profile.stationId);
      if (now.length < SIGNAL_FLOOR) {
        return [];
      }
      const was = before.filter((run) => run.stationId === profile.stationId);
      const signals = SIGNALS.flatMap((rule) => {
        const reading = signalOf(rule, now, was, team);
        return reading ? [reading] : [];
      });
      if (signals.length === 0) {
        return [];
      }
      const worstBy = Math.min(
        10,
        Math.max(
          ...signals.map((each) => {
            const compared = Math.min(
              ...[each.before, each.team].filter(
                (value): value is number => value !== null && value > 0,
              ),
            );
            return Number.isFinite(compared) ? each.now / compared : 1;
          }),
        ),
      );

      return [
        {
          lineId: profile.lineId,
          stationId: profile.stationId,
          runs: now.length,
          signals,
          worstBy: Math.round(worstBy * 10) / 10,
          mixedCurrencies: false,
        },
      ];
    })
    .sort((one, other) => other.worstBy - one.worstBy);
};

const changesOfHeadline = (
  now: ReturnType<typeof headlineOf>,
  before: ReturnType<typeof headlineOf>,
) => ({
  spend: changeOf(
    now.spend?.amount ?? null,
    before.spend?.amount ?? null,
    'neither',
  ),
  mergedPullRequests: changeOf(
    now.mergedPullRequests,
    before.mergedPullRequests,
    'up',
  ),
  mergeRate: changeOf(now.mergeRate, before.mergeRate, 'up', 'points'),
  costPerMerge: changeOf(
    now.costPerMerge?.amount ?? null,
    before.costPerMerge?.amount ?? null,
    'down',
  ),
  taskToMerge: changeOf(
    now.taskToMerge.p50Ms,
    before.taskToMerge.p50Ms,
    'down',
  ),
  touchesPerTask: changeOf(now.touchesPerTask, before.touchesPerTask, 'down'),
  activePeople: changeOf(now.activePeople, before.activePeople, 'up'),
});

export const overviewOf = (
  teamId: string,
  name: PeriodName,
): InsightsOverviewResponseDto => {
  const span = spanOf(name);
  const headline = headlineOf(teamId, span.now);
  const markers = versionChangesOf(teamId).map((each) => each.marker);
  const runs = runsIn(teamId, span.now);

  return {
    period: span.period,
    headline,
    changes: changesOfHeadline(headline, headlineOf(teamId, span.before)),
    output: span.period.days.map((day) => {
      const window = dayWindow(day);
      const dayRuns = runs.filter((run) => within(run.at, window));
      const merged = mergedIn(teamId, window);

      return {
        day,
        runs: dayRuns.length,
        spend: moneyOf(spendOf(dayRuns)),
        unpriced: dayRuns.filter((run) => run.cost === null).length,
        mixedCurrencies: false,
        merged: merged.length,
        mergedTaskIds: merged.map((task) => task.id),
        changes: markers.filter((marker) => marker.firstRunAt.startsWith(day)),
      };
    }),
    outputCurrency: runs.length > 0 ? 'USD' : null,
    outputMixedCurrencies: false,
    worthImproving: worthImprovingOf(teamId, span),
    people: peopleNamed(headline.peopleIds),
  };
};

const flowStationsOf = (teamId: string, span: Span) => {
  const now = runsIn(teamId, span.now);
  const before = runsIn(teamId, span.before);
  const owed = owedAsks(teamId);

  return profilesOfTeam(teamId).flatMap((profile) => {
    const runs = now.filter((run) => run.stationId === profile.stationId);
    if (runs.length === 0) {
      return [];
    }
    const taskIds = distinct(runs.map((run) => run.taskId));
    const tasksBefore = distinct(
      before
        .filter((run) => run.stationId === profile.stationId)
        .map((run) => run.taskId),
    ).length;
    const answered = runs.flatMap((run) =>
      run.next ? [Date.parse(run.next.at) - run.at] : [],
    );
    const unanswered = owed.filter(
      (task) => task.stationId === profile.stationId,
    ).length;

    return [
      {
        lineId: profile.lineId,
        stationId: profile.stationId,
        tasks: taskIds.length,
        tasksBefore,
        tasksChange: changeOf(taskIds.length, tasksBefore, 'neither'),
        taskIds: taskIds.slice(0, 200),
        runs: runs.length,
        queued: spreadOf(
          runs.flatMap((run) => (run.queuedMs === null ? [] : [run.queuedMs])),
        ),
        running: spreadOf(
          runs.flatMap((run) =>
            run.runningMs === null ? [] : [run.runningMs],
          ),
        ),
        inbox: spreadOf(answered),
        asks: answered.length + unanswered,
        unanswered,
      },
    ];
  });
};

const deliveryIn = (teamId: string, window: Window) => {
  const tasks = tasksOfTeam(teamId);
  const opened = tasks.filter(
    (task) => task.pullRequest && within(task.pullRequest.openedAt, window),
  );
  const reviewed = tasks.filter(
    (task) =>
      task.pullRequest?.firstReviewAt != null &&
      within(task.pullRequest.firstReviewAt, window),
  );
  const merged = mergedIn(teamId, window);

  return { opened, reviewed, merged };
};

export const flowOf = (
  teamId: string,
  name: PeriodName,
): InsightsFlowResponseDto => {
  const span = spanOf(name);
  const now = deliveryIn(teamId, span.now);
  const before = deliveryIn(teamId, span.before);
  const pullRequestOf = (task: (typeof now.opened)[number]) =>
    task.pullRequest as NonNullable<typeof task.pullRequest>;

  return {
    period: span.period,
    flow: {
      stations: flowStationsOf(teamId, span),
      delivery: {
        toPullRequest: spreadOf(
          now.opened.map(
            (task) => pullRequestOf(task).openedAt - task.openedAt,
          ),
        ),
        toFirstReview: spreadOf(
          now.reviewed.map(
            (task) =>
              (pullRequestOf(task).firstReviewAt ?? 0) -
              pullRequestOf(task).openedAt,
          ),
        ),
        toMerge: spreadOf(
          now.merged.map(
            (task) =>
              (pullRequestOf(task).closedAt ?? 0) -
              (pullRequestOf(task).firstReviewAt ??
                pullRequestOf(task).openedAt),
          ),
        ),
        opened: now.opened.length,
        reviewed: now.reviewed.length,
        merged: now.merged.length,
        openedTaskIds: now.opened.map((task) => task.id),
        reviewedTaskIds: now.reviewed.map((task) => task.id),
        mergedTaskIds: now.merged.map((task) => task.id),
        changes: {
          opened: changeOf(now.opened.length, before.opened.length, 'up'),
          reviewed: changeOf(now.reviewed.length, before.reviewed.length, 'up'),
          merged: changeOf(now.merged.length, before.merged.length, 'up'),
        },
      },
    },
  };
};

const tallyChangesOf = (
  now: readonly HistoryRun[],
  before: readonly HistoryRun[],
): TallyChangesResponseDto => {
  if (now.length === 0 && before.length === 0) {
    return {
      runs: NO_CHANGE,
      failed: NO_CHANGE,
      accepted: NO_CHANGE,
      sentBack: NO_CHANGE,
      merged: NO_CHANGE,
      cost: NO_CHANGE,
      median: NO_CHANGE,
    };
  }
  const was = tallyOf(before);
  const is = tallyOf(now);
  const rate = (count: number, runs: number) => shareOf(count, runs);
  const compare = (
    current: number | null,
    previous: number | null,
    better: Better,
    unit: 'percent' | 'points' = 'percent',
  ) => changeOf(current, previous, better, unit);

  return {
    runs: compare(is.runs, was.runs, 'neither'),
    failed: compare(
      rate(is.failed, is.runs),
      rate(was.failed, was.runs),
      'down',
      'points',
    ),
    accepted: compare(
      rate(is.accepted, is.runs),
      rate(was.accepted, was.runs),
      'up',
      'points',
    ),
    sentBack: compare(
      rate(is.sentBack, is.runs),
      rate(was.sentBack, was.runs),
      'down',
      'points',
    ),
    merged: compare(is.merged, was.merged, 'up'),
    cost: compare(costPerRunOf(now), costPerRunOf(before), 'down'),
    median: compare(is.medianMs, was.medianMs, 'down'),
  };
};

const seenOf = (runs: readonly HistoryRun[]) => {
  const tally = tallyOf(runs);
  return {
    accepted: tally.accepted > 0,
    sentBack: tally.sentBack > 0,
    merged: tally.merged > 0,
  };
};

const trendOf = (runs: readonly HistoryRun[], span: Span) =>
  span.period.days.map((day) => ({
    day,
    tally: tallyOf(runs.filter((run) => within(run.at, dayWindow(day)))),
  }));

const HOOK_FAILURES: Record<string, StationReportResponseDto['taskFailures']> =
  {
    station_triage: [
      {
        source: 'hook:notify-slack',
        code: 'loop',
        occurrences: 3,
        maxInARow: 3,
        taskIds: ['task_checkout'],
      },
    ],
  };

const runFailuresOf = (runs: readonly HistoryRun[]) => {
  const failed = runs.filter((run) => run.ending === 'failed');
  return distinct(failed.map((run) => run.failure))
    .map((failure) => {
      const matching = failed.filter((run) => run.failure === failure);
      return {
        failure,
        runs: matching.length,
        runIds: matching.slice(0, 20).map((run) => run.runId),
      };
    })
    .sort((one, other) => other.runs - one.runs);
};

const COUNTED = [
  'failed',
  'stopped',
  'checksPassed',
  'checksFailed',
  'accepted',
  'sentBack',
  'handedOn',
  'merged',
  'withdrawn',
] as const;

export const stationsOf = (
  teamId: string,
  name: PeriodName,
): InsightsStationsResponseDto => {
  const span = spanOf(name);
  const now = runsIn(teamId, span.now);
  const before = runsIn(teamId, span.before);
  const reports: StationReportResponseDto[] = profilesOfTeam(teamId).flatMap(
    (profile) => {
      const runs = now.filter((run) => run.stationId === profile.stationId);
      if (runs.length === 0) {
        return [];
      }
      const was = before.filter((run) => run.stationId === profile.stationId);

      return [
        {
          lineId: profile.lineId,
          stationId: profile.stationId,
          tally: tallyOf(runs),
          changes: tallyChangesOf(runs, was),
          seen: seenOf(runs),
          trend: trendOf(runs, span),
          taskFailures: HOOK_FAILURES[profile.stationId] ?? [],
          runFailures: runFailuresOf(runs),
        },
      ];
    },
  );
  const team = tallyOf(now);

  return {
    period: span.period,
    team,
    teamChanges: tallyChangesOf(now, before),
    teamSeen: seenOf(now),
    teamCounted: Object.fromEntries(
      COUNTED.map((key) => [key, team[key] > 0]),
    ) as InsightsStationsResponseDto['teamCounted'],
    teamTrend: now.length === 0 ? [] : trendOf(now, span),
    stations: reports,
  };
};

const CHATS: Record<string, number> = {
  user_1: 7,
  user_2: 3,
  user_3: 2,
  user_4: 1,
};

const loadOf = (teamId: string, window: Window, owed: number) => {
  const runs = runsIn(teamId, window);
  const asked = runs.filter((run) => run.next !== null);
  const tasks = distinct(runs.map((run) => run.taskId));
  const sentBack = asked.filter((run) => run.next?.act === 'sent-back').length;
  const asks = asked.length + owed;

  return {
    asks,
    tasks: tasks.length,
    asksPerTask: shareOf(asks, tasks.length),
    toAnswer: spreadOf(
      asked.map((run) => Date.parse(run.next?.at ?? '') - run.at),
    ),
    unanswered: owed,
    sentBack,
    sentBackRate: shareOf(sentBack, runs.length),
    refused: runs.filter((run) => run.calls.some((call) => call.refused))
      .length,
    askedTaskIds: distinct(asked.map((run) => run.taskId)).slice(0, 200),
    refusedTaskIds: distinct(
      runs
        .filter((run) => run.calls.some((call) => call.refused))
        .map((run) => run.taskId),
    ),
  };
};

const lastActOf = (runs: readonly HistoryRun[], personId: string) =>
  runs
    .filter((run) => run.openedBy === personId)
    .reduce(
      (latest, run) =>
        Math.max(latest, run.next ? Date.parse(run.next.at) : run.at),
      0,
    );

export const peopleOf = (
  teamId: string,
  name: PeriodName,
): InsightsPeopleResponseDto => {
  const span = spanOf(name);
  const now = runsIn(teamId, span.now);
  const tasks = tasksOfTeam(teamId);
  const owed = owedAsks(teamId).length;
  const load = loadOf(teamId, span.now, owed);
  const before = loadOf(teamId, span.before, 0);
  const activeIn = (window: Window) =>
    distinct(runsIn(teamId, window).map((run) => run.openedBy ?? '')).filter(
      Boolean,
    );
  const active = activeIn(span.now);
  const weekly = activeIn({ from: Date.now() - 7 * DAY_MS, to: Date.now() });
  const monthly = activeIn({ from: Date.now() - 30 * DAY_MS, to: Date.now() });
  const people = active.map((personId) => {
    const opened = tasks.filter((task) => task.openedBy === personId);
    const firstSeen = Math.min(...opened.map((task) => task.openedAt));
    const scale = span.length / 30;

    return {
      personId,
      name: PEOPLE.find((person) => person.id === personId)?.name ?? null,
      tasksOpened: opened.filter((task) => within(task.openedAt, span.now))
        .length,
      acts: now.filter((run) => run.openedBy === personId && run.next !== null)
        .length,
      chats: Math.round((CHATS[personId] ?? 0) * scale),
      firstSeenAt: new Date(firstSeen).toISOString(),
      lastActiveAt: new Date(lastActOf(now, personId)).toISOString(),
      isNew: within(firstSeen, span.now),
    };
  });

  return {
    period: span.period,
    load,
    loadChanges: {
      asksPerTask: changeOf(load.asksPerTask, before.asksPerTask, 'down'),
      toAnswer: changeOf(load.toAnswer.p50Ms, before.toAnswer.p50Ms, 'down'),
      sentBackRate: changeOf(
        load.sentBackRate,
        before.sentBackRate,
        'down',
        'points',
      ),
      refused: changeOf(load.refused, before.refused, 'down'),
    },
    adoption: {
      activeCount: active.length,
      activeChange: changeOf(active.length, activeIn(span.before).length, 'up'),
      newAdopterCount: people.filter((person) => person.isNew).length,
      weeklyCount: weekly.length,
      monthlyCount: monthly.length,
      stickiness: shareOf(weekly.length, monthly.length),
      people: people.sort((one, other) => other.acts - one.acts),
    },
  };
};

const slicesOf = (
  runs: readonly HistoryRun[],
  keyOf: (run: HistoryRun) => string | null,
): CostSliceResponseDto[] =>
  distinct(runs.map(keyOf))
    .map((key) => {
      const matching = runs.filter((run) => keyOf(run) === key);
      return {
        key,
        amount: cents(sumOf(matching.map((run) => run.cost?.amount ?? 0))),
        runs: matching.length,
      };
    })
    .sort((one, other) => other.amount - one.amount);

const repositoryOf = (run: HistoryRun): string | null =>
  run.repositories[0] ?? null;

const flowOfCost = (runs: readonly HistoryRun[]) => {
  const priced = runs.filter((run) => run.cost !== null);
  const nodeId = (kind: string, key: string | null) => `${kind}:${key ?? ''}`;
  const nodes: CostFlowNodeResponseDto[] = [
    ...distinct(priced.map((run) => run.model)).map((key) => ({
      id: nodeId('model', key),
      kind: 'model' as const,
      key,
    })),
    ...distinct(priced.map((run) => run.stationId)).map((key) => ({
      id: nodeId('station', key),
      kind: 'station' as const,
      key,
    })),
    ...distinct(priced.map(repositoryOf)).map((key) => ({
      id: nodeId('repository', key),
      kind: 'repository' as const,
      key,
    })),
  ];
  const linksBetween = (
    source: (run: HistoryRun) => string,
    target: (run: HistoryRun) => string,
  ): CostFlowLinkResponseDto[] => {
    const sums = new Map<string, number>();
    for (const run of priced) {
      const key = `${source(run)}>${target(run)}`;
      sums.set(key, (sums.get(key) ?? 0) + (run.cost?.amount ?? 0));
    }
    return [...sums].map(([key, amount]) => {
      const [from, to] = key.split('>');
      return { source: from ?? '', target: to ?? '', amount: cents(amount) };
    });
  };

  return {
    nodes,
    links: [
      ...linksBetween(
        (run) => nodeId('model', run.model),
        (run) => nodeId('station', run.stationId),
      ),
      ...linksBetween(
        (run) => nodeId('station', run.stationId),
        (run) => nodeId('repository', repositoryOf(run)),
      ),
    ],
  };
};

const cacheOf = (runs: readonly HistoryRun[]) => {
  const counted = runs.flatMap((run) =>
    run.tokens?.input != null && run.tokens.cacheRead != null
      ? [run.tokens]
      : [],
  );
  if (counted.length === 0) {
    return { input: null, cacheRead: null, cacheWrite: null, cacheShare: null };
  }
  const input = sumOf(counted.map((each) => each.input ?? 0));
  const cacheRead = sumOf(counted.map((each) => each.cacheRead ?? 0));
  const cacheWrite = sumOf(counted.map((each) => each.cacheWrite ?? 0));

  return {
    input,
    cacheRead,
    cacheWrite,
    cacheShare: shareOf(cacheRead, input + cacheRead + cacheWrite),
  };
};

export const costOf = (
  teamId: string,
  name: PeriodName,
): InsightsCostResponseDto => {
  const span = spanOf(name);
  const runs = runsIn(teamId, span.now);
  const spend = spendOf(runs);

  return {
    period: span.period,
    cost: {
      spend: moneyOf(spend),
      unpriced: runs.filter((run) => run.cost === null).length,
      mixedCurrencies: false,
      byHarness: slicesOf(runs, (run) => run.harness),
      byModel: slicesOf(runs, (run) => run.model),
      byStation: slicesOf(runs, (run) => run.stationId),
      byRepository: slicesOf(runs, repositoryOf),
      ...flowOfCost(runs),
      cache: cacheOf(runs),
      cacheByStation: distinct(runs.map((run) => run.stationId)).map(
        (stationId): StationCacheUseResponseDto => ({
          stationId,
          ...cacheOf(runs.filter((run) => run.stationId === stationId)),
        }),
      ),
    },
    spendChange: changeOf(
      spend,
      spendOf(runsIn(teamId, span.before)),
      'neither',
    ),
  };
};

type RunQuery = NonNullable<ListInsightsRunsData['query']>;

const RUN_MATCHERS: {
  readonly [key in keyof RunQuery]?: (
    run: HistoryRun,
    value: string,
  ) => boolean;
} = {
  lineId: (run, value) => run.lineId === value,
  stationId: (run, value) => run.stationId === value,
  outcome: (run, value) => run.ending === value,
  delivery: (run, value) => run.delivery === value,
  next: (run, value) => run.next?.act === value,
  asked: (run, value) => value !== 'true' || run.next !== null,
  harness: (run, value) => run.harness === value,
  model: (run, value) => (run.model ?? '') === value,
  repository: (run, value) => run.repositories.includes(value),
  fingerprint: (run, value) => run.fingerprint === value,
  taskId: (run, value) => run.taskId === value,
  taskIds: (run, value) => value.split(',').includes(run.taskId),
  personId: (run, value) => run.openedBy === value,
  day: (run, value) => dayOf(run.at) === value,
  week: (run, value) => weekOf(run.at) === value,
  skillGiven: (run, value) => run.skillsGiven.includes(value),
  skillUsed: (run, value) => run.skillsUsed.includes(value),
  server: (run, value) => run.calls.some((call) => call.server === value),
  serverFailed: (run, value) =>
    run.calls.some((call) => call.server === value && call.failed > 0),
  refusedServer: (run, value) =>
    run.calls.some((call) => call.server === value && call.refused !== null),
  refusedTool: (run, value) => run.calls.some((call) => call.refused === value),
};

const PAGE_SIZE = 50;

const shownRun = (run: HistoryRun): InsightsRunResponseDto => {
  const {
    teamId: _team,
    at: _at,
    size: _size,
    judge: _judge,
    skillsGiven: _given,
    skillsUsed: _used,
    calls: _calls,
    ...shown
  } = run;
  return shown;
};

export const runsListOf = (
  teamId: string,
  params: URLSearchParams,
): InsightsRunsResponseDto => {
  const span = spanOf(periodNameOf(params.get('period')));
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const size = Math.max(
    1,
    Number(params.get('size') ?? PAGE_SIZE) || PAGE_SIZE,
  );
  const matching = runsIn(teamId, span.now).filter((run) =>
    Object.entries(RUN_MATCHERS).every(([key, matches]) => {
      const value = params.get(key);
      return value === null || value === '' || matches(run, value);
    }),
  );
  const shown = matching.slice((page - 1) * size, page * size);

  return {
    period: span.period,
    total: matching.length,
    page,
    size,
    runs: shown.map(shownRun),
    people: peopleNamed(shown.map((run) => run.openedBy)),
  };
};
