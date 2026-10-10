import type {
  ConfigChangeResponseDto,
  FingerprintGroupResponseDto,
  LineResponseDto,
  RunCostResponseDto,
  RunTallyResponseDto,
  StationOutcomesResponseDto,
  StationResponseDto,
  StationRunOutcomeResponseDto,
} from '@/lib/api';
import { world } from '@/mocks/world';
import { type HistoryRun, history } from '@/mocks/world/insights-history';
import { profileOf } from '@/mocks/world/insights-profiles';
import { historyTaskOf, roundOf } from '@/mocks/world/past-work';
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
const MOST_LAST = 200;

export const lineOf = (
  teamId: string,
  lineId: string,
): LineResponseDto | undefined =>
  world().lines[teamId]?.find((each) => each.id === lineId);

export const stationOf = (
  teamId: string,
  lineId: string,
  stationId: string,
): StationResponseDto | undefined =>
  lineOf(teamId, lineId)?.stations.find((each) => each.id === stationId);

const costOf = (run: HistoryRun): RunCostResponseDto => {
  const story = storyOf(run.runId);
  const spent = story.spend;

  return {
    ms: run.ms,
    steps: story.steps.length,
    faults: story.steps.filter((step) => step.status === 'failed').length,
    used: spent
      ? (spent.inputTokens ?? 0) +
        (spent.outputTokens ?? 0) +
        (spent.cacheWriteTokens ?? 0)
      : null,
    cost: run.cost?.amount ?? null,
    currency: run.cost?.currency ?? null,
  };
};

export const outcomeOf = (run: HistoryRun): StationRunOutcomeResponseDto => ({
  runId: run.runId,
  taskId: run.taskId,
  endedAt: run.endedAt ?? new Date(run.at).toISOString(),
  ending: run.ending,
  failure: run.failure,
  round: roundOf(run.runId),
  cost: costOf(run),
  checks: run.checks,
  next: run.next,
  handedOn: run.handedOn,
  delivery: run.delivery,
});

export const historyAt = (
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

export const tallyOf = (
  runs: readonly StationRunOutcomeResponseDto[],
): RunTallyResponseDto => {
  const count = (holds: (run: StationRunOutcomeResponseDto) => boolean) =>
    runs.filter(holds).length;
  const failed = count((run) => run.ending === 'failed');
  const took = runs.flatMap((run) => (run.cost?.ms ? [run.cost.ms] : []));
  const priced = runs.filter((run) => run.cost?.cost != null);
  const spent = priced.reduce((total, run) => total + (run.cost?.cost ?? 0), 0);

  return {
    runs: runs.length,
    withdrawn: 0,
    failed,
    failedShare: rateOf(failed, runs.length),
    stopped: count((run) => run.ending === 'stopped'),
    checksPassed: count((run) => run.checks === 'passed'),
    checksFailed: count((run) => run.checks === 'failed'),
    accepted: count((run) => run.next?.act === 'closed'),
    sentBack: count((run) => run.next?.act === 'sent-back'),
    handedOn: count((run) => run.handedOn !== null),
    merged: new Set(
      runs.filter((run) => run.delivery === 'merged').map((run) => run.taskId),
    ).size,
    cost:
      priced.length === 0 ? null : { amount: rounded(spent), currency: 'USD' },
    unpriced: runs.length - priced.length,
    mixedCurrencies: false,
    medianMs: medianOf(took),
    p90Ms: percentileOf(took, 90),
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
    shares: {
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

const lastOf = (asked: number | null): number =>
  asked === null || Number.isNaN(asked)
    ? DEFAULT_LAST
    : Math.min(MOST_LAST, Math.max(1, asked));

export const stationOutcomes = (
  teamId: string,
  lineId: string,
  stationId: string,
  asked: number | null = null,
): StationOutcomesResponseDto => {
  const last = lastOf(asked);
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
