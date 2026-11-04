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
  ScoreCountResponseDto,
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

export type ScoreCount = ScoreCountResponseDto;

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

export const formatTrendCaption = (kind: ScoreKind): string =>
  sentenceOf(TREND_CAPTIONS[kind]);

const sentenceOf = (words: string): string =>
  `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;

export const TREND_MIN_PAIRS = 30;

export const trendWaitNote = (pairs: number): string =>
  `The trend shows once ${TREND_MIN_PAIRS} runs on this rubric have both scores. ${pairs} ${pairs === 1 ? 'has' : 'have'} so far.`;

export const coverageTitle = (coverage: JudgeCoverage): string =>
  `Who scored the last ${coverage.runs} runs`;

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

export const formatMeasure = (measure: JudgeCalibration['measure']): string =>
  measure ? MEASURES[measure] : 'Agreement';

const MINIMUM_NOTE = 'Below the minimum, judge scores are hidden.';

type Reading = NonNullable<JudgeCalibration['reading']>;

const READING_WORDS: Record<Reading, string> = {
  'almost-perfect': 'Almost perfect',
  substantial: 'Substantial',
  moderate: 'Moderate',
  'fair-to-slight': 'Fair to slight',
  poor: 'Less than chance',
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
  ['0 – 0.40', 'Fair to slight'],
  ['Below 0', 'Less than chance'],
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
      return 'Hidden. The rubric names a scale that cannot be read.';
    case 'too-few-pairs':
      return `Hidden until more runs have scores from both the judge and people. Runs so far: ${calibration.pairs}`;
    case 'no-agreement':
      return 'Hidden. Agreement can’t be measured while all scores are identical.';
    case 'below-min-agreement':
      return `Hidden. ${formatMeasure(calibration.measure)}: ${formatStat(calibration.agreement)}. Minimum required: ${formatStat(calibration.minAgreement)}`;
  }
};

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
  readonly reading: string | null;
  readonly note: TooltipNote;
};

const ERROR_NOTE = (title: string, body: string): TooltipNote => ({
  title,
  body: `${body} Lower is better.`,
});

export const comparisonStats = (version: RubricVersion): ComparisonStat[] => {
  const { agreement } = version;
  const { readings } = agreement;

  if (version.kind === 'number') {
    return [
      {
        label: 'Pearson correlation',
        value: formatStat(agreement.pearson),
        reading: readingWord(readings.pearson),
        note: correlationNoteOf('Pearson correlation', false),
      },
      {
        label: 'Spearman correlation',
        value: formatStat(agreement.spearman),
        reading: readingWord(readings.spearman),
        note: correlationNoteOf('Spearman correlation', true),
      },
      {
        label: 'Mean absolute error',
        value: formatStat(agreement.mae),
        reading: null,
        note: ERROR_NOTE(
          'Mean absolute error',
          'How far the judge’s score is from people’s on average, in points on the rubric’s scale.',
        ),
      },
      {
        label: 'Root mean square error',
        value: formatStat(agreement.rmse),
        reading: null,
        note: ERROR_NOTE(
          'Root mean square error',
          'Like mean absolute error, but large misses count for more.',
        ),
      },
    ];
  }

  return [
    {
      label: 'Cohen’s kappa',
      value: formatStat(agreement.kappa),
      reading: readingWord(readings.kappa),
      note: kappaNoteOf(
        version.kind === 'claims' ? 'It covers every claim together.' : null,
      ),
    },
    {
      label: 'F1 score',
      value: formatStat(agreement.f1),
      reading: null,
      note: {
        title: 'F1 score',
        body: 'How well the judge finds the runs people scored yes. 1 is a perfect match.',
      },
    },
    {
      label: 'Overall agreement',
      value: formatPercent(agreement.observed),
      reading: null,
      note: {
        title: 'Overall agreement',
        body: 'The share of runs where both gave the same score. It counts lucky guesses, so read it with kappa.',
      },
    },
  ];
};

export const formatRubric = (version: RubricVersion): string =>
  version.current
    ? 'Current version'
    : `Version until ${formatDay(version.lastAt.slice(0, 10))}`;

export const CLAIM_HEADINGS: readonly NestedHeading[] = [
  { label: CLAIM_COLUMN, indent: 'edge', size: 'minmax(12rem,3fr)' },
  { label: KAPPA_COLUMN, size: 'minmax(10rem,2fr)' },
  { label: AGREED_COLUMN, numeric: true, size: SPREAD },
  { label: RUNS_COLUMN, numeric: true, size: SPREAD },
];

export const kappaNote = (): TooltipNote => kappaNoteOf();
