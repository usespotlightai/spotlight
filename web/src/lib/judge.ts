import type {
  CitationResponseDto,
  CitedHunkResponseDto,
  ClaimAgreementResponseDto,
  GradeResponseDto,
  JudgeCoverageResponseDto,
  JudgeReasonResponseDto,
  JudgeStandingResponseDto,
  RubricVersionResponseDto,
  RunScoresResponseDto,
  ScoreCountResponseDto,
  StationJudgeAgreementResponseDto,
  TrendPointResponseDto,
} from '@/lib/api';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';

export type StationJudgeAgreement = StationJudgeAgreementResponseDto;

export type RubricVersion = RubricVersionResponseDto;

export type JudgeStanding = JudgeStandingResponseDto;

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

export const claimsMetShown = (marks: readonly boolean[]): string =>
  `${marks.filter(Boolean).length} of ${marks.length} claims met`;

export const scoreShown = (score: {
  readonly kind: ScoreKind;
  readonly label: string;
  readonly marks?: readonly boolean[] | null;
}): string => {
  switch (score.kind) {
    case 'yes-no':
      return score.label === 'yes' ? 'Yes' : 'No';
    case 'number':
      return `${score.label} of 5`;
    case 'claims':
      return score.marks ? claimsMetShown(score.marks) : score.label;
  }
};

export const sharesOn = (kind: ScoreKind): boolean => kind !== 'number';

const TREND_CAPTIONS: Record<ScoreKind, string> = {
  'yes-no': 'share scored yes, by day',
  number: 'mean score, by day',
  claims: 'share of claims met, by day',
};

export const trendCaptionShown = (kind: ScoreKind): string =>
  TREND_CAPTIONS[kind];

export const claimShown = (
  claims: readonly (string | null)[],
  index: number,
): string => claims[index] ?? `Claim ${index + 1}`;

export const markShown = (met: boolean): string => (met ? 'Met' : 'Not met');

export const passShareShown = (passShare: number): string =>
  passShare >= 1
    ? 'A run passes when it meets every claim.'
    : `A run passes when it meets at least ${percentShown(passShare)} of its claims.`;

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

const MEASURES: Record<NonNullable<JudgeStanding['measure']>, string> = {
  kappa: 'Cohen’s kappa',
  spearman: 'Spearman’s ρ',
};

export const measureShown = (measure: JudgeStanding['measure']): string =>
  measure ? MEASURES[measure] : 'Agreement';

export const statShown = (value: number | null): string =>
  value === null ? '–' : value.toFixed(2);

const PERCENT = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export const percentShown = (share: number | null): string =>
  share === null ? '–' : PERCENT.format(share);

export const standingShown = (standing: JudgeStanding): string => {
  switch (standing.hiddenBecause) {
    case null:
      return `Trusted. ${measureShown(standing.measure)}: ${statShown(standing.agreement)} over ${standing.pairs} runs. Minimum required: ${statShown(standing.trust)}`;
    case 'no-judge':
      return 'No judge on this station. No scores to trust.';
    case 'unreadable-rubric':
      return 'Hidden. The rubric names a scale that cannot be read.';
    case 'too-few-pairs':
      return `Hidden until more runs have both judge and human scores. Runs so far: ${standing.pairs}`;
    case 'no-agreement':
      return 'Hidden. Agreement can’t be measured while all scores are identical.';
    case 'below-trust':
      return `Hidden. ${measureShown(standing.measure)}: ${statShown(standing.agreement)}. Minimum required: ${statShown(standing.trust)}`;
  }
};

export const dayShown = (day: string): string =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export const hunkShown = (hunk: CitedHunk): string =>
  hunk.path
    ? `${hunk.path.slice(hunk.path.lastIndexOf('/') + 1)} ${hunk.header ?? ''}`.trim()
    : hunk.id;

export const stepShown = (citation: Citation): string =>
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
  standing: JudgeStanding,
  coverage: JudgeCoverage,
): JudgeTile[] => [
  {
    id: 'agreement',
    label: measureShown(standing.measure),
    value: statShown(standing.agreement),
    detail: standing.trusted
      ? `Trusted, needs ${statShown(standing.trust)}`
      : standingShown(standing),
  },
  ...COVERAGE_PARTS.map((part) => ({
    id: part.label,
    label: part.label,
    value: `${coverage[part.key]}`,
    detail: `${percentShown(coverage.shares[part.key])} of the last ${coverage.runs}`,
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
  readonly note: string;
};

const KAPPA_NOTE =
  'How often the judge and people agree, beyond what chance would give: 1 is perfect, 0 is chance. 0.81 and up is almost perfect, 0.61 to 0.80 substantial, 0.41 to 0.60 moderate, below 0 less than chance.';

const correlationNote = (ranked: boolean): string =>
  `How closely the judge’s scores ${ranked ? 'rank runs the way' : 'rise and fall with'} people’s do: 1 is in step, 0 is no relation. 0.9 and up is very strong, 0.7 to 0.9 strong, 0.5 to 0.7 moderate, below 0 inverse.`;

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
        value: statShown(agreement.pearson),
        note: correlationRead(readings.pearson, false),
      },
      {
        label: 'Spearman correlation',
        value: statShown(agreement.spearman),
        note: correlationRead(readings.spearman, true),
      },
      {
        label: 'Mean absolute error',
        value: statShown(agreement.mae),
        note: 'How far the judge’s score is from people’s on average, in points on the rubric’s scale. Lower is better.',
      },
      {
        label: 'Root mean square error',
        value: statShown(agreement.rmse),
        note: 'Like mean absolute error, but large misses count for more. Lower is better.',
      },
    ];
  }

  return [
    {
      label: 'Cohen’s kappa',
      value: statShown(agreement.kappa),
      note: kappaRead(
        readings.kappa,
        version.kind === 'claims'
          ? `Across every claim together. ${KAPPA_NOTE}`
          : KAPPA_NOTE,
      ),
    },
    {
      label: 'F1 score',
      value: statShown(agreement.f1),
      note: 'How well the judge’s yes matches people’s yes, missing none and adding none: 1 is a perfect match. Higher is better.',
    },
    {
      label: 'Overall agreement',
      value: percentShown(agreement.observed),
      note: 'The share of runs where the judge and people gave the same score, chance included.',
    },
  ];
};

export const rubricShown = (version: RubricVersion): string =>
  version.current
    ? 'Current version'
    : `Version until ${dayShown(version.lastAt.slice(0, 10))}`;

export const CLAIM_HEADINGS: readonly NestedHeading[] = [
  { label: CLAIM_COLUMN, indent: 'edge', size: 'minmax(12rem,3fr)' },
  { label: KAPPA_COLUMN, size: 'minmax(10rem,2fr)' },
  { label: AGREED_COLUMN, numeric: true, size: SPREAD },
  { label: RUNS_COLUMN, numeric: true, size: SPREAD },
];

export const kappaNote = (reading: ClaimAgreement['reading']): string =>
  kappaRead(reading, KAPPA_NOTE);
