import type {
  CitationResponseDto,
  CitedHunkResponseDto,
  ClaimAgreementResponseDto,
  GradeResponseDto,
  JudgeCalibrationResponseDto,
  JudgeCoverageResponseDto,
  JudgeReasonResponseDto,
  RubricVersionResponseDto,
  RunScoresResponseDto,
  StationJudgeAgreementResponseDto,
  TrendPointResponseDto,
} from '@/lib/api';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import type { TooltipNote } from '@/lib/tooltip-note';

export type StationJudgeAgreement = StationJudgeAgreementResponseDto;

export type RubricVersion = RubricVersionResponseDto;

export type JudgeCalibration = JudgeCalibrationResponseDto;

export type JudgeCoverage = JudgeCoverageResponseDto;

export type TrendPoint = TrendPointResponseDto;

export type RunScores = RunScoresResponseDto;

export type JudgeReason = JudgeReasonResponseDto;

export type Citation = CitationResponseDto;

export type CitedHunk = CitedHunkResponseDto;

export type Grade = GradeResponseDto;

export type ClaimAgreement = ClaimAgreementResponseDto;

export type ScoreKind = RunScores['kind'];

export type RatedKind = Exclude<ScoreKind, 'claims'>;

export type GradeValue = boolean | number;

export type GradeAnswer =
  | { readonly value: GradeValue }
  | { readonly claims: readonly boolean[] };

export type GradeOption = {
  readonly value: GradeValue;
  readonly label: string;
};

const YES_NO: readonly GradeOption[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

const ONE_TO_FIVE: readonly GradeOption[] = [1, 2, 3, 4, 5].map((value) => ({
  value,
  label: String(value),
}));

export const gradeOptions = (kind: RatedKind): readonly GradeOption[] =>
  kind === 'yes-no' ? YES_NO : ONE_TO_FIVE;

export const valueOfGrade = (kind: RatedKind, value: GradeValue): number =>
  kind === 'yes-no' ? (value ? 1 : 0) : Number(value);

const formatClaimsMet = (marks: readonly boolean[]): string =>
  `${marks.filter(Boolean).length} of ${marks.length} claims met`;

export const formatScore = (score: {
  readonly kind: ScoreKind;
  readonly label: string;
  readonly claimResults?: readonly boolean[] | null;
}): string => {
  switch (score.kind) {
    case 'yes-no':
      return score.label === 'yes' ? 'Yes' : 'No';
    case 'number':
      return `${score.label} of 5`;
    case 'claims':
      return score.claimResults
        ? formatClaimsMet(score.claimResults)
        : score.label;
  }
};

export const sharesOn = (kind: ScoreKind): boolean => kind !== 'number';

const TREND_CAPTIONS: Record<ScoreKind, string> = {
  'yes-no': 'share scored yes, by day',
  number: 'mean score, by day',
  claims: 'share of claims met, by day',
};

export const TREND_TITLE = 'Scores by day';

export const formatTrendCaption = (kind: ScoreKind): string =>
  sentenceOf(TREND_CAPTIONS[kind]);

const sentenceOf = (words: string): string =>
  `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;

export const trendWaitNote = (version: RubricVersion): string =>
  `No trend yet. It shows at ${version.trendMinPairs} runs with both scores, on more than one day.`;

export const coverageTitle = (coverage: JudgeCoverage): string =>
  `Last ${coverage.runs} runs by scorer`;

export const COVERAGE_SKELETON_TITLE = 'Last runs by scorer';

export const COVERAGE_NOTE =
  'Who scored each of the station’s last runs, on any rubric. Only runs with both scores count towards agreement.';

export const CLAIMS_TITLE = 'Agreement by claim';

export const formatClaim = (
  claims: readonly (string | null)[],
  index: number,
): string => claims[index] ?? `Claim ${index + 1}`;

export const formatMark = (met: boolean): string => (met ? 'Met' : 'Not met');

export const formatPassThreshold = (passThreshold: number): string =>
  passThreshold >= 1
    ? 'Every claim met'
    : `At least ${formatPercent(passThreshold)} of claims met`;

export const CLAIMS_LABEL = 'Claims';

const CLAIMS_QUESTION = 'Does the run meet each claim?';

export const RUBRIC_LABEL = 'Rubric';

const gradeQuestion = (kind: RatedKind, byRubric: boolean): string => {
  if (kind === 'yes-no') {
    return byRubric ? 'Does this run meet the rubric?' : 'Is this a good run?';
  }

  return byRubric
    ? 'How well does this run meet the rubric, from 1 to 5?'
    : 'How good is this run, from 1 to 5?';
};

export const gradeHeading = (kind: ScoreKind, byRubric: boolean): string =>
  kind === 'claims' ? CLAIMS_QUESTION : gradeQuestion(kind, byRubric);

export const SAVING_GRADE = 'Saving…';

export const RUBRIC_TEXT_LABEL = 'The judge’s rubric';

const CLAIM_COLUMN = 'Claim';

const KAPPA_COLUMN = 'Cohen’s kappa';

const AGREED_COLUMN = 'Agreed';

const RUNS_COLUMN = 'Runs';

export const YOUR_GRADE = 'Your grade';

const MEASURES: Record<NonNullable<JudgeCalibration['measure']>, string> = {
  kappa: 'Cohen’s kappa',
  spearman: 'Spearman’s ρ',
};

const formatMeasure = (measure: JudgeCalibration['measure']): string =>
  measure ? MEASURES[measure] : 'Agreement';

const MINIMUM_NOTE = 'Below the minimum, judge scores are hidden.';

type Reading = NonNullable<JudgeCalibration['reading']>;

const READING_WORDS: Record<Reading, string> = {
  'almost-perfect': 'Almost perfect',
  substantial: 'Substantial',
  moderate: 'Moderate',
  fair: 'Fair',
  slight: 'Slight',
  chance: 'No better than chance',
  'very-strong': 'Very strong',
  strong: 'Strong',
  weak: 'Weak',
  inverse: 'Inverse',
};

export const readingWord = (reading: Reading | null): string | null =>
  reading ? READING_WORDS[reading] : null;

const KAPPA_ROWS: TooltipNote['rows'] = [
  ['0.81 – 1.00', 'Almost perfect'],
  ['0.61 – 0.80', 'Substantial'],
  ['0.41 – 0.60', 'Moderate'],
  ['0.21 – 0.40', 'Fair'],
  ['0.01 – 0.20', 'Slight'],
  ['0 and below', 'No better than chance'],
];

const CORRELATION_ROWS: TooltipNote['rows'] = [
  ['0.90 – 1.00', 'Very strong'],
  ['0.70 – 0.89', 'Strong'],
  ['0.50 – 0.69', 'Moderate'],
  ['0 – 0.49', 'Weak'],
  ['Below 0', 'Inverse'],
];

const KAPPA_BODY =
  'How often the judge and people give the same score to the same run, beyond what chance would give. 1 is perfect agreement.';

const kappaNoteOf = (lead: string | null = null): TooltipNote => ({
  title: 'Cohen’s kappa',
  body: lead ? `${lead} ${KAPPA_BODY}` : KAPPA_BODY,
  rows: KAPPA_ROWS,
});

const correlationNoteOf = (title: string, ranked: boolean): TooltipNote => ({
  title,
  body: ranked
    ? 'How closely the judge ranks runs the way people do. 1 means the same order and 0 means no relation.'
    : 'How closely the judge’s scores rise and fall with people’s. 1 means they move in step and 0 means no relation.',
  rows: CORRELATION_ROWS,
});

const MEASURE_NOTES: Record<
  NonNullable<JudgeCalibration['measure']>,
  TooltipNote
> = {
  kappa: kappaNoteOf(),
  spearman: correlationNoteOf('Spearman’s ρ', true),
};

export const measureNote = (
  measure: JudgeCalibration['measure'],
): TooltipNote | null =>
  measure
    ? {
        ...MEASURE_NOTES[measure],
        body: `${MEASURE_NOTES[measure].body} ${MINIMUM_NOTE}`,
      }
    : null;

export const formatStat = (value: number | null): string =>
  value === null ? '–' : value.toFixed(2);

const PERCENT = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export const formatPercent = (share: number | null): string =>
  share === null ? '–' : PERCENT.format(share);

export const formatCalibration = (calibration: JudgeCalibration): string => {
  switch (calibration.hiddenReason) {
    case null:
      return `Qualified. ${formatMeasure(calibration.measure)}: ${formatStat(calibration.agreement)} over ${calibration.pairs} runs. Minimum required: ${formatStat(calibration.minAgreement)}`;
    case 'no-judge':
      return 'This station has no judge. There are no scores to trust.';
    case 'unreadable-rubric':
      return 'Judge scores are hidden. The rubric names a scale that cannot be read.';
    case 'too-few-pairs':
      return `Judge scores are hidden until ${calibration.minPairs} runs have scores from both the judge and people. Runs so far: ${calibration.pairs}.`;
    case 'no-agreement':
      return 'Judge scores are hidden. Agreement cannot be measured while all scores are the same.';
    case 'below-min-agreement':
      return `Judge scores are hidden. ${formatMeasure(calibration.measure)}: ${formatStat(calibration.agreement)}. Minimum required: ${formatStat(calibration.minAgreement)}.`;
  }
};

export type ScoreVisibility = {
  readonly hidden: boolean;
  readonly failing: boolean;
  readonly text: string;
  readonly reason: string | null;
};

const SHOWN_TEXT = 'Judge scores show on runs.';

const HIDDEN_TEXT = 'Judge scores are hidden on runs.';

const hiddenBecause = (calibration: JudgeCalibration): string => {
  switch (calibration.hiddenReason) {
    case 'too-few-pairs':
      return `They show when ${calibration.minPairs} runs have scores from both the judge and people.`;
    case 'below-min-agreement':
      return `${formatMeasure(calibration.measure)} is below the minimum, ${formatStat(calibration.minAgreement)}.`;
    case 'no-agreement':
      return 'Agreement cannot be measured while all scores are the same.';
    case 'unreadable-rubric':
      return 'The rubric names a scale that cannot be read.';
    default:
      return 'This station has no judge.';
  }
};

export const scoreVisibility = (
  calibration: JudgeCalibration,
): ScoreVisibility =>
  calibration.hiddenReason === null
    ? { hidden: false, failing: false, text: SHOWN_TEXT, reason: null }
    : {
        hidden: true,
        failing: calibration.failing,
        text: HIDDEN_TEXT,
        reason: hiddenBecause(calibration),
      };

export const formatPairsProgress = (calibration: JudgeCalibration): string =>
  `${calibration.pairs} of ${calibration.minPairs} runs`;

export const formatDay = (day: string): string =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export const formatHunk = (hunk: CitedHunk): string =>
  hunk.path
    ? `${hunk.path.slice(hunk.path.lastIndexOf('/') + 1)} ${hunk.header ?? ''}`.trim()
    : hunk.id;

export const formatStep = (citation: Citation): string =>
  `Step ${citation.step?.index ?? ''}`.trim();

export const COVERAGE_PARTS = [
  { key: 'both', label: 'Both scores' },
  { key: 'judgeOnly', label: 'Judge only' },
  { key: 'peopleOnly', label: 'People only' },
  { key: 'neither', label: 'Neither' },
] as const;

export type ComparisonStat = {
  readonly label: string;
  readonly value: string;
  readonly detail: string | null;
  readonly gauge?: number | null;
  readonly failing?: boolean;
  readonly note: TooltipNote;
};

export type PairsStat = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly progress: number | null;
  readonly note: TooltipNote;
};

const PAIRS_LABEL = 'Runs both scored';

const PENDING_FIGURES: Record<ScoreKind, string> = {
  'yes-no': 'Kappa, same score and F1',
  claims: 'Kappa, same score and F1',
  number: 'Correlations and errors',
};

export const pairsStat = (
  version: RubricVersion,
  calibration: JudgeCalibration,
): PairsStat => {
  const { pairs, measured, pairsProgress } = version.agreement;
  const { minPairs } = calibration;

  return {
    label: PAIRS_LABEL,
    value: measured ? String(pairs) : `${pairs} of ${minPairs}`,
    detail: measured
      ? `Of ${version.judged} judged`
      : `${PENDING_FIGURES[version.kind]} show at ${minPairs} runs.`,
    progress: measured ? null : pairsProgress,
    note: {
      title: PAIRS_LABEL,
      body: `Runs on this rubric that both the judge and people scored, out of the runs on this rubric that the judge scored. Agreement needs ${minPairs} runs. The trend needs ${version.trendMinPairs} runs.`,
    },
  };
};

const UNITS: Record<ScoreKind, readonly [one: string, many: string]> = {
  'yes-no': ['run', 'runs'],
  number: ['run', 'runs'],
  claims: ['claim', 'claims'],
};

const unitOf = (kind: ScoreKind, count: number): string =>
  UNITS[kind][count === 1 ? 0 : 1];

const sameScoreDetail = (version: RubricVersion): string =>
  `${version.agreement.agreed} of ${version.agreement.compared} ${unitOf(version.kind, version.agreement.compared)}`;

const readingDetail = (
  reading: string | null,
  version: RubricVersion,
  calibration: JudgeCalibration,
): string | null =>
  version.agreement.belowMinimum && reading
    ? `${reading} · minimum ${formatStat(calibration.minAgreement)}`
    : reading;

const ERROR_NOTE = (title: string, body: string): TooltipNote => ({
  title,
  body: `${body} Lower is better.`,
});

export const comparisonStats = (
  version: RubricVersion,
  calibration: JudgeCalibration,
): ComparisonStat[] =>
  version.agreement.measured
    ? measuredStats(version, calibration).map((stat) =>
        stat.gauge === undefined || calibration.minAgreement === null
          ? stat
          : {
              ...stat,
              note: {
                ...stat.note,
                body: `${stat.note.body} The line on the bar is the minimum, ${formatStat(calibration.minAgreement)}. ${MINIMUM_NOTE}`,
              },
            },
      )
    : [];

const measuredStats = (
  version: RubricVersion,
  calibration: JudgeCalibration,
): ComparisonStat[] => {
  const { agreement } = version;
  const { readings } = agreement;

  if (version.kind === 'number') {
    return [
      {
        label: 'Pearson’s r',
        value: formatStat(agreement.pearson),
        detail: readingWord(readings.pearson),
        note: correlationNoteOf('Pearson’s r, the Pearson correlation', false),
      },
      {
        label: 'Spearman’s ρ',
        value: formatStat(agreement.spearman),
        detail: readingDetail(
          readingWord(readings.spearman),
          version,
          calibration,
        ),
        gauge: agreement.spearman,
        failing: agreement.belowMinimum,
        note: correlationNoteOf('Spearman’s ρ, the Spearman correlation', true),
      },
      {
        label: 'MAE',
        value: formatStat(agreement.mae),
        detail: null,
        note: ERROR_NOTE(
          'Mean absolute error (MAE)',
          'How far the judge’s score is from people’s on average, in points on the rubric’s scale.',
        ),
      },
      {
        label: 'RMSE',
        value: formatStat(agreement.rmse),
        detail: null,
        note: ERROR_NOTE(
          'Root mean square error (RMSE)',
          'Like mean absolute error, but large misses count for more.',
        ),
      },
    ];
  }

  return [
    {
      label: 'Cohen’s kappa',
      value: formatStat(agreement.kappa),
      detail: readingDetail(readingWord(readings.kappa), version, calibration),
      gauge: agreement.kappa,
      failing: agreement.belowMinimum,
      note: kappaNoteOf(
        version.kind === 'claims' ? 'It covers every claim together.' : null,
      ),
    },
    {
      label: 'Same score',
      value: formatPercent(agreement.observed),
      detail: sameScoreDetail(version),
      note: {
        title: 'Same score',
        body: 'The share of runs where the judge and people gave the same score. It also counts scores that agree by chance. Read it together with kappa.',
      },
    },
    {
      label: 'F1 score',
      value: formatStat(agreement.f1),
      detail: null,
      note: {
        title: 'F1 score',
        body: 'How well the judge finds the runs people scored yes. 1 is a perfect match.',
      },
    },
  ];
};

export const formatRubric = (version: RubricVersion): string =>
  version.current
    ? 'Current rubric'
    : `Rubric until ${formatDay(version.lastAt.slice(0, 10))}`;

export const CLAIM_HEADINGS: readonly NestedHeading[] = [
  { label: CLAIM_COLUMN, indent: 'edge', size: 'minmax(12rem,3fr)' },
  { label: KAPPA_COLUMN, size: 'minmax(10rem,2fr)' },
  { label: AGREED_COLUMN, numeric: true, size: SPREAD },
  { label: RUNS_COLUMN, numeric: true, size: SPREAD },
];

export const kappaNote = (): TooltipNote => kappaNoteOf();

export const formatAxisLabel = (label: string): string =>
  `${label.charAt(0).toUpperCase()}${label.slice(1)}`;

export const confusionCellNote = (
  kind: ScoreKind,
  judge: string,
  people: string,
  count: number,
): TooltipNote => ({
  title: judge === people ? 'They agree' : 'They disagree',
  rows: [
    ['Judge', formatAxisLabel(judge)],
    ['People', formatAxisLabel(people)],
    [formatAxisLabel(UNITS[kind][1]), `${count} ${unitOf(kind, count)}`],
  ],
});

export const CONFUSION_TITLE = 'Judge against people';

export const confusionNote = (kind: ScoreKind): TooltipNote => {
  const units = UNITS[kind][1];

  return {
    title: CONFUSION_TITLE,
    body: `Rows are the judge’s score. Columns are people’s score. Cells on the diagonal are ${units} where they agree, in grey. Cells off the diagonal are ${units} where they disagree, in red. A stronger colour means more ${units}.${kind === 'claims' ? ' Each run counts once per claim.' : ''}`,
  };
};
