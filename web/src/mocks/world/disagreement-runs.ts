import type { LabelSource } from '@/lib/judge';
import { type HistoryRun, history } from '@/mocks/world/insights-history';
import {
  historyRunOf,
  historyRunsOfTask,
  historyTaskOf,
  isCoreTask,
} from '@/mocks/world/past-work';
import { SAM } from '@/mocks/world/people';
import { PLATFORM_ID } from '@/mocks/world/platform';
import { firstActLabelOf, labelOf } from '@/mocks/world/run-labels';
import {
  claimsChangedAt,
  EARLIER_RUBRIC,
  RUBRIC,
  rubricAt,
} from '@/mocks/world/station-judge';

export type Opening = {
  readonly run: HistoryRun;
  readonly labelFrom: LabelSource;
  readonly askedOf: string | null;
  readonly openedAt: string;
};

export type Withdrawal = Opening & { readonly withdrawnAt: string };

const PASS_MARK = 0.5;

const OPENS_AFTER_LABEL_MS = 5 * 60_000;

const isoOf = (at: number): string => new Date(at).toISOString();

const judgedRuns = (): HistoryRun[] =>
  history().runs.filter(
    (run) =>
      run.teamId === PLATFORM_ID &&
      run.stationId === 'station_implementation' &&
      run.judge !== null &&
      !isCoreTask(run.taskId),
  );

const judgePasses = (run: HistoryRun): boolean => (run.judge ?? 0) >= PASS_MARK;

const judgedUnder =
  (rubricVersion: string) =>
  (run: HistoryRun): boolean =>
    rubricAt(run.at) === rubricVersion;

const actorOf = (run: HistoryRun): string | null =>
  historyTaskOf(run.taskId)?.openedBy ?? null;

const actedAtOf = (run: HistoryRun): number | null =>
  run.firstHumanAction ? Date.parse(run.firstHumanAction.at) : null;

const mergedAtOf = (run: HistoryRun): number | null => {
  const pullRequest = historyTaskOf(run.taskId)?.pullRequest;

  return pullRequest?.state === 'merged' ? pullRequest.closedAt : null;
};

const laterCompletedVisitOf = (run: HistoryRun): HistoryRun | null =>
  historyRunsOfTask(run.taskId).find(
    (other) =>
      other.stationId === run.stationId &&
      other.ending === 'completed' &&
      other.at > run.at,
  ) ?? null;

const firstActOpening = (run: HistoryRun): Opening | null => {
  const labelFrom = firstActLabelOf(run);
  const actedAt = actedAtOf(run);
  const actor = actorOf(run);

  return labelFrom && actedAt !== null && actor !== null
    ? {
        run,
        labelFrom,
        askedOf: actor,
        openedAt: isoOf(actedAt + OPENS_AFTER_LABEL_MS),
      }
    : null;
};

const mergeOpening = (run: HistoryRun): Opening | null => {
  const mergedAt = mergedAtOf(run);

  return mergedAt === null
    ? null
    : {
        run,
        labelFrom: 'merged',
        askedOf: null,
        openedAt: isoOf(mergedAt + OPENS_AFTER_LABEL_MS),
      };
};

const openingOf = (run: HistoryRun): Opening | null =>
  labelOf(run) === 'merged' ? mergeOpening(run) : firstActOpening(run);

export const openingOfRun = (runId: string): Opening | null => {
  const run = historyRunOf(runId);

  return run ? openingOf(run) : null;
};

const newest = <Found extends Opening>(
  found: readonly (Found | null)[],
): Found | null =>
  found
    .filter((each): each is Found => each !== null)
    .toSorted((one, other) => other.run.at - one.run.at)[0] ?? null;

const onCurrentClaims = judgedUnder(RUBRIC);

export const sentBackRun = (): Opening | null =>
  newest(
    judgedRuns()
      .filter(
        (run) =>
          onCurrentClaims(run) &&
          judgePasses(run) &&
          firstActLabelOf(run) === 'sent-back' &&
          actorOf(run) === SAM.id,
      )
      .map(firstActOpening),
  );

export const acceptedRun = (): Opening | null =>
  newest(
    judgedRuns()
      .filter(
        (run) =>
          onCurrentClaims(run) &&
          !judgePasses(run) &&
          firstActLabelOf(run) === 'accepted' &&
          actorOf(run) === SAM.id,
      )
      .map(firstActOpening),
  );

const mergedThenFailedRuns = (): HistoryRun[] =>
  judgedRuns().filter(
    (run) =>
      onCurrentClaims(run) && !judgePasses(run) && mergedAtOf(run) !== null,
  );

export const mergedRun = (): Opening | null =>
  newest(
    mergedThenFailedRuns()
      .filter((run) => labelOf(run) === 'merged')
      .map(mergeOpening),
  );

const labelGoneOf = (run: HistoryRun): Withdrawal | null => {
  const opening = mergeOpening(run);
  const later = laterCompletedVisitOf(run);

  return opening &&
    later?.endedAt &&
    firstActLabelOf(run) === null &&
    run.ending === 'completed' &&
    later.endedAt > opening.openedAt
    ? { ...opening, withdrawnAt: later.endedAt }
    : null;
};

export const labelGoneRun = (): Withdrawal | null =>
  newest(mergedThenFailedRuns().map(labelGoneOf));

const verdictsAgreeOf = (run: HistoryRun): Withdrawal | null => {
  const opening = mergeOpening(run);
  const later = laterCompletedVisitOf(run);

  return opening &&
    run.firstHumanAction &&
    firstActLabelOf(run) === 'sent-back' &&
    run.ending === 'completed' &&
    run.firstHumanAction.at > opening.openedAt &&
    (!later?.endedAt || later.endedAt > run.firstHumanAction.at)
    ? { ...opening, withdrawnAt: run.firstHumanAction.at }
    : null;
};

export const verdictsAgreeRun = (): Withdrawal | null =>
  newest(mergedThenFailedRuns().map(verdictsAgreeOf));

const claimsChangedOf = (run: HistoryRun): Withdrawal | null => {
  const opening = firstActOpening(run);
  const changedAt = claimsChangedAt();

  return opening && opening.openedAt < changedAt
    ? { ...opening, withdrawnAt: changedAt }
    : null;
};

export const claimsChangedRun = (): Withdrawal | null =>
  newest(
    judgedRuns()
      .filter(
        (run) =>
          judgedUnder(EARLIER_RUBRIC)(run) &&
          !judgePasses(run) &&
          firstActLabelOf(run) === 'accepted' &&
          actorOf(run) === SAM.id,
      )
      .map(claimsChangedOf),
  );
