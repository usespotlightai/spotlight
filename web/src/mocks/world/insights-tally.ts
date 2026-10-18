import type {
  ConfigMarkerResponseDto,
  MeasureVerdictResponseDto,
  PersonNameResponseDto,
  RunTallyResponseDto,
} from '@/lib/api';
import { world } from '@/mocks/world';
import {
  type HistoryRun,
  type HistoryTask,
  runsOfTeam,
  tasksOfTeam,
} from '@/mocks/world/insights-history';
import {
  CURRENCY,
  cents,
  distinct,
  emptyTally,
  MEASURES,
  quantile,
  type Reading,
  shareOf,
  sumOf,
  verdictFor,
  type Window,
  within,
} from '@/mocks/world/insights-measures';
import {
  PROFILES,
  type Profile,
  type Version,
} from '@/mocks/world/insights-profiles';
import { PEOPLE } from '@/mocks/world/people';

export const runsIn = (teamId: string, window: Window): readonly HistoryRun[] =>
  runsOfTeam(teamId).filter((run) => within(run.at, window));

export const pullRequestsClosedIn = (
  teamId: string,
  window: Window,
): readonly HistoryTask[] =>
  tasksOfTeam(teamId).filter(
    (task) =>
      task.pullRequest?.closedAt != null &&
      within(task.pullRequest.closedAt, window),
  );

export const mergedIn = (
  teamId: string,
  window: Window,
): readonly HistoryTask[] =>
  pullRequestsClosedIn(teamId, window).filter(
    (task) => task.pullRequest?.state === 'merged',
  );

export const spendOf = (runs: readonly HistoryRun[]): number | null => {
  const priced = runs.filter((run) => run.cost !== null);
  return priced.length === 0
    ? null
    : cents(sumOf(priced.map((run) => run.cost?.amount ?? 0)));
};

export const moneyOf = (amount: number | null) =>
  amount === null ? null : { amount: cents(amount), currency: CURRENCY };

const mergedTasksOf = (runs: readonly HistoryRun[]): number =>
  distinct(
    runs
      .filter((run) => run.pullRequestState === 'merged')
      .map((run) => run.taskId),
  ).length;

export const tallyOf = (runs: readonly HistoryRun[]): RunTallyResponseDto => {
  if (runs.length === 0) {
    return emptyTally();
  }
  const count = (matches: (run: HistoryRun) => boolean) =>
    runs.filter(matches).length;
  const failed = count((run) => run.ending === 'failed');
  const durations = runs.flatMap((run) => (run.ms === null ? [] : [run.ms]));

  return {
    runs: runs.length,
    cancelled: 0,
    failed,
    failedRate: shareOf(failed, runs.length),
    stopped: count((run) => run.ending === 'stopped'),
    checksPassed: count((run) => run.checks === 'passed'),
    checksFailed: count((run) => run.checks === 'failed'),
    accepted: count((run) => run.firstHumanAction?.kind === 'accepted'),
    sentBack: count((run) => run.firstHumanAction?.kind === 'sent-back'),
    passed: count((run) => run.passed !== null),
    merged: mergedTasksOf(runs),
    cost: moneyOf(spendOf(runs)),
    unpriced: count((run) => run.cost === null),
    mixedCurrencies: false,
    medianMs: quantile(durations, 0.5),
    p90Ms: quantile(durations, 0.9),
  };
};

export const costPerRunOf = (runs: readonly HistoryRun[]): number | null => {
  const priced = runs.filter((run) => run.cost !== null);
  const spend = spendOf(priced);
  return spend === null ? null : spend / priced.length;
};

const readingOf = (
  measure: MeasureVerdictResponseDto['measure'],
  runs: readonly HistoryRun[],
): Reading => {
  const tally = tallyOf(runs);
  const asked = runs.filter((run) => run.firstHumanAction !== null).length;
  const checked = tally.checksPassed + tally.checksFailed;
  const tasks = distinct(runs.map((run) => run.taskId)).length;
  const finishedTasks = distinct(
    runs
      .filter(
        (run) =>
          run.pullRequestState === 'merged' ||
          run.pullRequestState === 'closed',
      )
      .map((run) => run.taskId),
  ).length;

  switch (measure) {
    case 'sent_back_rate':
      return { value: shareOf(tally.sentBack, tally.runs), measured: asked };
    case 'accepted_rate':
      return { value: shareOf(tally.accepted, tally.runs), measured: asked };
    case 'checks_failed_rate':
      return { value: shareOf(tally.checksFailed, checked), measured: checked };
    case 'failed_rate':
      return { value: shareOf(tally.failed, tally.runs), measured: tally.runs };
    case 'merged_rate':
      return { value: shareOf(tally.merged, tasks), measured: finishedTasks };
    case 'cost_per_run':
      return {
        value: costPerRunOf(runs),
        measured: runs.length - tally.unpriced,
      };
  }
};

export const verdictsOf = (
  before: readonly HistoryRun[],
  after: readonly HistoryRun[],
): MeasureVerdictResponseDto[] =>
  MEASURES.map((measure) =>
    verdictFor(measure, readingOf(measure, before), readingOf(measure, after)),
  );

export const profilesOfTeam = (teamId: string): readonly Profile[] =>
  PROFILES.filter((profile) => profile.teamId === teamId);

type VersionChange = {
  readonly profile: Profile;
  readonly version: Version;
  readonly previous: Version;
  readonly marker: ConfigMarkerResponseDto;
  readonly firstRunAt: number;
};

export const versionChangesOf = (teamId: string): VersionChange[] => {
  const runs = runsOfTeam(teamId);

  return profilesOfTeam(teamId).flatMap((profile) =>
    profile.versions.slice(1).flatMap((version, at) => {
      const previous = profile.versions[at] as Version;
      const first = runs
        .filter((run) => run.fingerprint === version.fingerprint)
        .reduce<HistoryRun | null>(
          (oldest, run) =>
            oldest === null || run.at < oldest.at ? run : oldest,
          null,
        );
      if (!first?.startedAt) {
        return [];
      }

      return [
        {
          profile,
          version,
          previous,
          firstRunAt: Date.parse(first.startedAt),
          marker: {
            lineId: profile.lineId,
            stationId: profile.stationId,
            fingerprint: version.fingerprint,
            previousFingerprint: previous.fingerprint,
            firstRunAt: first.startedAt,
            runId: first.runId,
          },
        },
      ];
    }),
  );
};

export const peopleNamed = (
  ids: readonly (string | null)[],
): PersonNameResponseDto[] =>
  distinct(ids)
    .flatMap((id) => (id === null ? [] : [id]))
    .map((id) => ({
      personId: id,
      name: PEOPLE.find((person) => person.id === id)?.name ?? null,
    }));

export const unansweredAsks = (teamId: string) =>
  (world().tasks[teamId] ?? []).filter((task) => task.awaitingReview !== null);
