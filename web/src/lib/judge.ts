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

export const formatClaimsMet = (marks: readonly boolean[]): string =>
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
  TREND_CAPTIONS[kind];

export const formatClaim = (
  claims: readonly (string | null)[],
  index: number,
): string => claims[index] ?? `Claim ${index + 1}`;

export const formatMark = (met: boolean): string => (met ? 'Met' : 'Not met');

export const formatPassThreshold = (passThreshold: number): string =>
  passThreshold >= 1
    ? 'A run passes when it meets every claim.'
    : `A run passes when it meets at least ${formatPercent(passThreshold)} of its claims.`;

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

const COVERAGE_PARTS = [
  { key: 'both', label: 'Both scores' },
  { key: 'judgeOnly', label: 'Judge only' },
  { key: 'peopleOnly', label: 'People only' },
  { key: 'neither', label: 'Neither' },
] as const;

export type JudgeTile = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

export const judgeTiles = (
  calibration: JudgeCalibration,
  coverage: JudgeCoverage,
): JudgeTile[] => [
  {
    id: 'agreement',
    label: formatMeasure(calibration.measure),
    value: formatStat(calibration.agreement),
    detail: calibration.qualified
      ? `Qualified. Minimum required: ${formatStat(calibration.minAgreement)}`
      : formatCalibration(calibration),
  },
  ...COVERAGE_PARTS.map((part) => ({
    id: part.label,
    label: part.label,
    value: `${coverage[part.key]}`,
    detail: `${formatPercent(coverage.rates[part.key])} of the last ${coverage.runs}`,
  })),
];

type Readings = RubricVersion['agreement']['readings'];

type KappaReading = NonNullable<Readings['kappa']>;

type CorrelationReading = NonNullable<Readings['pearson']>;

const KAPPA_READINGS: Record<KappaReading, string> = {
  'almost-perfect': 'Almost perfect agreement',
  substantial: 'Substantial agreement',
  moderate: 'Moderate agreement',
  'fair-to-slight': 'Fair to slight agreement',
  poor: 'Less agreement than chance',
};

const CORRELATION_READINGS: Record<CorrelationReading, string> = {
  'very-strong': 'Very strong correlation',
  strong: 'Strong correlation',
  moderate: 'Moderate correlation',
  weak: 'Weak correlation',
  inverse: 'Inverse correlation',
};

export type ComparisonStat = {
  readonly label: string;
  readonly value: string;
  readonly tooltip: string;
};

const KAPPA_NOTE =
  'How often the judge and people agree, beyond chance. 1 is perfect agreement and 0 is chance. Scale: 0.81 and up almost perfect · 0.61 to 0.80 substantial · 0.41 to 0.60 moderate · below 0 less than chance';

const correlationNote = (ranked: boolean): string =>
  `How closely the judge’s scores ${ranked ? 'rank runs the way people’s scores do' : 'rise and fall with people’s scores'}. 1 means they move in step and 0 means no relation. Scale: 0.9 and up very strong · 0.7 to 0.9 strong · 0.5 to 0.7 moderate · below 0 inverse`;

const read = (reading: string | null, note: string): string =>
  reading ? `${reading}. ${note}` : note;

const correlationRead = (
  reading: CorrelationReading | null,
  ranked: boolean,
): string =>
  read(reading && CORRELATION_READINGS[reading], correlationNote(ranked));

const kappaRead = (reading: KappaReading | null, note: string): string =>
  read(reading && KAPPA_READINGS[reading], note);

export const comparisonStats = (version: RubricVersion): ComparisonStat[] => {
  const { agreement } = version;
  const { readings } = agreement;

  if (version.kind === 'number') {
    return [
      {
        label: 'Pearson correlation',
        value: formatStat(agreement.pearson),
        tooltip: correlationRead(readings.pearson, false),
      },
      {
        label: 'Spearman correlation',
        value: formatStat(agreement.spearman),
        tooltip: correlationRead(readings.spearman, true),
      },
      {
        label: 'Mean absolute error',
        value: formatStat(agreement.mae),
        tooltip:
          'How far the judge’s score is from people’s on average, in points on the rubric’s scale. Lower is better.',
      },
      {
        label: 'Root mean square error',
        value: formatStat(agreement.rmse),
        tooltip:
          'This is like mean absolute error, but large misses count for more. Lower is better.',
      },
    ];
  }

  return [
    {
      label: 'Cohen’s kappa',
      value: formatStat(agreement.kappa),
      tooltip: kappaRead(
        readings.kappa,
        version.kind === 'claims'
          ? `This kappa covers every claim together. ${KAPPA_NOTE}`
          : KAPPA_NOTE,
      ),
    },
    {
      label: 'F1 score',
      value: formatStat(agreement.f1),
      tooltip:
        'How well the judge’s yes matches people’s yes. A perfect match misses none, adds none and scores 1. Higher is better.',
    },
    {
      label: 'Overall agreement',
      value: formatPercent(agreement.observed),
      tooltip:
        'The share of runs where the judge and people gave the same score. Agreement by chance counts.',
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

export const kappaNote = (reading: ClaimAgreement['reading']): string =>
  kappaRead(reading, KAPPA_NOTE);
