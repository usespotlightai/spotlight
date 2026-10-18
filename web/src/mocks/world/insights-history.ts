import type {
  InsightsRunResponseDto,
  TaskResponseDto,
  TaskRunResponseDto,
} from '@/lib/api';
import type { PullRequestType } from '@/lib/insights-pull-requests';
import { perWorld } from '@/mocks/world';
import {
  EXPERIMENTS_ID,
  GROWTH_ID,
  GROWTH_RUNS,
  GROWTH_TASKS,
} from '@/mocks/world/growth';
import {
  CURRENCY,
  cents,
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
} from '@/mocks/world/insights-measures';
import {
  DELIVERY_TITLES,
  EXPERIMENT_TITLES,
  INCIDENT_TITLES,
  type Profile,
  profileOf,
  type Titled,
  versionAt,
} from '@/mocks/world/insights-profiles';
import { MAYA, PRIYA, SAM, TOM } from '@/mocks/world/people';
import {
  DELIVERY_ID,
  INCIDENTS_ID,
  PLATFORM_ID,
  PLATFORM_RUNS,
  PLATFORM_TASKS,
} from '@/mocks/world/platform';
import {
  IMPLEMENTATION_HISTORY,
  IMPLEMENTATION_ID,
  type PastRun,
} from '@/mocks/world/station-history';
import { spread } from '@/mocks/world/station-measures';
import { RUN_CHANGE_STACKS, statOf } from '@/mocks/world/work-changes';
import { RUN_STORIES } from '@/mocks/world/work-stories';

export type RunSize = 'small' | 'medium' | 'large';

type ServerCalls = {
  readonly server: string;
  readonly calls: number;
  readonly failed: number;
  readonly ms: number;
  readonly refused: string | null;
};

export type HistoryRun = InsightsRunResponseDto & {
  readonly teamId: string;
  readonly at: number;
  readonly size: RunSize;
  readonly judge: number | null;
  readonly skillsEnabled: readonly string[];
  readonly skillsUsed: readonly string[];
  readonly calls: readonly ServerCalls[];
};

type PullRequestRecord = {
  readonly repository: string;
  readonly number: number | null;
  readonly title: string;
  readonly type: PullRequestType;
  readonly openedAt: number;
  readonly firstReviewAt: number | null;
  readonly closedAt: number | null;
  readonly state: 'merged' | 'closed' | 'open';
  readonly reviewRounds: number;
  readonly reviewComments: number;
  readonly additions: number;
  readonly deletions: number;
  readonly changedFiles: number;
};

export type HistoryTask = {
  readonly id: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly title: string;
  readonly openedBy: string;
  readonly openedAt: number;
  readonly repository: string | null;
  pullRequest: PullRequestRecord | null;
};

export type History = {
  readonly runs: readonly HistoryRun[];
  readonly tasks: readonly HistoryTask[];
};

const HISTORY_DAYS = 182;

export const GROWTH_DAYS = 64;

const seeded = (seed: number) => {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
};

type Draw = () => number;

const chance = (draw: Draw, share: number): boolean => draw() < share;

const tallies = new Map<string, number>();

const steadily = (key: string, share: number): boolean => {
  const reached = (tallies.get(key) ?? 0.5) + share;
  tallies.set(key, reached >= 1 ? reached - 1 : reached);
  return reached >= 1;
};

const around = (draw: Draw, median: number): number =>
  Math.round(median * (0.55 + draw() * 0.9 + draw() ** 6 * 2.5));

const weighted = <T>(
  draw: Draw,
  choices: readonly (readonly [T, number])[],
) => {
  const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
  let left = draw() * total;
  for (const [value, weight] of choices) {
    left -= weight;
    if (left <= 0) {
      return value;
    }
  }
  return choices[0]?.[0] as T;
};

const SIZES: Record<string, readonly (readonly [RunSize, number])[]> = {
  station_implementation: [
    ['small', 3],
    ['medium', 5],
    ['large', 2],
  ],
  station_build: [
    ['small', 3],
    ['medium', 5],
    ['large', 2],
  ],
  station_mitigate: [
    ['small', 7],
    ['medium', 3],
  ],
};

const SMALL_ONLY: readonly (readonly [RunSize, number])[] = [['small', 1]];

const tokensOf = (draw: Draw, profile: Profile, amount: number | null) => {
  if (amount === null) {
    return null;
  }
  const input = Math.round(amount * 95_000 * (0.8 + draw() * 0.4));

  return {
    input,
    output: Math.round(input * 0.12),
    cacheRead: Math.round(input * profile.cacheReads * (0.8 + draw() * 0.4)),
    cacheWrite: Math.round(input * 0.07),
  };
};

const enabledAnywhere = (profile: Profile, skill: string): boolean =>
  profile.versions.some((version) => version.skills.includes(skill));

const skillsUsedOf = (
  draw: Draw,
  profile: Profile,
  enabled: readonly string[],
): string[] =>
  profile.uses
    .filter(
      ([skill, share]) =>
        chance(draw, share) &&
        (enabled.includes(skill) || !enabledAnywhere(profile, skill)),
    )
    .map(([skill]) => skill);

const callsOf = (draw: Draw, profile: Profile): ServerCalls[] =>
  profile.servers
    .filter((use) => chance(draw, use.share))
    .map((use) => {
      const calls = Math.max(1, Math.round(use.calls * (0.4 + draw() * 1.3)));
      const failed = Array.from({ length: calls }).filter(() =>
        chance(draw, use.failure),
      ).length;

      return {
        server: use.server,
        calls,
        failed,
        ms: around(draw, use.p50Ms),
        refused: use.refusable && chance(draw, 0.04) ? use.refusable : null,
      };
    });

type Outcome =
  | { readonly kind: 'pass'; readonly to: string }
  | { readonly kind: 'ask'; readonly to: string | null };

type Ran = {
  readonly run: HistoryRun;
  readonly onward: boolean;
  readonly at: number;
};

const makeRun = (
  draw: Draw,
  task: HistoryTask,
  profile: Profile,
  queuedAt: number,
  outcome: Outcome,
  id: string,
): Ran => {
  const version = versionAt(profile, queuedAt);
  const queuedMs = Math.round(15_000 + draw() * 100_000);
  const startedAt = queuedAt + queuedMs;
  const runningMs = around(draw, profile.runningMs);
  const endedAt = startedAt + runningMs;
  const station = profile.stationId;
  const failed = steadily(`${station}:failed`, version.failed);
  const stopped = !failed && chance(draw, 0.015);
  const ended = !failed && !stopped;
  const checks =
    profile.checks && ended
      ? steadily(`${station}:checks`, version.checksFailed)
        ? ('failed' as const)
        : ('passed' as const)
      : null;
  const sentBack =
    ended &&
    outcome.kind === 'ask' &&
    (checks === 'failed'
      ? steadily(`${station}:checks-sent-back`, version.sentBack + 0.3)
      : steadily(`${station}:sent-back`, version.sentBack));
  const answeredAt = endedAt + around(draw, 50 * MINUTE_MS);
  const onward = ended && !sentBack;
  const amount = chance(draw, 0.02)
    ? null
    : cents(version.costPerRun * (0.55 + draw() * 0.9));
  const judged =
    profile.judged && ended && chance(draw, 0.2)
      ? Math.min(1, Math.max(0, version.judge + (draw() - 0.5) * 0.4))
      : null;
  const run: HistoryRun = {
    runId: id,
    taskId: task.id,
    lineId: profile.lineId,
    stationId: profile.stationId,
    fingerprint: version.fingerprint,
    harness: profile.harness,
    model: profile.model,
    effort: version.effort,
    profileKey: null,
    repositories: task.repository ? [task.repository] : [],
    openedBy: task.openedBy,
    queuedAt: new Date(queuedAt).toISOString(),
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    queuedMs,
    runningMs,
    ms: runningMs,
    cost: amount === null ? null : { amount, currency: CURRENCY },
    tokens: tokensOf(draw, profile, amount),
    ending: failed ? 'failed' : stopped ? 'stopped' : 'completed',
    failure: failed
      ? (profile.failures[Math.floor(draw() * profile.failures.length)] ?? null)
      : null,
    checks,
    firstHumanAction:
      ended && outcome.kind === 'ask'
        ? {
            kind: sentBack ? 'sent-back' : 'accepted',
            at: new Date(answeredAt).toISOString(),
          }
        : null,
    passed:
      onward && outcome.to
        ? {
            to: outcome.to,
            at: new Date(
              outcome.kind === 'ask' ? answeredAt : endedAt,
            ).toISOString(),
          }
        : null,
    pullRequestState: null,
    teamId: task.teamId,
    at: endedAt,
    size: weighted(draw, SIZES[profile.stationId] ?? SMALL_ONLY),
    judge: judged === null ? null : Math.round(judged * 100) / 100,
    skillsEnabled: version.skills,
    skillsUsed: skillsUsedOf(draw, profile, version.skills),
    calls: callsOf(draw, profile),
  };

  return {
    run,
    onward,
    at: (outcome.kind === 'ask' ? answeredAt : endedAt) + 5 * MINUTE_MS,
  };
};

type Step = {
  readonly stationId: string;
  readonly outcome: Outcome;
  readonly attempts?: number;
};

const ATTEMPTS = 4;

const chainOf = (
  draw: Draw,
  task: HistoryTask,
  steps: readonly Step[],
  ids: () => string,
  cutoff: number,
  runs: HistoryRun[],
  start: number,
): number | null => {
  let at = start;

  for (const step of steps) {
    const profile = profileOf(step.stationId);
    if (!profile) {
      return null;
    }
    let onward = false;
    const attempts = step.attempts ?? ATTEMPTS;
    for (let attempt = 0; attempt < attempts && !onward; attempt += 1) {
      const ran = makeRun(draw, task, profile, at, step.outcome, ids());
      if (ran.run.at > cutoff) {
        return null;
      }
      runs.push(ran.run);
      onward = ran.onward;
      at = ran.at;
    }
    if (!onward) {
      return null;
    }
  }

  return at;
};

const DELIVERY_PEOPLE = [
  [SAM.id, 4],
  [MAYA.id, 3],
  [TOM.id, 2],
  [PRIYA.id, 1],
] as const;

const GROWTH_PEOPLE = [
  [PRIYA.id, 7],
  [SAM.id, 3],
] as const;

type LineShape = {
  readonly teamId: string;
  readonly lineId: string;
  readonly perWeekday: number;
  readonly perWeekend: number;
  readonly titles: readonly Titled[];
  readonly people: readonly (readonly [string, number])[];
  readonly repositories: readonly (readonly [string, number])[];
  readonly prefix: string;
  readonly historyDays: number;
};

const LINES: readonly LineShape[] = [
  {
    teamId: PLATFORM_ID,
    lineId: DELIVERY_ID,
    perWeekday: 2.3,
    perWeekend: 0.4,
    titles: DELIVERY_TITLES,
    people: DELIVERY_PEOPLE,
    repositories: [
      ['acme/api', 13],
      ['acme/worker', 7],
    ],
    prefix: 'task_delivery',
    historyDays: HISTORY_DAYS,
  },
  {
    teamId: PLATFORM_ID,
    lineId: INCIDENTS_ID,
    perWeekday: 0.5,
    perWeekend: 0.3,
    titles: INCIDENT_TITLES,
    people: [
      [TOM.id, 3],
      [MAYA.id, 1],
    ],
    repositories: [
      ['acme/api', 1],
      ['acme/infra', 1],
    ],
    prefix: 'task_incident',
    historyDays: HISTORY_DAYS,
  },
  {
    teamId: GROWTH_ID,
    lineId: EXPERIMENTS_ID,
    perWeekday: 0.8,
    perWeekend: 0.1,
    titles: EXPERIMENT_TITLES,
    people: GROWTH_PEOPLE,
    repositories: [['acme/web', 1]],
    prefix: 'task_experiment',
    historyDays: GROWTH_DAYS,
  },
];

const TODAY_WEEKDAY = 3;

const tasksThatDay = (draw: Draw, line: LineShape, back: number): number => {
  const weekday = (((TODAY_WEEKDAY - back) % 7) + 7) % 7;
  const rate =
    weekday === 0 || weekday === 6 ? line.perWeekend : line.perWeekday;

  return Math.floor(rate + draw());
};

const deliverySteps: readonly Step[] = [
  {
    stationId: 'station_triage',
    outcome: { kind: 'pass', to: 'station_spec' },
  },
  {
    stationId: 'station_spec',
    outcome: { kind: 'ask', to: 'station_implementation' },
  },
];

const buildStep: Step = {
  stationId: 'station_implementation',
  outcome: { kind: 'ask', to: 'station_review' },
};

const reviewStep: Step = {
  stationId: 'station_review',
  outcome: { kind: 'ask', to: 'station_completed' },
  attempts: 1,
};

const pullRequestOf = (
  draw: Draw,
  task: HistoryTask,
  type: PullRequestType,
  openedAt: number,
  firstReviewAt: number | null,
  rounds: number,
  doneAt: number | null,
  cutoff: number,
): PullRequestRecord => {
  const closingAt = doneAt === null ? null : doneAt + around(draw, 3 * HOUR_MS);
  const state =
    closingAt === null || closingAt > cutoff
      ? ('open' as const)
      : chance(draw, 0.07)
        ? ('closed' as const)
        : ('merged' as const);
  const additions = around(draw, type === 'chore' ? 30 : 160);

  return {
    repository: task.repository ?? 'acme/api',
    number: null,
    title: task.title,
    type,
    openedAt,
    firstReviewAt,
    closedAt: state === 'open' ? null : closingAt,
    state,
    reviewRounds: rounds,
    reviewComments: rounds * Math.round(1 + draw() * 2),
    additions,
    deletions: Math.round(additions * (0.1 + draw() * 0.5)),
    changedFiles: Math.max(1, Math.round(additions / 35)),
  };
};

const pullRequestStateOf = (
  pullRequest: PullRequestRecord | null,
): HistoryRun['pullRequestState'] => pullRequest?.state ?? null;

const runDeliveryTask = (
  draw: Draw,
  task: HistoryTask,
  type: PullRequestType,
  ids: () => string,
  cutoff: number,
  runs: HistoryRun[],
) => {
  let at = chainOf(draw, task, deliverySteps, ids, cutoff, runs, task.openedAt);
  let openedAt: number | null = null;
  let firstReviewAt: number | null = null;
  let rounds = 0;
  let doneAt: number | null = null;

  for (let cycle = 0; cycle < 3 && at !== null && doneAt === null; cycle += 1) {
    at = chainOf(draw, task, [buildStep], ids, cutoff, runs, at);
    if (at === null) {
      break;
    }
    openedAt ??= at - 4 * MINUTE_MS;
    const before = runs.length;
    const reviewed = chainOf(draw, task, [reviewStep], ids, cutoff, runs, at);
    const reviews = runs.slice(before);
    rounds += reviews.length;
    firstReviewAt ??= reviews[0]?.firstHumanAction
      ? Date.parse(reviews[0].firstHumanAction.at)
      : null;
    if (reviewed !== null) {
      doneAt = reviewed;
    } else {
      at = reviews.at(-1)?.firstHumanAction
        ? Date.parse(reviews.at(-1)?.firstHumanAction?.at ?? '')
        : null;
    }
  }

  if (openedAt !== null) {
    task.pullRequest = pullRequestOf(
      draw,
      task,
      type,
      openedAt,
      firstReviewAt,
      rounds,
      doneAt,
      cutoff,
    );
  }
};

const experimentSteps: readonly Step[] = [
  {
    stationId: 'station_design',
    outcome: { kind: 'ask', to: 'station_build' },
  },
  {
    stationId: 'station_build',
    outcome: { kind: 'ask', to: 'station_shipped' },
  },
];

const incidentSteps: readonly Step[] = [
  {
    stationId: 'station_investigate',
    outcome: { kind: 'ask', to: 'station_mitigate' },
  },
  {
    stationId: 'station_mitigate',
    outcome: { kind: 'ask', to: 'station_resolved' },
  },
];

const runExperiment = (
  draw: Draw,
  task: HistoryTask,
  type: PullRequestType,
  ids: () => string,
  cutoff: number,
  runs: HistoryRun[],
) => {
  const before = runs.length;
  const doneAt = chainOf(
    draw,
    task,
    experimentSteps,
    ids,
    cutoff,
    runs,
    task.openedAt,
  );
  const built = runs
    .slice(before)
    .find(
      (each) => each.stationId === 'station_build' && each.firstHumanAction,
    );
  if (built?.firstHumanAction) {
    const reviewedAt = Date.parse(built.firstHumanAction.at);
    task.pullRequest = pullRequestOf(
      draw,
      task,
      type,
      built.at + 3 * MINUTE_MS,
      reviewedAt,
      1,
      doneAt,
      cutoff,
    );
  }
};

const syntheticHistory = (cutoff: number): History => {
  tallies.clear();
  const draw = seeded(20_261_008);
  const runs: HistoryRun[] = [];
  const tasks: HistoryTask[] = [];
  const today = cutoff;
  let runCount = 0;
  const ids = () => {
    runCount += 1;
    return `run_${(4_000 + runCount).toString(36)}`;
  };

  for (const line of LINES) {
    let titleAt = 0;
    for (let back = line.historyDays; back >= 2; back -= 1) {
      const day = today - back * DAY_MS;
      const count = tasksThatDay(draw, line, back);
      for (let each = 0; each < count; each += 1) {
        const [title, type] = line.titles[
          titleAt % line.titles.length
        ] as Titled;
        titleAt += 1;
        const task: HistoryTask = {
          id: `${line.prefix}_${tasks.length + 1}`,
          teamId: line.teamId,
          lineId: line.lineId,
          title,
          openedBy: weighted(draw, line.people),
          openedAt: day + (7 + draw() * 10) * HOUR_MS,
          repository: weighted(draw, line.repositories),
          pullRequest: null,
        };
        tasks.push(task);
        if (line.lineId === DELIVERY_ID) {
          runDeliveryTask(draw, task, type, ids, cutoff, runs);
        } else if (line.lineId === EXPERIMENTS_ID) {
          runExperiment(draw, task, type, ids, cutoff, runs);
        } else {
          chainOf(draw, task, incidentSteps, ids, cutoff, runs, task.openedAt);
        }
      }
    }
  }

  const pullRequestStates = new Map(
    tasks.map((task) => [task.id, pullRequestStateOf(task.pullRequest)]),
  );

  return {
    tasks,
    runs: runs.map((run) => ({
      ...run,
      pullRequestState: pullRequestStates.get(run.taskId) ?? null,
    })),
  };
};

const WORLD_FAILURES: Record<string, string> = {
  run_billing_1: 'The runner could not reach the billing database',
};

const WORLD_TYPES: Record<string, PullRequestType> = {
  task_postgres: 'chore',
};

const MERGED_AFTER_ANSWER_MS = 5 * MINUTE_MS;

const answerOf = (run: TaskRunResponseDto): number | null => {
  const answer = RUN_STORIES[run.id]?.notes.find(
    (note) => note.kind === 'answered',
  );

  return answer
    ? Date.parse(run.updatedAt) + (answer.minutesAfterEnd ?? 0) * MINUTE_MS
    : null;
};

const finishedTask = (task: TaskResponseDto): boolean =>
  ['station_completed', 'station_resolved', 'station_shipped'].includes(
    task.stationId,
  );

const pullRequestOfTask = (
  task: TaskResponseDto,
  taskRuns: readonly TaskRunResponseDto[],
): PullRequestRecord | null => {
  if (!task.pullRequest) {
    return null;
  }
  const opener = [...taskRuns]
    .reverse()
    .find((run) => (RUN_CHANGE_STACKS[run.id] ?? []).length > 0);
  if (!opener) {
    return null;
  }
  const reviewer = taskRuns.find((run) => run.startedAt > opener.startedAt);
  const answeredAt = reviewer ? answerOf(reviewer) : answerOf(opener);
  const merged = finishedTask(task) && answeredAt !== null;
  const stat = statOf(RUN_CHANGE_STACKS[opener.id] ?? []);
  const repository = task.pullRequest.split('/').slice(3, 5).join('/');
  const number = Number(task.pullRequest.split('/').at(-1));

  return {
    repository,
    number: Number.isNaN(number) ? null : number,
    title: task.title,
    type: WORLD_TYPES[task.id] ?? 'feature',
    openedAt: Date.parse(opener.updatedAt),
    firstReviewAt: reviewer ? Date.parse(reviewer.updatedAt) : null,
    closedAt:
      merged && answeredAt !== null
        ? answeredAt + MERGED_AFTER_ANSWER_MS
        : null,
    state: merged ? 'merged' : 'open',
    reviewRounds: reviewer ? 1 : 0,
    reviewComments: reviewer ? 1 : 0,
    additions: stat.additions,
    deletions: stat.deletions,
    changedFiles: stat.files,
  };
};

const tokensOfStory = (runId: string) => {
  const spent = RUN_STORIES[runId]?.spend;

  return spent
    ? {
        input: spent.inputTokens ?? 0,
        output: spent.outputTokens ?? 0,
        cacheRead: spent.cacheReadTokens ?? 0,
        cacheWrite: spent.cacheWriteTokens ?? 0,
      }
    : null;
};

const worldRuns = (
  teamId: string,
  tasks: readonly TaskResponseDto[],
  runsOf: Record<string, TaskRunResponseDto[]>,
  lineOf: (stationId: string) => string,
): History => {
  const draw = seeded(7);
  const history: HistoryRun[] = [];
  const records: HistoryTask[] = [];

  for (const task of tasks) {
    const taskRuns = runsOf[task.id] ?? [];
    const pullRequest = pullRequestOfTask(task, taskRuns);
    const record: HistoryTask = {
      id: task.id,
      teamId,
      lineId: lineOf(task.stationId),
      title: task.title,
      openedBy: task.createdBy?.id ?? SAM.id,
      openedAt: Date.parse(task.createdAt),
      repository: pullRequest?.repository ?? null,
      pullRequest,
    };
    records.push(record);

    taskRuns.forEach((each, at) => {
      if (each.state !== 'completed' && each.state !== 'failed') {
        return;
      }
      const profile = each.station ? profileOf(each.station.id) : undefined;
      if (!profile) {
        return;
      }
      const endedAt = Date.parse(each.updatedAt);
      const startedAt = Date.parse(each.startedAt);
      const version = versionAt(profile, startedAt);
      const later = taskRuns[at - 1];
      const answeredAt = answerOf(each);
      const amount = RUN_STORIES[each.id]?.spend?.cost ?? null;
      history.push({
        runId: each.id,
        taskId: task.id,
        lineId: profile.lineId,
        stationId: profile.stationId,
        fingerprint: version.fingerprint,
        harness: profile.harness,
        model: profile.model,
        effort: version.effort,
        profileKey: null,
        repositories: record.repository ? [record.repository] : [],
        openedBy: task.createdBy?.id ?? SAM.id,
        queuedAt: new Date(startedAt - 40_000).toISOString(),
        startedAt: each.startedAt,
        endedAt: each.updatedAt,
        queuedMs: 40_000,
        runningMs: endedAt - startedAt,
        ms: endedAt - startedAt,
        cost: amount === null ? null : { amount, currency: CURRENCY },
        tokens: tokensOfStory(each.id),
        ending: each.state === 'failed' ? 'failed' : 'completed',
        failure: WORLD_FAILURES[each.id] ?? null,
        checks: profile.checks
          ? each.state === 'failed'
            ? 'failed'
            : 'passed'
          : null,
        firstHumanAction:
          answeredAt === null
            ? null
            : { kind: 'accepted', at: new Date(answeredAt).toISOString() },
        passed:
          each.state === 'completed' && later?.station
            ? { to: later.station.id, at: later.startedAt }
            : null,
        pullRequestState: record.pullRequest?.state ?? null,
        teamId,
        at: endedAt,
        size: profile.checks ? 'medium' : 'small',
        judge: null,
        skillsEnabled: version.skills,
        skillsUsed: skillsUsedOf(draw, profile, version.skills),
        calls: callsOf(draw, profile),
      });
    });
  }

  return { runs: history, tasks: records };
};

const NAMED_PEOPLE = [SAM.id, MAYA.id, TOM.id, PRIYA.id];

const namedRunOf = (
  draw: Draw,
  profile: Profile,
  past: PastRun,
  reviewAt: (hours: number) => string,
): HistoryRun => {
  const endedAt = Date.now() - past.endedHoursAgo * HOUR_MS;
  const runningMs = Math.round(spread(past.runId, 5, 21) * MINUTE_MS);
  const startedAt = endedAt - runningMs;
  const version = versionAt(profile, startedAt);
  const amount = cents(version.costPerRun * spread(past.runId, 0.7, 1.3));
  const later = (hours: number) =>
    new Date(endedAt + hours * HOUR_MS).toISOString();
  const ended = past.shape !== 'failed' && past.shape !== 'stopped';

  return {
    runId: past.runId,
    taskId: past.taskId,
    lineId: profile.lineId,
    stationId: profile.stationId,
    fingerprint: version.fingerprint,
    harness: profile.harness,
    model: profile.model,
    effort: version.effort,
    profileKey: null,
    repositories: ['acme/api'],
    openedBy: '',
    queuedAt: new Date(startedAt - 40_000).toISOString(),
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    queuedMs: 40_000,
    runningMs,
    ms: runningMs,
    cost: { amount, currency: CURRENCY },
    tokens: tokensOf(draw, profile, amount),
    ending:
      past.shape === 'failed'
        ? 'failed'
        : past.shape === 'stopped'
          ? 'stopped'
          : 'completed',
    failure: past.shape === 'failed' ? 'The agent ran out of turns' : null,
    checks: ended ? (past.shape === 'sent-back' ? 'failed' : 'passed') : null,
    firstHumanAction:
      past.shape === 'accepted'
        ? { kind: 'accepted', at: later(0.6) }
        : past.shape === 'sent-back'
          ? { kind: 'sent-back', at: later(1.5) }
          : null,
    passed:
      past.shape === 'accepted' || past.shape === 'passed'
        ? {
            to: 'station_review',
            at: reviewAt(past.shape === 'accepted' ? 0.6 : 0.4),
          }
        : null,
    pullRequestState: null,
    teamId: PLATFORM_ID,
    at: endedAt,
    size: 'medium',
    judge: null,
    skillsEnabled: version.skills,
    skillsUsed: skillsUsedOf(draw, profile, version.skills),
    calls: [],
  };
};

const namedHistory = (): History => {
  const profile = profileOf(IMPLEMENTATION_ID);
  if (!profile) {
    return { runs: [], tasks: [] };
  }
  const draw = seeded(58);
  const byTask = new Map<string, PastRun[]>();
  for (const past of IMPLEMENTATION_HISTORY) {
    byTask.set(past.taskId, [...(byTask.get(past.taskId) ?? []), past]);
  }

  return [...byTask.entries()].reduce<History>(
    (made, [taskId, pasts], place) => {
      const openedBy = NAMED_PEOPLE[place % NAMED_PEOPLE.length] ?? SAM.id;
      const runs = pasts.map((past) => ({
        ...namedRunOf(draw, profile, past, (hours) =>
          new Date(
            Date.now() - (past.endedHoursAgo - hours) * HOUR_MS,
          ).toISOString(),
        ),
        openedBy,
      }));
      const first = Math.min(
        ...runs.map((run) => Date.parse(run.startedAt ?? '')),
      );
      const shipped = runs.find(
        (run) => run.firstHumanAction?.kind === 'accepted',
      );
      const delivered = runs.some((run) => run.passed || run.firstHumanAction);
      const pullRequest: PullRequestRecord | null = delivered
        ? {
            repository: 'acme/api',
            number: null,
            title: pasts[0]?.title ?? taskId,
            type: 'feature',
            openedAt: Math.min(...runs.map((run) => run.at)) + MINUTE_MS,
            firstReviewAt: null,
            closedAt: shipped?.firstHumanAction
              ? Date.parse(shipped.firstHumanAction.at) + 2 * HOUR_MS
              : null,
            state: shipped ? 'merged' : 'open',
            reviewRounds: runs.length,
            reviewComments: runs.length * 2,
            additions: Math.round(spread(taskId, 40, 220)),
            deletions: Math.round(spread(taskId, 8, 90)),
            changedFiles: Math.round(spread(taskId, 2, 7)),
          }
        : null;
      const task: HistoryTask = {
        id: taskId,
        teamId: PLATFORM_ID,
        lineId: DELIVERY_ID,
        title: pasts[0]?.title ?? taskId,
        openedBy,
        openedAt: first - 3 * HOUR_MS,
        repository: 'acme/api',
        pullRequest,
      };

      return {
        runs: [
          ...made.runs,
          ...runs.map((run) => ({
            ...run,
            pullRequestState: pullRequestStateOf(pullRequest),
          })),
        ],
        tasks: [...made.tasks, task],
      };
    },
    { runs: [], tasks: [] },
  );
};

const PLATFORM_LINE_OF = (stationId: string): string =>
  [
    'station_incoming',
    'station_investigate',
    'station_mitigate',
    'station_resolved',
  ].includes(stationId)
    ? INCIDENTS_ID
    : DELIVERY_ID;

const buildHistory = (): History => {
  const cutoff = Date.now() - 2 * HOUR_MS;
  const synthetic = syntheticHistory(cutoff);
  const named = namedHistory();
  const platform = worldRuns(
    PLATFORM_ID,
    PLATFORM_TASKS,
    PLATFORM_RUNS,
    PLATFORM_LINE_OF,
  );
  const growth = worldRuns(
    GROWTH_ID,
    GROWTH_TASKS,
    GROWTH_RUNS,
    () => EXPERIMENTS_ID,
  );

  return {
    runs: [
      ...synthetic.runs,
      ...named.runs,
      ...platform.runs,
      ...growth.runs,
    ].sort((one, other) => other.at - one.at),
    tasks: [
      ...synthetic.tasks,
      ...named.tasks,
      ...platform.tasks,
      ...growth.tasks,
    ],
  };
};

const EMPTY_HISTORY: History = { runs: [], tasks: [] };

let built: History | null = null;

const fullHistory = (): History => {
  built ??= buildHistory();
  return built;
};

export const history = perWorld((kind) =>
  kind === 'empty' ? EMPTY_HISTORY : fullHistory(),
);

export const runsOfTeam = (teamId: string): readonly HistoryRun[] =>
  history().runs.filter((run) => run.teamId === teamId);

export const tasksOfTeam = (teamId: string): readonly HistoryTask[] =>
  history().tasks.filter((task) => task.teamId === teamId);
