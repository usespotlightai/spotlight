import type {
  GradeResponseDto,
  JudgeCalibrationResponseDto,
  JudgeScoreResponseDto,
  RunScoresResponseDto,
  StationAlertCrossingResponseDto,
} from '@/lib/api';
import { GROWTH_LINES } from '@/mocks/world/growth';
import { ALERT_ID, COST_ALERT_ID } from '@/mocks/world/inbox';
import {
  ALERT_OVER,
  ALERT_RISES_BY,
  ALERT_STATION,
  type AlertCrossing,
  alertCrossing,
  COST_ALERT_ABOVE,
  COST_ALERT_OVER,
  costAlertCrossing,
} from '@/mocks/world/inbox-alert';
import {
  lineOfStation,
  minutesAfter,
  runEnded,
  stationOfRun,
  taskOfSeededRun,
} from '@/mocks/world/inbox-places';
import type { HistoryRun } from '@/mocks/world/insights-history';
import { PRIYA, SAM } from '@/mocks/world/people';
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

const rubricBodyOf = (stationId: string): string | null =>
  judgeOf(stationId)?.rubric?.replace(/^##[^\n]*\n+/, '') ?? null;

const TRUSTED: JudgeCalibrationResponseDto = {
  trusted: true,
  measure: 'kappa',
  agreement: 0.71,
  pairs: 24,
  trust: 0.6,
  hiddenBecause: null,
};

const NEW_JUDGE: JudgeCalibrationResponseDto = {
  trusted: false,
  measure: 'kappa',
  agreement: null,
  pairs: 0,
  trust: 0.6,
  hiddenBecause: 'too-few-pairs',
};

const NO_JUDGE: JudgeCalibrationResponseDto = {
  trusted: false,
  measure: null,
  agreement: null,
  pairs: 0,
  trust: null,
  hiddenBecause: 'no-judge',
};

const EARLIER_RUBRIC_BODY =
  'Score 5 where the change does what the spec asks, small and tested, and 1 where it does not do it at all.';

const verdict = (
  runId: string,
  yes: boolean,
  reasons: JudgeScoreResponseDto['reasons'],
): JudgeScoreResponseDto => ({
  kind: 'yes-no',
  value: yes ? 1 : 0,
  marks: null,
  label: yes ? 'yes' : 'no',
  rubricVersion: RUBRIC,
  model: 'google/gemini-3.8-flash',
  at: minutesAfter(runEnded(runId), 3),
  reasons,
});

const citedStep = (index: number, tool: string | null, text: string) => ({
  kind: 'step' as const,
  step: { index, kind: tool ? 'tool' : 'said', tool, text },
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

const citedSaid = (runId: string) => {
  const steps = RUN_STORIES[runId]?.steps ?? [];
  const index = steps.findLastIndex((step) => step.kind === 'said');

  return citedStep(index, null, steps[index]?.text ?? '');
};

const lastStepIndexOf = (runId: string, text: string): number =>
  (RUN_STORIES[runId]?.steps ?? []).findLastIndex((step) => step.text === text);

const graded = (
  runId: string,
  by: typeof SAM,
  yes: boolean,
): GradeResponseDto => ({
  by: by.id,
  mine: by.id === SAM.id,
  kind: 'yes-no',
  value: yes ? 1 : 0,
  marks: null,
  label: yes ? 'yes' : 'no',
  at: minutesAfter(runEnded(runId), 90),
});

const JUDGED: Record<string, Pick<RunScoresResponseDto, 'judge' | 'grades'>> = {
  run_postgres_2: {
    grades: [],
    judge: verdict('run_postgres_2', true, [
      {
        claim: null,
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
        claim: null,
        text: 'It said the migration rewrites 1.3M rows and left batching to review, rather than deciding it alone.',
        citations: [citedSaid('run_postgres_2')],
      },
    ]),
  },
  run_search_2: {
    grades: [graded('run_search_2', SAM, true)],
    judge: verdict('run_search_2', true, [
      {
        claim: null,
        text: 'One index and one query change, with the tests passing and the speed-up measured.',
        citations: [
          citedStep(
            stepIndexOf('run_search_2', 'npm test -- search'),
            'execute',
            'npm test -- search',
          ),
        ],
      },
    ]),
  },
  run_billing_1: {
    grades: [graded('run_billing_1', PRIYA, false)],
    judge: verdict('run_billing_1', false, [
      {
        claim: null,
        text: 'It reconciled nothing: the script could not reach the billing database and the run exited.',
        citations: [
          citedStep(
            stepIndexOf('run_billing_1', 'npm run reconcile -- --dry-run'),
            'execute',
            'npm run reconcile -- --dry-run',
          ),
        ],
      },
    ]),
  },
};

const calibrationOf = (stationId: string): JudgeCalibrationResponseDto => {
  if (stationId === JUDGED_STATION) {
    return TRUSTED;
  }

  return judgeOf(stationId) ? NEW_JUDGE : NO_JUDGE;
};

const scoresOf = (runId: string): RunScoresResponseDto => {
  const stationId = stationOfRun(runId);
  const taskId = taskOfSeededRun(runId);
  const claims = judgeOf(stationId)?.claims ?? [];
  const found = JUDGED[runId];

  return {
    runId,
    taskId,
    stationId,
    kind: claims.length > 0 ? 'claims' : 'yes-no',
    rubricBody: rubricBodyOf(stationId),
    claims,
    judged: Boolean(found?.judge),
    judge: found?.judge ?? null,
    calibration: calibrationOf(stationId),
    grades: found?.grades ?? [],
  };
};

export const seedRunScores = (
  runIds: readonly string[],
): Record<string, RunScoresResponseDto> =>
  Object.fromEntries(runIds.map((runId) => [runId, scoresOf(runId)]));

const rounded = (value: number) => Math.round(value * 100) / 100;

const endOf = (run: HistoryRun) =>
  run.endedAt ?? new Date(run.at).toISOString();

const crossingFrom = (
  alertId: string,
  crossing: AlertCrossing,
  threshold: StationAlertCrossingResponseDto['threshold'],
  currency: string | null,
): StationAlertCrossingResponseDto => {
  const { run, value, baseline, recovered, series } = crossing;
  const by = baseline === null ? null : rounded(value - baseline);

  return {
    alertId,
    lineId: lineOfStation(ALERT_STATION),
    stationId: ALERT_STATION,
    threshold,
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
    raisedAt: minutesAfter(endOf(run), 2),
    insightsPeriod: '30d',
    recoveredAt: recovered ? endOf(recovered) : null,
    currency,
    series: series.map((point) => ({
      runId: point.run.runId,
      endedAt: endOf(point.run),
      value: point.value === null ? null : rounded(point.value),
    })),
  };
};

export const seedAlerts = (): Record<
  string,
  StationAlertCrossingResponseDto
> => {
  const sentBack = alertCrossing();
  const cost = costAlertCrossing();

  return {
    ...(sentBack && {
      [ALERT_ID]: crossingFrom(
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
      [COST_ALERT_ID]: crossingFrom(
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

const scaled = (judge: number) =>
  Math.min(5, Math.max(1, Math.round(1 + judge * 4)));

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
  const score = scaled(run.judge);

  return {
    kind: earlier ? 'number' : 'yes-no',
    value: earlier ? score : yes ? 1 : 0,
    marks: null,
    label: earlier ? `${score}` : yes ? 'yes' : 'no',
    rubricVersion: earlier ? EARLIER_RUBRIC : RUBRIC,
    model: 'google/gemini-3.8-flash',
    at: minutesAfter(endOf(run), 3),
    reasons: [
      {
        claim: null,
        text: yes
          ? 'It changed what the spec asks for and left the tests passing.'
          : 'It left a check failing and did not say why.',
        citations:
          tested < 0
            ? []
            : [citedStep(tested, 'execute', steps[tested]?.text ?? 'npm test')],
      },
    ],
  };
};

export const pastScoresOf = (run: HistoryRun): RunScoresResponseDto => {
  const judged = run.stationId === JUDGED_STATION;
  const earlier = judged && onEarlierRubric(run.at);
  const judge = pastJudgeOf(run, earlier);

  return {
    runId: run.runId,
    taskId: run.taskId,
    stationId: run.stationId,
    kind: earlier ? 'number' : 'yes-no',
    rubricBody: earlier ? EARLIER_RUBRIC_BODY : rubricBodyOf(run.stationId),
    claims: [],
    judged: judge !== null,
    judge,
    calibration: judged ? TRUSTED : NO_JUDGE,
    grades: [],
  };
};
