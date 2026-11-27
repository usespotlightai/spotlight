import type {
  CitationResponseDto,
  CitedHunkResponseDto,
  ClaimsSourceResponseDto,
  JudgeCalibrationResponseDto,
  JudgeCoverageResponseDto,
  JudgeReasonResponseDto,
  RubricVersionResponseDto,
  RunScoresResponseDto,
  StationJudgeAgreementResponseDto,
  TrendPointResponseDto,
} from '@/lib/api';
import type { LineRange } from '@/lib/changes';
import { formatDate } from '@/lib/date-format';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import type { TooltipNote } from '@/lib/tooltip-note';

export type StationJudgeAgreement = StationJudgeAgreementResponseDto;

export type RubricVersion = RubricVersionResponseDto;

export type JudgeCalibration = JudgeCalibrationResponseDto;

export type JudgeCoverage = JudgeCoverageResponseDto;

export type TrendPoint = TrendPointResponseDto;

export type RunScores = RunScoresResponseDto;

export type LabelSource = NonNullable<RunScores['labelFrom']>;

export type JudgeReason = JudgeReasonResponseDto;

export type Citation = CitationResponseDto;

export type CitedHunk = CitedHunkResponseDto;

export const formatVerdict = (score: { readonly passes: boolean }): string =>
  score.passes ? 'Passed' : 'Failed';

const LABELS: Record<LabelSource, string> = {
  accepted: 'Accepted',
  'sent-back': 'Sent back',
  merged: 'Pull request merged',
  'held-as-wrong': 'Held as wrong',
};

export const formatLabel = (from: LabelSource): string => LABELS[from];

export const formatJudgeVerdict = (passes: boolean): string =>
  passes ? 'Passed by the judge' : 'Failed by the judge';

export const DISAGREES_LABEL = 'The judge disagrees with people';

export const DISAGREES_NOTE =
  'The judge and people give different verdicts on this run. Spotlight asks people why, to improve the claims.';

export const VERDICTS_TITLE = 'Verdicts';

export const PEOPLE_LABEL = 'People';

export const JUDGE_LABEL = 'Judge';

export const HIDDEN_VERDICT = 'Hidden';

export const TREND_TITLE = 'Pass rate by day';

export const TREND_CAPTION =
  'The share of runs that pass each day, by the judge and by people. Lines far apart mean they disagree.';

export const trendWaitNote = (version: RubricVersion): string =>
  `No trend yet. It shows at ${version.trendMinPairs} runs with both verdicts, on more than one day.`;

export const coverageTitle = (coverage: JudgeCoverage): string =>
  `Verdicts on the last ${coverage.runs} runs`;

export const COVERAGE_SKELETON_TITLE = 'Verdicts on the last runs';

export const COVERAGE_NOTE =
  'Who gave a verdict on each of the station’s last runs, on any version of its claims. Only runs with both verdicts count towards agreement.';

export const formatClaim = (index: number): string => `Claim ${index + 1}`;

export const formatMark = (met: boolean): string => (met ? 'Met' : 'Not met');

export const formatPassThreshold = (passThreshold: number): string =>
  passThreshold >= 1
    ? 'Every claim met'
    : `At least ${formatPercent(passThreshold)} of claims met`;

export const CLAIMS_LABEL = 'Claims';

const KAPPA_COLUMN = 'Cohen’s kappa';

const SAME_VERDICT_COLUMN = 'Same verdict';

const CLAIMS_VERSION_COLUMN = 'Claims';

const RUNS_COLUMN = 'Runs';

const MINIMUM_NOTE = 'Below the minimum, judge verdicts are hidden.';

export const belowMinimumNote = (calibration: JudgeCalibration): string =>
  `Below the minimum, ${formatStat(calibration.minAgreement)}. Judge verdicts are hidden on runs.`;

export const tooFewRunsNote = (calibration: JudgeCalibration): string =>
  `Agreement shows at ${calibration.minPairs} runs with a verdict from the judge and from people. Runs so far: ${calibration.pairs}.`;

export const NOT_MEASURED = 'Not measured';

const ONE_VERDICT_NOTE =
  'Agreement cannot be measured while people give every run the same verdict. It shows when people pass some runs and send back others.';

type Reading = NonNullable<JudgeCalibration['reading']>;

const READING_WORDS: Record<Reading, string> = {
  'almost-perfect': 'Almost perfect',
  substantial: 'Substantial',
  moderate: 'Moderate',
  fair: 'Fair',
  slight: 'Slight',
  chance: 'No better than chance',
};

export const readingWord = (reading: Reading | null): string | null =>
  reading ? READING_WORDS[reading] : null;

const KAPPA_ROWS: TooltipNote['rows'] = [
  ['0.81 to 1.00', 'Almost perfect'],
  ['0.61 to 0.80', 'Substantial'],
  ['0.41 to 0.60', 'Moderate'],
  ['0.21 to 0.40', 'Fair'],
  ['0.01 to 0.20', 'Slight'],
  ['0 and below', 'No better than chance'],
];

const KAPPA_BODY =
  'How often the judge and people give the same verdict, pass or fail, to the same run, beyond what chance would give. 1 is perfect agreement.';

const kappaNoteOf = (lead: string | null = null): TooltipNote => ({
  title: 'Cohen’s kappa',
  body: lead ? `${lead} ${KAPPA_BODY}` : KAPPA_BODY,
  rows: KAPPA_ROWS,
});

export const measureNote = (): TooltipNote => ({
  ...kappaNoteOf(),
  body: `${KAPPA_BODY} ${MINIMUM_NOTE}`,
});

export const formatStat = (value: number | null): string =>
  value === null ? '–' : value.toFixed(2);

const PERCENT = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export const formatPercent = (share: number | null): string =>
  share === null ? '–' : PERCENT.format(share);

export const NO_JUDGE = 'This station has no judge.';

export const formatCalibration = (calibration: JudgeCalibration): string => {
  switch (calibration.hiddenReason) {
    case null:
      return `Qualified. Cohen’s kappa: ${formatStat(calibration.agreement)} over ${calibration.pairs} runs. Minimum required: ${formatStat(calibration.minAgreement)}`;
    case 'no-judge':
      return NO_JUDGE;
    case 'unreadable-rubric':
      return 'Judge verdicts are hidden. The judge’s claims cannot be read.';
    case 'too-few-pairs':
      return `Judge verdicts are hidden until ${calibration.minPairs} runs have a verdict from the judge and from people. Runs so far: ${calibration.pairs}.`;
    case 'no-agreement':
      return `Judge verdicts are hidden. ${ONE_VERDICT_NOTE}`;
    case 'below-min-agreement':
      return `Judge verdicts are hidden. Cohen’s kappa: ${formatStat(calibration.agreement)}. Minimum required: ${formatStat(calibration.minAgreement)}.`;
  }
};

export type ScoreVisibility = {
  readonly hidden: boolean;
  readonly failing: boolean;
  readonly text: string;
  readonly reason: string | null;
};

const SHOWN_TEXT = 'Judge verdicts show on runs.';

const HIDDEN_TEXT = 'Judge verdicts are hidden on runs.';

const hiddenBecause = (calibration: JudgeCalibration): string => {
  switch (calibration.hiddenReason) {
    case 'too-few-pairs':
      return `They show when ${calibration.minPairs} runs have a verdict from the judge and from people.`;
    case 'below-min-agreement':
      return `Cohen’s kappa is below the minimum, ${formatStat(calibration.minAgreement)}.`;
    case 'no-agreement':
      return ONE_VERDICT_NOTE;
    case 'unreadable-rubric':
      return 'The judge’s claims cannot be read.';
    case 'no-judge':
    case null:
    default:
      return NO_JUDGE;
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

export const formatDay = (day: string): string =>
  formatDate(new Date(`${day}T00:00:00Z`), {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

const NEW_SIDE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))?/;

export const formatHunk = (hunk: CitedHunk): string => {
  if (!hunk.path) {
    return hunk.id;
  }

  const file = hunk.path.slice(hunk.path.lastIndexOf('/') + 1);
  const line = hunk.header?.match(NEW_SIDE)?.[1];

  return line ? `${file}:${line}` : file;
};

export const lineRangeOf = (hunk: CitedHunk): LineRange | null => {
  const found = hunk.header?.match(NEW_SIDE);

  if (!found?.[1]) {
    return null;
  }

  const start = Number(found[1]);
  const count = found[2] === undefined ? 1 : Number(found[2]);

  return { start, end: start + Math.max(count, 1) - 1 };
};

export const formatStep = (citation: Citation): string =>
  [citation.step?.tool ?? citation.step?.kind, 'step']
    .filter((each) => each)
    .join(' ');

export const COVERAGE_PARTS = [
  { key: 'both', label: 'Both' },
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

export const PAIRS_LABEL = 'Runs with both verdicts';

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
      : `Kappa and same verdict show at ${minPairs} runs.`,
    progress: measured ? null : pairsProgress,
    note: {
      title: PAIRS_LABEL,
      body: `Runs on these claims that have a verdict from the judge and from people, out of the runs on these claims that the judge judged. Agreement needs ${minPairs} runs. The trend needs ${version.trendMinPairs} runs.`,
    },
  };
};

const unitOf = (count: number): string => (count === 1 ? 'run' : 'runs');

const sameVerdictDetail = (version: RubricVersion): string =>
  `${version.agreement.agreed} of ${version.agreement.compared} ${unitOf(version.agreement.compared)}`;

export const comparisonStats = (
  version: RubricVersion,
  calibration: JudgeCalibration,
): ComparisonStat[] =>
  version.agreement.measured
    ? measuredStats(version).map((stat) =>
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

const measuredStats = (version: RubricVersion): ComparisonStat[] => {
  const { agreement } = version;
  return [
    {
      label: 'Cohen’s kappa',
      value: formatStat(agreement.kappa),
      detail:
        agreement.kappa === null
          ? NOT_MEASURED
          : readingWord(agreement.reading),
      gauge: agreement.kappa,
      failing: agreement.belowMinimum,
      note: kappaNoteOf(agreement.kappa === null ? ONE_VERDICT_NOTE : null),
    },
    {
      label: 'Same verdict',
      value: formatPercent(agreement.observed),
      detail: sameVerdictDetail(version),
      note: {
        title: 'Same verdict',
        body: 'The share of runs where the judge and people gave the same verdict, pass or fail. It also counts verdicts that agree by chance. Read it together with kappa. The F1 score shows how well the judge finds the runs that people passed, where 1 is a perfect match.',
        rows: [['F1 score', formatStat(agreement.f1)]],
      },
    },
  ];
};

export const formatRubric = (version: RubricVersion): string =>
  version.current
    ? 'Current claims'
    : `Claims until ${formatDay(version.lastAt.slice(0, 10))}`;

export const CURRENT_VERSION = 'Current';

type ClaimsSource = ClaimsSourceResponseDto;

export type VersionLink = {
  readonly label: string;
  readonly href: string;
  readonly title: string;
};

export const versionLinkOf = (
  source: ClaimsSource | null,
): VersionLink | null => {
  if (!source) {
    return null;
  }

  const { pullRequest } = source;

  return pullRequest
    ? {
        label: source.shortSha,
        href: pullRequest.url,
        title: pullRequest.title || `Pull request #${pullRequest.number}`,
      }
    : {
        label: source.shortSha,
        href: source.url,
        title: `Commit in ${source.repository}`,
      };
};

export const VERSIONS_TITLE = 'Agreement by claims version';

export const VERSION_HEADINGS: readonly NestedHeading[] = [
  { label: CLAIMS_VERSION_COLUMN, indent: 'edge', size: 'minmax(12rem,3fr)' },
  { label: KAPPA_COLUMN, size: 'minmax(10rem,2fr)' },
  { label: SAME_VERDICT_COLUMN, numeric: true, size: SPREAD },
  { label: RUNS_COLUMN, numeric: true, size: SPREAD },
];

export const SAME_VERDICT = SAME_VERDICT_COLUMN;

export const RUNS = RUNS_COLUMN;

export const kappaNote = (): TooltipNote => kappaNoteOf();

const AXIS_LABELS: Readonly<Record<string, string>> = {
  passes: 'Passed',
  fails: 'Failed',
};

export const formatAxisLabel = (label: string): string =>
  AXIS_LABELS[label] ?? `${label.charAt(0).toUpperCase()}${label.slice(1)}`;

export const confusionCellNote = (
  judge: string,
  people: string,
  count: number,
): TooltipNote => ({
  title: judge === people ? 'They agree' : 'They disagree',
  rows: [
    ['Judge', formatAxisLabel(judge)],
    ['People', formatAxisLabel(people)],
    ['Runs', `${count} ${unitOf(count)}`],
  ],
});

export const CONFUSION_TITLE = 'Judge compared with people';

export const confusionNote = (): TooltipNote => ({
  title: CONFUSION_TITLE,
  body: 'Rows are the judge’s verdict. Columns are people’s verdict. Cells on the diagonal are runs where they agree, in indigo. Cells off the diagonal are runs where they disagree, in red. A stronger colour means more runs.',
});
