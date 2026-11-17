import type {
  JudgeCalibrationResponseDto,
  JudgeScoreResponseDto,
  StationAlertFiringResponseDto,
} from '@/lib/api';
import type { RunLabel, RunScores } from '@/lib/judge';
import { GROWTH_LINES } from '@/mocks/world/growth';
import { ALERT_ID, COST_ALERT_ID } from '@/mocks/world/inbox';
import {
  ALERT_OVER,
  ALERT_RISES_BY,
  ALERT_STATION,
  type AlertFiring,
  alertFiring,
  COST_ALERT_ABOVE,
  COST_ALERT_OVER,
  costAlertFiring,
} from '@/mocks/world/inbox-alert';
import {
  lineOfStation,
  minutesAfter,
  runEnded,
  stationOfRun,
  taskOfSeededRun,
} from '@/mocks/world/inbox-places';
import {
  type HistoryRun,
  isLastCompletedVisit,
} from '@/mocks/world/insights-history';
import { PLATFORM_LINES } from '@/mocks/world/platform';
import { storyOf } from '@/mocks/world/run-stories';
import {
  EARLIER_RUBRIC,
  onEarlierRubric,
  RUBRIC,
} from '@/mocks/world/station-judge';
import { RUN_CHANGE_STACKS } from '@/mocks/world/work-changes';
import { RUN_STORIES, stepIndexOf } from '@/mocks/world/work-stories';

const JUDGED_STATION = 'station_implementation';

const judgeOf = (stationId: string) =>
  [...PLATFORM_LINES, ...GROWTH_LINES]
    .flatMap((line) => line.stations)
    .find((station) => station.id === stationId)?.judge ?? null;

const TRUSTED: JudgeCalibrationResponseDto = {
  qualified: true,
  agreement: 0.71,
  reading: 'substantial',
  pairs: 24,
  minPairs: 10,
  minAgreement: 0.6,
  hiddenReason: null,
  failing: false,
};

const NEW_JUDGE: JudgeCalibrationResponseDto = {
  qualified: false,
  agreement: null,
  reading: null,
  pairs: 0,
  minPairs: 10,
  minAgreement: 0.6,
  hiddenReason: 'too-few-pairs',
  failing: false,
};

const NO_JUDGE: JudgeCalibrationResponseDto = {
  qualified: false,
  agreement: null,
  reading: null,
  pairs: 0,
  minPairs: 10,
  minAgreement: null,
  hiddenReason: 'no-judge',
  failing: true,
};

const metOf = (claimResults: readonly boolean[]) =>
  claimResults.filter(Boolean).length;

const scoreOf = (claimResults: readonly boolean[]) => ({
  value: claimResults.length ? metOf(claimResults) / claimResults.length : 0,
  claimResults: [...claimResults],
  passes:
    claimResults.length > 0 && metOf(claimResults) === claimResults.length,
});

const verdict = (
  runId: string,
  claimResults: readonly boolean[],
  reasons: JudgeScoreResponseDto['reasons'],
): JudgeScoreResponseDto => ({
  ...scoreOf(claimResults),
  rubricVersion: RUBRIC,
  model: 'google/gemini-3.8-flash',
  at: minutesAfter(runEnded(runId), 3),
  reasons,
});

const citedStep = (index: number, tool: string | null, text: string) => ({
  kind: 'step' as const,
  step: { index, kind: tool ? 'tool' : 'message', tool, text },
  hunk: null,
});

const citedHunk = (
  id: string,
  path: string,
  header: string,
  lines: string[],
) => ({
  kind: 'hunk' as const,
  step: null,
  hunk: { id, path, header, lines },
});

const citedStackHunk = (runId: string, path: string) => {
  const found = RUN_CHANGE_STACKS[runId]
    ?.flatMap((stack) => stack.files)
    .find((each) => each.path === path)?.hunks[0];
  const [header = '', ...lines] = found?.patch.split('\n') ?? [];

  return citedHunk(found?.id ?? path, path, header, lines);
};

const citedMessage = (runId: string) => {
  const steps = RUN_STORIES[runId]?.steps ?? [];
  const index = steps.findLastIndex((step) => step.kind === 'message');

  return citedStep(index, null, steps[index]?.text ?? '');
};

const lastStepIndexOf = (runId: string, text: string): number =>
  (RUN_STORIES[runId]?.steps ?? []).findLastIndex((step) => step.text === text);

const JUDGED: Record<string, Pick<RunScores, 'judge' | 'label'>> = {
  run_postgres_2: {
    label: { from: 'sent-back' },
    judge: verdict(
      'run_postgres_2',
      [true, true, true],
      [
        {
          claim: 0,
          text: 'It upgraded the driver and fixed the two tests the new timestamp precision broke, without touching files the spec did not name.',
          citations: [
            citedStep(
              lastStepIndexOf('run_postgres_2', 'npm test'),
              'execute',
              'npm test',
            ),
            citedStackHunk('run_postgres_2', 'src/db/timestamps.ts'),
          ],
        },
        {
          claim: 1,
          text: 'The two tests the new precision broke pass again.',
          citations: [
            citedStep(
              lastStepIndexOf('run_postgres_2', 'npm test'),
              'execute',
              'npm test',
            ),
          ],
        },
        {
          claim: 2,
          text: 'It said the migration rewrites 1.3M rows and left batching to review, rather than deciding it alone.',
          citations: [citedMessage('run_postgres_2')],
        },
      ],
    ),
  },
  run_search_2: {
    label: { from: 'accepted' },
    judge: verdict(
      'run_search_2',
      [true, true, false],
      [
        {
          claim: 0,
          text: 'One index and one query change, as the spec asks.',
          citations: [],
        },
        {
          claim: 1,
          text: 'The tests pass, and the speed-up is measured.',
          citations: [
            citedStep(
              stepIndexOf('run_search_2', 'npm test -- search'),
              'execute',
              'npm test -- search',
            ),
          ],
        },
        {
          claim: 2,
          text: 'The note does not say what the run could not do: it skipped the load test the spec asks for.',
          citations: [],
        },
      ],
    ),
  },
  run_billing_1: {
    label: { from: 'sent-back' },
    judge: verdict(
      'run_billing_1',
      [false, false, true],
      [
        {
          claim: 0,
          text: 'It reconciled nothing: the script could not reach the billing database and the run exited.',
          citations: [
            citedStep(
              stepIndexOf('run_billing_1', 'npm run reconcile -- --dry-run'),
              'execute',
              'npm run reconcile -- --dry-run',
            ),
          ],
        },
        {
          claim: 1,
          text: 'No test ran, because the script exited first.',
          citations: [],
        },
        {
          claim: 2,
          text: 'The note says the billing database could not be reached.',
          citations: [citedMessage('run_billing_1')],
        },
      ],
    ),
  },
};

const PASSING: readonly RunLabel['from'][] = ['accepted', 'merged'];

const agreesOf = (
  judge: JudgeScoreResponseDto | null,
  label: RunScores['label'],
  calibration: JudgeCalibrationResponseDto,
): boolean | null =>
  judge && label && calibration.qualified
    ? judge.passes === PASSING.includes(label.from)
    : null;

const calibrationOf = (stationId: string): JudgeCalibrationResponseDto => {
  if (stationId === JUDGED_STATION) {
    return TRUSTED;
  }

  return judgeOf(stationId) ? NEW_JUDGE : NO_JUDGE;
};

const scoresOf = (runId: string): RunScores => {
  const stationId = stationOfRun(runId);
  const taskId = taskOfSeededRun(runId);
  const found = JUDGED[runId];
  const judge = found?.judge ?? null;
  const claims = judge ? (judgeOf(stationId)?.claims ?? []) : [];
  const label = found?.label ?? null;
  const calibration = calibrationOf(stationId);

  return {
    runId,
    taskId,
    stationId,
    claims,
    judged: judge !== null,
    judge,
    calibration,
    label,
    agrees: agreesOf(judge, label, calibration),
  };
};

export const withJudgeHidden = (scores: RunScores): RunScores => ({
  ...scores,
  judge: null,
  calibration: { ...NEW_JUDGE, pairs: 3 },
  agrees: null,
});

export const withCitationsGone = (scores: RunScores): RunScores =>
  scores.judge
    ? {
        ...scores,
        judge: {
          ...scores.judge,
          reasons: scores.judge.reasons.map((reason) => ({
            ...reason,
            citations: reason.citations.map((citation) => ({
              ...citation,
              step: citation.step && { ...citation.step, text: null },
              hunk: citation.hunk && {
                ...citation.hunk,
                path: citation.hunk.path?.replace(/(\.\w+)$/, '.old$1') ?? null,
              },
            })),
          })),
        },
      }
    : scores;

export const withoutPeople = (scores: RunScores): RunScores => ({
  ...scores,
  label: null,
  agrees: null,
});

export const seedRunScores = (
  runIds: readonly string[],
): Record<string, RunScores> =>
  Object.fromEntries(runIds.map((runId) => [runId, scoresOf(runId)]));

const rounded = (value: number) => Math.round(value * 100) / 100;

const endOf = (run: HistoryRun) =>
  run.endedAt ?? new Date(run.at).toISOString();

const firingFrom = (
  alertId: string,
  firing: AlertFiring,
  rule: StationAlertFiringResponseDto['rule'],
  currency: string | null,
): StationAlertFiringResponseDto => {
  const { run, value, baseline, resolved, series } = firing;
  const by = baseline === null ? null : rounded(value - baseline);

  return {
    alertId,
    lineId: lineOfStation(ALERT_STATION),
    stationId: ALERT_STATION,
    rule,
    value: rounded(value),
    baseline: baseline === null ? null : rounded(baseline),
    change:
      by === null
        ? null
        : {
            unit: 'points',
            by: Math.abs(by),
            fromZero: baseline === 0,
            direction: by >= 0 ? 'up' : 'down',
            tone: by >= 0 ? 'bad' : 'good',
          },
    runId: run.runId,
    taskId: run.taskId,
    firedAt: minutesAfter(endOf(run), 2),
    insightsPeriod: '30d',
    resolvedAt: resolved ? endOf(resolved) : null,
    currency,
    series: series.map((point) => ({
      runId: point.run.runId,
      endedAt: endOf(point.run),
      value: point.value === null ? null : rounded(point.value),
    })),
  };
};

export const seedAlerts = (): Record<string, StationAlertFiringResponseDto> => {
  const sentBack = alertFiring();
  const cost = costAlertFiring();

  return {
    ...(sentBack && {
      [ALERT_ID]: firingFrom(
        ALERT_ID,
        sentBack,
        {
          measure: 'sent_back_rate',
          risesBy: ALERT_RISES_BY,
          fallsBy: null,
          above: null,
          below: null,
          over: ALERT_OVER,
        },
        null,
      ),
    }),
    ...(cost && {
      [COST_ALERT_ID]: firingFrom(
        COST_ALERT_ID,
        cost,
        {
          measure: 'cost_per_run',
          risesBy: null,
          fallsBy: null,
          above: COST_ALERT_ABOVE,
          below: null,
          over: COST_ALERT_OVER,
        },
        'USD',
      ),
    }),
  };
};

const PASS_MARK = 0.5;

const pastJudgeOf = (
  run: HistoryRun,
  earlier: boolean,
): JudgeScoreResponseDto | null => {
  if (run.stationId !== JUDGED_STATION || run.judge === null) {
    return null;
  }

  const steps = storyOf(run.runId).steps;
  const tested = steps.findLastIndex((step) => step.tool === 'execute');
  const yes = run.judge >= PASS_MARK;
  const claimResults = earlier ? [yes, yes] : [yes, yes, true];

  return {
    ...scoreOf(claimResults),
    rubricVersion: earlier ? EARLIER_RUBRIC : RUBRIC,
    model: 'google/gemini-3.8-flash',
    at: minutesAfter(endOf(run), 3),
    reasons: claimResults.map((met, claim) => ({
      claim,
      text: met
        ? 'It changed what the spec requires and left the tests passing.'
        : 'It left a check failing and did not say why.',
      citations:
        tested < 0
          ? []
          : [citedStep(tested, 'execute', steps[tested]?.text ?? 'npm test')],
    })),
  };
};

const pastLabelOf = (run: HistoryRun): RunScores['label'] => {
  const acted = run.firstHumanAction?.kind;

  if (acted === 'accepted' || acted === 'sent-back') {
    return { from: acted };
  }
  if (run.pullRequestState === 'merged' && isLastCompletedVisit(run)) {
    return { from: 'merged' };
  }

  return null;
};

export const pastScoresOf = (run: HistoryRun): RunScores => {
  const judged = run.stationId === JUDGED_STATION;
  const earlier = judged && onEarlierRubric(run.at);
  const judge = pastJudgeOf(run, earlier);
  const calibration = judged ? TRUSTED : NO_JUDGE;
  const label = pastLabelOf(run);

  return {
    runId: run.runId,
    taskId: run.taskId,
    stationId: run.stationId,
    claims: judge
      ? (judgeOf(run.stationId)?.claims.slice(0, judge.claimResults.length) ??
        [])
      : [],
    judged: judge !== null,
    judge,
    calibration,
    label,
    agrees: agreesOf(judge, label, calibration),
  };
};
