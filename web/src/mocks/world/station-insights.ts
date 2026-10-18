import type {
  ConfigChangeResponseDto,
  FingerprintGroupResponseDto,
  LineResponseDto,
  RunTallyResponseDto,
  RunUsageResponseDto,
  StationInsightsResponseDto,
  StationResponseDto,
  StationRunOutcomeResponseDto,
} from '@/lib/api';
import { world } from '@/mocks/world';
import { type HistoryRun, history } from '@/mocks/world/insights-history';
import { profileOf } from '@/mocks/world/insights-profiles';
import { historyTaskOf, visitOf } from '@/mocks/world/past-work';
import { storyOf } from '@/mocks/world/run-stories';
import { IMPLEMENTATION_VERSIONS } from '@/mocks/world/station-history';
import {
  dayOf,
  medianOf,
  percentileOf,
  rateOf,
  rounded,
} from '@/mocks/world/station-measures';

export type StationRun = {
  readonly title: string;
  readonly outcome: StationRunOutcomeResponseDto;
};

export type StationVersion = {
  readonly fingerprint: string;
  readonly changes: readonly ConfigChangeResponseDto[];
  readonly pullRequest: string | null;
};

const DEFAULT_LAST = 50;
const MAX_LAST = 200;

const lineOf = (teamId: string, lineId: string): LineResponseDto | undefined =>
  world().lines[teamId]?.find((each) => each.id === lineId);

export const stationOf = (
  teamId: string,
  lineId: string,
  stationId: string,
): StationResponseDto | undefined =>
  lineOf(teamId, lineId)?.stations.find((each) => each.id === stationId);

const usageOf = (run: HistoryRun): RunUsageResponseDto => {
  const story = storyOf(run.runId);
  const spent = story.spend;

  return {
    ms: run.ms,
    steps: story.steps.length,
    errors: story.steps.filter((step) => step.status === 'failed').length,
    contextTokens: spent
      ? (spent.inputTokens ?? 0) +
        (spent.outputTokens ?? 0) +
        (spent.cacheWriteTokens ?? 0)
      : null,
    cost: run.cost?.amount ?? null,
    currency: run.cost?.currency ?? null,
  };
};

const outcomeOf = (run: HistoryRun): StationRunOutcomeResponseDto => ({
  runId: run.runId,
  taskId: run.taskId,
  endedAt: run.endedAt ?? new Date(run.at).toISOString(),
  ending: run.ending,
  failure: run.failure,
  visit: visitOf(run.runId),
  usage: usageOf(run),
  checks: run.checks,
  firstHumanAction: run.firstHumanAction,
  passed: run.passed,
  pullRequestState: run.pullRequestState,
});

const historyAt = (
  teamId: string,
  lineId: string,
  stationId: string,
): readonly HistoryRun[] =>
  history().runs.filter(
    (run) =>
      run.teamId === teamId &&
      run.lineId === lineId &&
      run.stationId === stationId,
  );

const versionsOf = (stationId: string): StationVersion[] =>
  [...(profileOf(stationId)?.versions ?? [])].reverse().map((version) => ({
    fingerprint: version.fingerprint,
    changes: version.changes,
    pullRequest:
      IMPLEMENTATION_VERSIONS.find(
        (each) => each.fingerprint === version.fingerprint,
      )?.pullRequest ?? null,
  }));

const byLatestStart = (one: HistoryRun, other: HistoryRun) =>
  (other.startedAt ?? '').localeCompare(one.startedAt ?? '');

export const stationRuns = (
  teamId: string,
  lineId: string,
  stationId: string,
  last = Number.POSITIVE_INFINITY,
): { runs: StationRun[]; versions: readonly StationVersion[] } => {
  const station = stationOf(teamId, lineId, stationId);

  if (station?.kind !== 'work') {
    return { runs: [], versions: [] };
  }

  const runs = [...historyAt(teamId, lineId, stationId)]
    .sort(byLatestStart)
    .slice(0, last)
    .map((run) => ({
      title: historyTaskOf(run.taskId)?.title ?? '',
      outcome: outcomeOf(run),
    }))
    .sort((one, other) =>
      other.outcome.endedAt.localeCompare(one.outcome.endedAt),
    );

  return {
    runs,
    versions: runs.length === 0 ? [] : versionsOf(stationId),
  };
};

const tallyOf = (
  runs: readonly StationRunOutcomeResponseDto[],
): RunTallyResponseDto => {
  const count = (matches: (run: StationRunOutcomeResponseDto) => boolean) =>
    runs.filter(matches).length;
  const failed = count((run) => run.ending === 'failed');
  const durationsMs = runs.flatMap((run) =>
    run.usage?.ms ? [run.usage.ms] : [],
  );
  const priced = runs.filter((run) => run.usage?.cost != null);
  const spent = priced.reduce(
    (total, run) => total + (run.usage?.cost ?? 0),
    0,
  );

  return {
    runs: runs.length,
    cancelled: 0,
    failed,
    failedRate: rateOf(failed, runs.length),
    stopped: count((run) => run.ending === 'stopped'),
    checksPassed: count((run) => run.checks === 'passed'),
    checksFailed: count((run) => run.checks === 'failed'),
    accepted: count((run) => run.firstHumanAction?.kind === 'accepted'),
    sentBack: count((run) => run.firstHumanAction?.kind === 'sent-back'),
    passed: count((run) => run.passed !== null),
    merged: new Set(
      runs
        .filter((run) => run.pullRequestState === 'merged')
        .map((run) => run.taskId),
    ).size,
    cost:
      priced.length === 0 ? null : { amount: rounded(spent), currency: 'USD' },
    unpriced: runs.length - priced.length,
    mixedCurrencies: false,
    medianMs: medianOf(durationsMs),
    p90Ms: percentileOf(durationsMs, 90),
  };
};

const groupOf = (
  version: StationVersion,
  runs: readonly StationRunOutcomeResponseDto[],
): FingerprintGroupResponseDto | null => {
  const newest = runs[0];
  const oldest = runs[runs.length - 1];

  if (!newest || !oldest) {
    return null;
  }

  const tally = tallyOf(runs);

  return {
    firstRunId: oldest.runId,
    fingerprint: version.fingerprint,
    ran: true,
    config: null,
    changes: [...version.changes],
    pullRequest: version.pullRequest ? { url: version.pullRequest } : null,
    runs: [...runs],
    tally,
    rates: {
      checksPassed: rateOf(
        tally.checksPassed,
        tally.checksPassed + tally.checksFailed,
      ),
      accepted: rateOf(tally.accepted, tally.runs),
      merged: rateOf(tally.merged, tally.runs),
    },
    firstDay: dayOf(oldest.endedAt),
    lastDay: dayOf(newest.endedAt),
  };
};

const lastOf = (requested: number | null): number =>
  requested === null || Number.isNaN(requested)
    ? DEFAULT_LAST
    : Math.min(MAX_LAST, Math.max(1, requested));

export const stationRunOutcomes = (
  teamId: string,
  lineId: string,
  stationId: string,
  requested: number | null = null,
): StationInsightsResponseDto => {
  const last = lastOf(requested);
  const { runs, versions } = stationRuns(teamId, lineId, stationId, last);
  const fingerprints = new Map(
    historyAt(teamId, lineId, stationId).map((run) => [
      run.runId,
      run.fingerprint,
    ]),
  );
  const groups = versions.flatMap((version) => {
    const inside = runs
      .map((run) => run.outcome)
      .filter((run) => fingerprints.get(run.runId) === version.fingerprint);
    const group = groupOf(version, inside);

    return group ? [group] : [];
  });
  const [current] = groups;

  return {
    stationId,
    groups,
    inForce: current ? { tally: current.tally } : null,
  };
};
