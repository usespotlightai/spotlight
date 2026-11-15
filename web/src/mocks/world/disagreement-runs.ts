import { type HistoryRun, history } from '@/mocks/world/insights-history';
import { isCoreTask } from '@/mocks/world/past-work';
import { PLATFORM_ID } from '@/mocks/world/platform';
import { onEarlierRubric } from '@/mocks/world/station-judge';

const PASS_MARK = 0.5;

const judgedRuns = (): HistoryRun[] =>
  history().runs.filter(
    (run) =>
      run.teamId === PLATFORM_ID &&
      run.stationId === 'station_implementation' &&
      run.judge !== null &&
      !isCoreTask(run.taskId),
  );

const judgePasses = (run: HistoryRun): boolean => (run.judge ?? 0) >= PASS_MARK;

const onCurrentClaims = (run: HistoryRun): boolean => !onEarlierRubric(run.at);

const newest = (runs: readonly HistoryRun[], skip = 0): HistoryRun | null =>
  runs.toSorted((one, other) => other.at - one.at)[skip] ?? null;

const sentBackRuns = (): HistoryRun[] =>
  judgedRuns().filter(
    (run) =>
      onCurrentClaims(run) &&
      judgePasses(run) &&
      run.firstHumanAction?.kind === 'sent-back',
  );

export const sentBackRun = (): HistoryRun | null => newest(sentBackRuns());

export const labelGoneRun = (): HistoryRun | null => newest(sentBackRuns(), 1);

const acceptedRuns = (): HistoryRun[] =>
  judgedRuns().filter(
    (run) =>
      onCurrentClaims(run) &&
      !judgePasses(run) &&
      run.firstHumanAction?.kind === 'accepted',
  );

export const acceptedRun = (): HistoryRun | null => newest(acceptedRuns());

export const askedOfOtherRun = (): HistoryRun | null =>
  newest(acceptedRuns(), 1);

export const mergedRun = (): HistoryRun | null =>
  newest(
    acceptedRuns().filter((run) => run.pullRequestState === 'merged'),
    2,
  );

export const claimsChangedRun = (): HistoryRun | null =>
  newest(
    judgedRuns().filter(
      (run) =>
        onEarlierRubric(run.at) &&
        !judgePasses(run) &&
        run.firstHumanAction?.kind === 'accepted',
    ),
  );
