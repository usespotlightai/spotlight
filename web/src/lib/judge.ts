import type {
  CitationResponseDto,
  CitedHunkResponseDto,
  GradeResponseDto,
  JudgeCoverageResponseDto,
  JudgeReasonResponseDto,
  JudgeStandingResponseDto,
  RubricVersionResponseDto,
  RunScoresResponseDto,
  StationJudgeAgreementResponseDto,
  TrendPointResponseDto,
} from '@/lib/api';
import { type FileChange, repoRelative } from '@/lib/changes';
import type { RunJournal } from '@/lib/inbox';

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

export type ScoreKind = RunScores['kind'];

export type GradeValue = boolean | number;

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

export const gradeOptions = (kind: ScoreKind): readonly GradeOption[] =>
  kind === 'yes-no' ? YES_NO : ONE_TO_FIVE;

export const valueOfGrade = (kind: ScoreKind, value: GradeValue): number =>
  kind === 'yes-no' ? (value ? 1 : 0) : Number(value);

export const scoreShown = (score: {
  readonly kind: ScoreKind;
  readonly label: string;
}): string =>
  score.kind === 'yes-no'
    ? score.label === 'yes'
      ? 'Yes'
      : 'No'
    : `${score.label} of 5`;

const MEASURES: Record<NonNullable<JudgeStanding['measure']>, string> = {
  kappa: 'Cohen’s kappa',
  spearman: 'Spearman’s ρ',
};

const measureShown = (measure: JudgeStanding['measure']): string =>
  measure ? MEASURES[measure] : 'Agreement';

export const statShown = (value: number | null): string =>
  value === null ? '–' : value.toFixed(2);

const PERCENT = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export const percentShown = (share: number | null): string =>
  share === null ? '–' : PERCENT.format(share);

export const versionShown = (version: string): string => version.slice(0, 7);

export const standingShown = (standing: JudgeStanding): string => {
  switch (standing.hiddenBecause) {
    case null:
      return `Trusted: ${measureShown(standing.measure)} is ${statShown(standing.agreement)} over ${standing.pairs} runs, at least the ${statShown(standing.trust)} it needs.`;
    case 'no-judge':
      return 'This station has no judge, so there are no scores to trust.';
    case 'unreadable-rubric':
      return 'Hidden: the station’s rubric names a scale that cannot be read.';
    case 'too-few-pairs':
      return `Hidden until more runs have both a judge score and people’s: ${standing.pairs} so far.`;
    case 'no-agreement':
      return 'Hidden: every score so far is the same, so agreement can’t be measured.';
    case 'below-trust':
      return `Hidden: ${measureShown(standing.measure)} is ${statShown(standing.agreement)}, below the ${statShown(standing.trust)} it needs.`;
  }
};

export const dayShown = (day: string): string =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export const fileOfHunk = (
  hunk: CitedHunk,
  files: readonly FileChange[],
): FileChange | null =>
  files.find((each) => repoRelative(each.path) === hunk.path) ??
  files.find((each) => hunk.path !== null && each.path.endsWith(hunk.path)) ??
  null;

export const hunkShown = (hunk: CitedHunk): string =>
  hunk.path
    ? `${hunk.path.slice(hunk.path.lastIndexOf('/') + 1)} ${hunk.header ?? ''}`.trim()
    : hunk.id;

export const stepShown = (citation: Citation): string =>
  `Step ${citation.step?.index ?? ''}`.trim();

export const coverageParts = (
  coverage: JudgeCoverage,
): readonly { readonly label: string; readonly value: number }[] => [
  { label: 'Both scores', value: coverage.both },
  { label: 'Judge only', value: coverage.judgeOnly },
  { label: 'People only', value: coverage.peopleOnly },
  { label: 'Neither', value: coverage.neither },
];

export const summaryOf = (journals: readonly RunJournal[]): string | null =>
  journals
    .flatMap((each) => each.steps)
    .findLast((step) => step.kind === 'said' && step.text.trim())
    ?.text.trim() ?? null;
