import type {
  GroupMeasuresResponseDto,
  InsightsPullRequestListResponseDto,
  InsightsPullRequestResponseDto,
  InsightsPullRequestsResponseDto,
  ListInsightsPullRequestsData,
  WeekShareResponseDto,
} from '@/lib/api';
import {
  PULL_REQUEST_TYPES,
  type PullRequestType,
} from '@/lib/insights-pull-requests';
import { GROWTH_ID, PLATFORM_ID } from '@/mocks/world';
import {
  GROWTH_DAYS,
  type History,
  type HistoryTask,
  history,
} from '@/mocks/world/insights-history';
import {
  CURRENCY,
  cents,
  DAY_MS,
  distinct,
  HOUR_MS,
  isoOf,
  midnight,
  mondaysOf,
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

type Author = InsightsPullRequestResponseDto['by'];

export type PullRequestFact = {
  readonly teamId: string;
  readonly repository: string;
  readonly number: number;
  readonly title: string;
  readonly author: string;
  readonly authorIsBot: boolean;
  readonly by: Author;
  readonly taskId: string | null;
  readonly reviewTaskIds: readonly string[];
  readonly type: PullRequestType;
  readonly state: 'open' | 'merged' | 'closed';
  readonly openedAt: number;
  readonly closedAt: number | null;
  readonly firstReviewAt: number | null;
  readonly reviewRounds: number;
  readonly reviewComments: number;
  readonly isRevert: boolean;
  readonly revertedBy: number | null;
  readonly additions: number;
  readonly deletions: number;
  readonly changedFiles: number;
};

const SPOTLIGHT_LOGIN = 'acme-spotlight[bot]';

const TEAM_REPOSITORIES: Record<string, readonly string[]> = {
  [PLATFORM_ID]: ['acme/api', 'acme/worker'],
  [GROWTH_ID]: ['acme/web'],
};

const LATEST_NUMBER: Record<string, number> = {
  'acme/api': 436,
  'acme/worker': 219,
  'acme/web': 104,
};

const PEOPLE_RATE: Record<string, number> = {
  'acme/api': 0.7,
  'acme/worker': 0.35,
  'acme/web': 0.3,
};

const HISTORY_DAYS: Record<string, number> = {
  'acme/api': 182,
  'acme/worker': 182,
  'acme/web': GROWTH_DAYS,
};

const LOGINS: Record<string, readonly string[]> = {
  'acme/api': ['sam-rivera', 'maya-chen', 'tom-becker', 'jonas-weber'],
  'acme/worker': ['maya-chen', 'tom-becker', 'jonas-weber'],
  'acme/web': ['priya-nair', 'sam-rivera', 'lea-fischer'],
};

const PEOPLE_TITLES: readonly (readonly [string, PullRequestType])[] = [
  ['Tidy the error messages on the billing endpoints', 'refactor'],
  ['Add a flag for the new invoice layout', 'feature'],
  ['Fix the flaky clock in the scheduler tests', 'tests'],
  ['Raise the worker concurrency to eight', 'chore'],
  ['Handle a missing customer in the export job', 'fix'],
  ['Document the local setup for the queue', 'other'],
  ['Speed up the customer list query', 'refactor'],
  ['Add the Stripe tax id to customers', 'feature'],
  ['Fix the retry banner showing after success', 'fix'],
  ['Split the long migration into two', 'chore'],
  ['Cover the plan downgrade path', 'tests'],
  ['Show the last sync time on the dashboard', 'feature'],
];

const BUMPS = [
  'Bump @aws-sdk/client-s3 from 3.658.1 to 3.663.0',
  'Bump vitest from 2.1.1 to 2.1.2',
  'Bump pg from 8.12.0 to 8.13.0',
  'Bump zod from 3.23.6 to 3.23.8',
  'Bump eslint-plugin-import from 2.30.0 to 2.31.0',
];

const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
};

const around = (draw: () => number, median: number): number =>
  Math.round(median * (0.4 + draw() * 1.2 + draw() ** 5 * 3));

type Unnumbered = Omit<PullRequestFact, 'number' | 'revertedBy'> & {
  readonly key: string;
  readonly fixedNumber: number | null;
  readonly getsReverted: boolean;
  readonly revertOf: string | null;
};

const keyOf = (repository: string, openedAt: number, title: string) =>
  `${repository}:${openedAt}:${title}`;

const fromTask = (task: HistoryTask, draw: () => number): Unnumbered | null => {
  const record = task.pullRequest;
  if (!record) {
    return null;
  }
  return {
    teamId: task.teamId,
    repository: record.repository,
    key: keyOf(record.repository, record.openedAt, record.title),
    fixedNumber: record.number,
    revertOf: null,
    title: record.title,
    author: SPOTLIGHT_LOGIN,
    authorIsBot: true,
    by: 'spotlight',
    taskId: task.id,
    reviewTaskIds: [],
    type: record.type,
    state: record.state,
    openedAt: record.openedAt,
    closedAt: record.closedAt,
    firstReviewAt: record.firstReviewAt,
    reviewRounds: record.reviewRounds,
    reviewComments: record.reviewComments,
    isRevert: false,
    getsReverted: draw() < 0.03,
    additions: record.additions,
    deletions: record.deletions,
    changedFiles: record.changedFiles,
  };
};

const peoplePullRequests = (
  teamId: string,
  repository: string,
  draw: () => number,
  from: number,
): Unnumbered[] => {
  const made: Unnumbered[] = [];
  const logins = LOGINS[repository] ?? [];
  const today = midnight(Date.now());
  let titleAt = repository.length;

  for (let day = from; day <= today; day += DAY_MS) {
    const weekday = new Date(day).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const count = Math.floor(
      (weekend ? 0.1 : (PEOPLE_RATE[repository] ?? 0)) + draw(),
    );
    for (let each = 0; each < count; each += 1) {
      const [title, type] = PEOPLE_TITLES[
        titleAt % PEOPLE_TITLES.length
      ] as readonly [string, PullRequestType];
      titleAt += 1;
      const openedAt = day + (8 + draw() * 9) * HOUR_MS;
      const rounds = Math.floor(draw() * 3.4);
      const firstReviewAt = openedAt + around(draw, 6 * HOUR_MS);
      const closingAt = firstReviewAt + around(draw, 14 * HOUR_MS);
      const reviewed = draw() < 0.3;
      const open = closingAt > Date.now();
      const additions = around(draw, 140);
      made.push({
        teamId,
        repository,
        key: keyOf(repository, openedAt, title),
        fixedNumber: null,
        revertOf: null,
        title,
        author: logins[Math.floor(draw() * logins.length)] ?? 'jonas-weber',
        authorIsBot: false,
        by: reviewed ? 'reviewed' : 'people',
        taskId: null,
        reviewTaskIds: reviewed
          ? [`task_review_${repository.length}_${made.length}`]
          : [],
        type,
        state: open ? 'open' : draw() < 0.06 ? 'closed' : 'merged',
        openedAt,
        closedAt: open ? null : closingAt,
        firstReviewAt: firstReviewAt > Date.now() ? null : firstReviewAt,
        reviewRounds: rounds,
        reviewComments: rounds * Math.round(1 + draw() * 3),
        isRevert: false,
        getsReverted: draw() < 0.02,
        additions,
        deletions: Math.round(additions * (0.2 + draw() * 0.6)),
        changedFiles: Math.max(1, Math.round(additions / 30)),
      });
    }
    if (weekday === 1) {
      const openedAt = day + 6 * HOUR_MS;
      const title = BUMPS[Math.floor(day / DAY_MS) % BUMPS.length] ?? '';
      made.push({
        teamId,
        repository,
        key: keyOf(repository, openedAt, title),
        fixedNumber: null,
        revertOf: null,
        title,
        author: 'dependabot[bot]',
        authorIsBot: true,
        by: 'bots',
        taskId: null,
        reviewTaskIds: [],
        type: 'chore',
        state: 'merged',
        openedAt,
        closedAt: openedAt + around(draw, 20 * HOUR_MS),
        firstReviewAt: null,
        reviewRounds: 0,
        reviewComments: 0,
        isRevert: false,
        getsReverted: false,
        additions: 4,
        deletions: 4,
        changedFiles: 2,
      });
    }
  }

  return made;
};

const revertsOf = (all: readonly Unnumbered[]): Unnumbered[] =>
  all.flatMap((fact) => {
    if (!fact.getsReverted || fact.state !== 'merged' || !fact.closedAt) {
      return [];
    }
    const openedAt = fact.closedAt + 26 * HOUR_MS;
    if (openedAt + 3 * HOUR_MS > Date.now()) {
      return [];
    }
    const title = `Revert "${fact.title}"`;

    return [
      {
        teamId: fact.teamId,
        repository: fact.repository,
        key: keyOf(fact.repository, openedAt, title),
        fixedNumber: null,
        revertOf: fact.key,
        getsReverted: false,
        title,
        author: 'maya-chen',
        authorIsBot: false,
        by: 'people' as const,
        taskId: null,
        reviewTaskIds: [],
        type: 'other' as const,
        state: 'merged' as const,
        openedAt,
        closedAt: openedAt + 2 * HOUR_MS,
        firstReviewAt: openedAt + HOUR_MS,
        reviewRounds: 1,
        reviewComments: 0,
        isRevert: true,
        additions: fact.deletions,
        deletions: fact.additions,
        changedFiles: fact.changedFiles,
      },
    ];
  });

const numbered = (
  repository: string,
  unnumbered: readonly Unnumbered[],
): PullRequestFact[] => {
  const all = [...unnumbered, ...revertsOf(unnumbered)];
  const taken = new Set(
    all.flatMap((each) =>
      each.fixedNumber === null ? [] : [each.fixedNumber],
    ),
  );
  const numbers = new Map<string, number>();
  let next = LATEST_NUMBER[repository] ?? 100;

  for (const each of [...all].sort(
    (one, other) => other.openedAt - one.openedAt,
  )) {
    if (each.fixedNumber !== null) {
      numbers.set(each.key, each.fixedNumber);
      continue;
    }
    while (taken.has(next)) {
      next -= 1;
    }
    numbers.set(each.key, next);
    next -= 1;
  }
  const revertedBy = new Map(
    all.flatMap((each) =>
      each.revertOf
        ? [[each.revertOf, numbers.get(each.key) ?? 0] as const]
        : [],
    ),
  );

  return all.map(
    ({
      key,
      fixedNumber: _fixed,
      getsReverted: _gets,
      revertOf: _of,
      ...fact
    }) => ({
      ...fact,
      number: numbers.get(key) ?? 0,
      revertedBy: revertedBy.get(key) ?? null,
    }),
  );
};

const buildFacts = (source: History): PullRequestFact[] => {
  if (source.runs.length === 0) {
    return [];
  }
  const draw = seeded(412);
  const today = midnight(Date.now());
  const tasks = source.tasks.flatMap((task) => {
    const fact = fromTask(task, draw);
    return fact ? [fact] : [];
  });

  return Object.entries(TEAM_REPOSITORIES).flatMap(([teamId, repositories]) =>
    repositories.flatMap((repository) =>
      numbered(repository, [
        ...tasks.filter((each) => each.repository === repository),
        ...peoplePullRequests(
          teamId,
          repository,
          draw,
          today - (HISTORY_DAYS[repository] ?? 0) * DAY_MS,
        ),
      ]),
    ),
  );
};

let cached: {
  readonly source: History;
  readonly facts: PullRequestFact[];
} | null = null;

export const pullRequestFacts = (teamId: string): PullRequestFact[] => {
  const source = history();
  if (cached?.source !== source) {
    cached = { source, facts: buildFacts(source) };
  }
  return cached.facts.filter((fact) => fact.teamId === teamId);
};

const activeIn = (fact: PullRequestFact, window: Window): boolean =>
  fact.openedAt < window.to &&
  (fact.closedAt === null || fact.closedAt >= window.from);

export const mergedIn = (
  facts: readonly PullRequestFact[],
  window: Window,
): PullRequestFact[] =>
  facts.filter(
    (fact) =>
      fact.state === 'merged' &&
      fact.closedAt !== null &&
      within(fact.closedAt, window),
  );

const isSpotlight = (fact: PullRequestFact) => fact.by === 'spotlight';

const isPeople = (fact: PullRequestFact) => fact.by === 'people';

const weekShare = (
  week: string,
  merged: readonly PullRequestFact[],
): WeekShareResponseDto => {
  const inWeek = merged.filter((fact) => weekOf(fact.closedAt ?? 0) === week);
  const count = (by: Author) => inWeek.filter((fact) => fact.by === by).length;
  const authored = count('spotlight');
  const reviewed = count('reviewed');

  return {
    week,
    merged: inWeek.length,
    authored,
    reviewed,
    spotlight: authored + reviewed,
    people: count('people'),
    bots: count('bots'),
    rate: shareOf(authored + reviewed, inWeek.length),
  };
};

const spotlightShareOf = (
  merged: readonly PullRequestFact[],
  weeks: readonly string[],
) => {
  const count = (by: Author) => merged.filter((fact) => fact.by === by).length;
  const authored = count('spotlight');
  const reviewed = count('reviewed');

  return {
    merged: merged.length,
    authored,
    reviewed,
    bots: count('bots'),
    rate: shareOf(authored + reviewed, merged.length),
    weeks: weeks.map((week) => weekShare(week, merged)),
  };
};

export const toMergeOf = (fact: PullRequestFact): number | null =>
  fact.state === 'merged' && fact.closedAt !== null
    ? fact.closedAt - fact.openedAt
    : null;

const inReviewOf = (fact: PullRequestFact): number | null =>
  fact.state === 'merged' && fact.closedAt !== null && fact.firstReviewAt
    ? fact.closedAt - fact.firstReviewAt
    : null;

const present = (values: readonly (number | null)[]): number[] =>
  values.flatMap((value) => (value === null ? [] : [value]));

const meanOf = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((sumOf(values) / values.length) * 10) / 10;

const groupOf = (
  merged: readonly PullRequestFact[],
  all: readonly PullRequestFact[],
): GroupMeasuresResponseDto => {
  const reverted = merged.filter((fact) => fact.revertedBy !== null).length;

  return {
    merged: merged.length,
    toMerge: spreadOf(present(merged.map(toMergeOf))),
    inReview: spreadOf(present(merged.map(inReviewOf))),
    meanRounds: meanOf(merged.map((fact) => fact.reviewRounds)),
    meanComments: meanOf(merged.map((fact) => fact.reviewComments)),
    reverted: all.length > 0 ? reverted : 0,
    revertRate: shareOf(reverted, merged.length),
  };
};

export const roundsOf = (fact: PullRequestFact): '0' | '1' | '2' | '3+' =>
  fact.reviewRounds >= 3
    ? '3+'
    : (String(fact.reviewRounds) as '0' | '1' | '2');

const spendOfTask = (taskId: string | null) => {
  const runs = history().runs.filter((run) => run.taskId === taskId);
  const priced = runs.filter((run) => run.cost !== null);

  return {
    amount:
      priced.length === 0
        ? null
        : cents(sumOf(priced.map((run) => run.cost?.amount ?? 0))),
    unpriced: runs.length - priced.length,
  };
};

const repositoriesOf = (teamId: string): string[] => [
  ...(TEAM_REPOSITORIES[teamId] ?? []),
];

export const pullRequestsOf = (
  teamId: string,
  name: PeriodName,
): InsightsPullRequestsResponseDto => {
  const span = spanOf(name);
  const facts = pullRequestFacts(teamId);
  const merged = mergedIn(facts, span.now);
  const weeks = mondaysOf(span);
  const compared = distinct(
    merged.filter(isSpotlight).map((fact) => fact.repository),
  );
  const inCompared = merged.filter((fact) =>
    compared.includes(fact.repository),
  );
  const spotlight = inCompared.filter(isSpotlight);
  const people = inCompared.filter(isPeople);

  return {
    period: span.period,
    total: facts.filter((fact) => activeIn(fact, span.now)).length,
    repositories: repositoriesOf(teamId),
    weeks,
    spotlightShare: {
      ...spotlightShareOf(merged, weeks),
      repositories: repositoriesOf(teamId)
        .map((repository) => ({
          repository,
          ...spotlightShareOf(
            merged.filter((fact) => fact.repository === repository),
            weeks,
          ),
        }))
        .sort((one, other) => other.merged - one.merged),
    },
    comparison: {
      repositories: compared,
      spotlight: groupOf(spotlight, facts),
      people: groupOf(people, facts),
    },
    types:
      merged.length === 0
        ? []
        : PULL_REQUEST_TYPES.map((type) => {
            const ofType = spotlight.filter((fact) => fact.type === type);
            const spends = ofType.map((fact) => spendOfTask(fact.taskId));
            const priced = present(spends.map((each) => each.amount));
            return {
              type,
              spotlight: ofType.length,
              people: people.filter((fact) => fact.type === type).length,
              spend:
                priced.length === 0
                  ? null
                  : { amount: cents(sumOf(priced)), currency: CURRENCY },
              unpriced: sumOf(spends.map((each) => each.unpriced)),
              mixedCurrencies: false,
            };
          }),
    depth:
      inCompared.length === 0
        ? []
        : (['0', '1', '2', '3+'] as const).map((rounds) => ({
            rounds,
            spotlight: spotlight.filter((fact) => roundsOf(fact) === rounds)
              .length,
            people: people.filter((fact) => roundsOf(fact) === rounds).length,
          })),
  };
};

type ListQuery = NonNullable<ListInsightsPullRequestsData['query']>;

const LIST_MATCHERS: {
  readonly [key in keyof ListQuery]?: (
    fact: PullRequestFact,
    value: string,
    context: { readonly compared: readonly string[] },
  ) => boolean;
} = {
  repository: (fact, value) => value.split(',').includes(fact.repository),
  week: (fact, value) =>
    fact.closedAt !== null && weekOf(fact.closedAt) === value,
  author: (fact, value) => fact.by === value,
  type: (fact, value) => fact.type === value,
  state: (fact, value) => fact.state === value,
  rounds: (fact, value) => roundsOf(fact) === value,
  reverted: (fact, value) => value !== 'true' || fact.revertedBy !== null,
  compared: (fact, value, context) =>
    value !== 'true' || context.compared.includes(fact.repository),
};

const shownOf = (fact: PullRequestFact): InsightsPullRequestResponseDto => {
  const spend = fact.taskId ? spendOfTask(fact.taskId) : null;

  return {
    pullRequest: `https://github.com/${fact.repository}/pull/${fact.number}`,
    repository: fact.repository,
    number: fact.number,
    title: fact.title,
    author: fact.author,
    authorIsBot: fact.authorIsBot,
    by: fact.by,
    taskId: fact.taskId,
    reviewTaskIds: [...fact.reviewTaskIds],
    type: fact.type,
    state: fact.state,
    openedAt: isoOf(fact.openedAt),
    closedAt: fact.closedAt === null ? null : isoOf(fact.closedAt),
    firstReviewAt:
      fact.firstReviewAt === null ? null : isoOf(fact.firstReviewAt),
    toMergeMs: toMergeOf(fact),
    inReviewMs: inReviewOf(fact),
    reviews: fact.reviewRounds,
    reviewRounds: fact.reviewRounds,
    reviewComments: fact.reviewComments,
    isRevert: fact.isRevert,
    reverted: fact.revertedBy !== null,
    revertedBy:
      fact.revertedBy === null
        ? null
        : `https://github.com/${fact.repository}/pull/${fact.revertedBy}`,
    additions: fact.additions,
    deletions: fact.deletions,
    changedFiles: fact.changedFiles,
    spend:
      spend?.amount == null
        ? null
        : { amount: spend.amount, currency: CURRENCY },
    unpriced: spend?.unpriced ?? 0,
  };
};

const PAGE_SIZE = 50;

const latestOf = (fact: PullRequestFact): number =>
  fact.closedAt ?? fact.openedAt;

export const pullRequestListOf = (
  teamId: string,
  params: URLSearchParams,
): InsightsPullRequestListResponseDto => {
  const span: Span = spanOf(periodNameOf(params.get('period')));
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const size = Math.min(
    200,
    Math.max(1, Number(params.get('size') ?? PAGE_SIZE) || PAGE_SIZE),
  );
  const facts = pullRequestFacts(teamId);
  const context = {
    compared: distinct(
      mergedIn(facts, span.now)
        .filter(isSpotlight)
        .map((fact) => fact.repository),
    ),
  };
  const matching = facts
    .filter((fact) => activeIn(fact, span.now))
    .filter((fact) =>
      Object.entries(LIST_MATCHERS).every(([key, matches]) => {
        const value = params.getAll(key).join(',');
        return value === '' || matches(fact, value, context);
      }),
    )
    .sort((one, other) => latestOf(other) - latestOf(one));

  return {
    period: span.period,
    total: matching.length,
    page,
    size,
    pullRequests: matching.slice((page - 1) * size, page * size).map(shownOf),
  };
};

export const pullRequestUrlOf = (
  teamId: string,
  taskId: string,
): string | null => {
  const fact = pullRequestFacts(teamId).find((each) => each.taskId === taskId);

  return fact
    ? `https://github.com/${fact.repository}/pull/${fact.number}`
    : null;
};
