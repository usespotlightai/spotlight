import type {
  ConfigPullRequestReasonResponseDto,
  FailureCauseResponseDto,
  ReplayCheckResponseDto,
  SearchCandidateResponseDto,
  SearchEstimateResponseDto,
  SearchIterationResponseDto,
  SearchReflectionResponseDto,
  SearchResponseDto,
} from '@/lib/api';
import { formatPercent } from '@/lib/judge';
import type { GainEstimate } from '@/lib/replay';
import {
  counted,
  formatGain,
  formatGainRange,
  formatInterval,
  formatMinGain,
  formatPoints,
} from '@/lib/replay-words';
import type { SearchRegressions } from '@/lib/search';
import type { TooltipNote, TooltipRow } from '@/lib/tooltip-note';

export type SearchState = SearchResponseDto['state'];
export type SearchStopReason = NonNullable<SearchResponseDto['stopReason']>;
export type IterationState = SearchIterationResponseDto['state'];
export type PullRequestState = NonNullable<
  SearchCandidateResponseDto['pullRequest']
>['state'];
export type PullRequestReason = ConfigPullRequestReasonResponseDto;
type ReasonCode = PullRequestReason['code'];
type CheckResult = ReplayCheckResponseDto['result'];
type Undecided = NonNullable<ReplayCheckResponseDto['undecidedBecause']>;
export type SearchWarning = SearchEstimateResponseDto['warnings'][number];
export type SearchObjective = SearchEstimateResponseDto['objective'];
export type CauseKind = FailureCauseResponseDto['cause'];
export type ReflectionResult = NonNullable<
  SearchReflectionResponseDto['result']
>;
export type Overfit = NonNullable<SearchCandidateResponseDto['overfit']>;

const STATES: Record<SearchState, string> = {
  seeding: 'Replaying the live config',
  searching: 'Searching',
  'holding-out': 'Checking on held-out tasks',
  finished: 'Finished',
  stopped: 'Stopped',
};

const STOP_REASONS: Record<SearchStopReason, string> = {
  'iterations-spent': 'Ran every iteration it was given',
  'ceiling-reached': 'Reached its ceiling',
  stalled: 'Found nothing better twice in a row',
  stopped: 'Stopped by a person',
  'station-gone': 'Station is gone from the line',
  'set-gone': 'Replay set was deleted',
  'seed-failed': 'Live config couldn’t be replayed',
};

const ITERATION_STATES: Record<IterationState, string> = {
  wanted: 'Waiting for a runner',
  running: 'Running',
  ended: 'Ended',
  failed: 'Failed',
};

const PULL_REQUEST_STATES: Record<PullRequestState, string> = {
  opening: 'Opening a pull request…',
  opened: 'Pull request opened',
  failed: 'No pull request opened',
};

const REASONS: Record<ReasonCode, string> = {
  'no-source': 'Line names no repository for its Terraform',
  'repository-unreachable':
    'Spotlight’s GitHub App can’t access the line’s repository',
  'file-missing': 'Line’s Terraform file isn’t in its repository',
  'file-unparsable': 'Line’s Terraform file couldn’t be read',
  'block-not-found': 'Station’s block isn’t in the file',
  'blocks-ambiguous': 'Station’s block appears more than once',
  'computed-attribute':
    'Attribute is computed in Terraform. Please set it by hand.',
  'base-changed': 'File changed since the search began',
  'edit-failed':
    'Edited file wouldn’t parse as Terraform. Please make the change by hand.',
  'branch-taken': 'Pull request branch already exists',
  'file-unwritable': 'File couldn’t be written to its repository',
  'github-error': 'GitHub answered with an error',
};

const CHECK_RESULTS: Record<CheckResult, string> = {
  running: 'Checking',
  passed: 'Passed',
  failed: 'Too many regressions',
  undecided: 'Undecided',
};

const UNDECIDED: Record<Undecided, string> = {
  'replay-gone': 'replay is gone',
  stopped: 'replay was stopped',
  'over-ceiling': 'replay reached its ceiling',
  'baseline-unfinished': 'live config’s replay didn’t finish',
  'no-baseline': 'no live-config replay to compare with',
  'too-few-scored': 'under half the tasks scored on both sides',
};

export const formatSearchState = (state: SearchState): string => STATES[state];

export const formatStopReason = (reason: SearchStopReason): string =>
  STOP_REASONS[reason];

export const formatIterationState = (state: IterationState): string =>
  ITERATION_STATES[state];

export const formatPullRequestState = (state: PullRequestState): string =>
  PULL_REQUEST_STATES[state];

export const formatPullRequestReason = (reason: PullRequestReason): string =>
  REASONS[reason.code];

export const formatCheckResult = (
  result: CheckResult,
  undecidedBecause: Undecided | null = null,
): string =>
  result === 'undecided' && undecidedBecause
    ? `${CHECK_RESULTS[result]}: ${UNDECIDED[undecidedBecause]}`
    : CHECK_RESULTS[result];

export const formatWarning = (warning: SearchWarning): string => {
  switch (warning.kind) {
    case 'noise-unmeasured':
      return 'The set’s noise isn’t measured. A small gain can be chance. Please replay each run more than once, or replay a set of 5 or more runs to measure it.';
    case 'noisy': {
      const fix =
        warning.neededRepeats > warning.suggestedRepeats
          ? `Even the maximum of ${warning.suggestedRepeats} repeats won’t bring the noise below it. Read small gains with care, or raise the line’s min_gain.`
          : `If you replay each run ${warning.suggestedRepeats} times, the noise falls below it.`;

      return `Success moved ${formatPoints(warning.spread)} between repeats of the same runs. This is more than the line’s minimum real gain. ${fix} Minimum real gain: ${formatMinGain(warning.minGain)}`;
    }
    case 'saturated':
      return `The live config already succeeds on ${formatPercent(warning.rate)} of this set. Aim for the same success for less, or add tasks that the live config fails.`;
    case 'judge-unstable':
      return `The judge gave the same verdict twice on only ${formatPercent(warning.agreement)} of ${warning.compared} ${warning.compared === 1 ? 'change' : 'changes'}. Make the rubric more specific before you search.`;
    case 'flaky-checks':
      return `The check flipped on ${warning.flaky} of ${warning.rechecked} changes that it ran twice. It can flip a candidate’s result by chance. The set page lists these changes.`;
    case 'no-headroom':
      return `With each run’s answer, the live config gained only ${formatGain(warning)} on ${warning.answered} ${warning.answered === 1 ? 'run' : 'runs'}. The likely range is ${formatGainRange(warning)}. A better config has little room to show a gain here. Please add tasks that the live config fails.`;
  }
};

export const formatRepeatsSuggestion = (repeats: number): string =>
  `Replay each run ${repeats} times`;

const GAIN_ON_SEARCHED = 'Gain over the live config, searched';

const GAIN_ON_HELD_OUT = 'Gain over the live config, held out';

const OBJECTIVES: Record<SearchObjective, string> = {
  success: 'More success',
  cost: 'The same success for less',
};

const OBJECTIVE_NOTES: Record<SearchObjective, string> = {
  success: 'Spotlight ranks candidates by how often they succeed.',
  cost: 'Spotlight ranks candidates by cost per run, considering only those whose success rate matches the live configuration within statistical uncertainty.',
};

const AIMS: Record<SearchObjective, string> = {
  success: 'The search aims for more success.',
  cost: 'The search aims to maintain the same success rate at a lower cost.',
};

const BEST_TERMS: Record<SearchObjective, string> = {
  success: 'Best',
  cost: 'Cheapest',
};

const NO_BEST: Record<SearchObjective, string> = {
  success: 'No best candidate yet',
  cost: 'No candidate matches the live config’s success yet',
};

const FRONTIER_NOTES: Record<SearchObjective, TooltipNote> = {
  success: {
    body: 'Success on the searched tasks and cost per run of each candidate.',
    rows: [
      [
        'Frontier',
        'Candidates that no other candidate beats for less. The live config is always on the frontier.',
      ],
    ],
  },
  cost: {
    body: 'Each candidate is evaluated by its success rate on the searched tasks and its cost per run.',
    rows: [
      [
        'Frontier',
        'Candidates that match the live configuration’s success rate, within statistical uncertainty, and cannot be matched by another candidate at a lower cost. The live configuration is always included as a baseline.',
      ],
    ],
  },
};

export const OBJECTIVE_LABEL = 'Aim for';

export const formatObjective = (objective: SearchObjective): string =>
  OBJECTIVES[objective];

export const objectiveNote = (objective: SearchObjective): string =>
  OBJECTIVE_NOTES[objective];

export const formatAims = (objective: SearchObjective): string =>
  `${AIMS[objective]} ${OBJECTIVE_NOTES[objective]}`;

export const formatObjectiveSuggested = (rate: number): string =>
  `Suggested: the live config already succeeds on ${formatPercent(rate)} of this set. The set has little room for more success.`;

export const formatBestTerm = (objective: SearchObjective): string =>
  BEST_TERMS[objective];

export const formatNoBest = (objective: SearchObjective): string =>
  NO_BEST[objective];

export const frontierNote = (objective: SearchObjective): TooltipNote =>
  FRONTIER_NOTES[objective];

export const bestScoreNote = (
  heldOut: boolean,
  interval: { low: number; high: number } | null,
): string =>
  [
    `This score is from the ${heldOut ? 'held-out' : 'searched'} tasks.`,
    interval && `Likely range: ${formatInterval(interval)}`,
  ]
    .filter(Boolean)
    .join(' ');

export const formatBestOn = (heldOut: boolean): string =>
  heldOut ? 'held out' : 'searched';

export const formatSuccessOn = (heldOut: boolean): string =>
  `Success rate, ${formatBestOn(heldOut)}`;

export const formatCheapest = (cost: string, live: string | null): string =>
  live === null ? `${cost} per run` : `${cost} per run, down from ${live}`;

const OVERFIT_LABELS: Record<Overfit, string> = {
  likely: 'Likely overfit',
  'too-few-held-out': 'Overfit unknown',
};

const OVERFIT_NOTES: Record<Overfit, TooltipNote> = {
  likely: {
    title: 'Likely overfit',
    body: 'It gained on searched tasks, not on held-out tasks.',
  },
  'too-few-held-out': {
    title: 'Overfit unknown',
    body: 'Too few held-out tasks have a score.',
  },
};

export const formatOverfit = (mark: Overfit): string => OVERFIT_LABELS[mark];

export const overfitNote = (mark: Overfit): TooltipNote => OVERFIT_NOTES[mark];

export const REGRESSION_LIMIT_EXCEEDED = 'Over the regression limit';

const regressionRows = ({
  searched,
  heldOut,
}: SearchRegressions): TooltipRow[] => [
  ...(searched !== null ? [['Searched', String(searched)] as const] : []),
  ...(heldOut !== null ? [['Held out', String(heldOut)] as const] : []),
];

export const regressionLimitNote = (
  regressions: SearchRegressions,
  maxRegressions: number,
): TooltipNote => ({
  title: REGRESSION_LIMIT_EXCEEDED,
  rows: [
    ['Regressed', tasksCounted(regressions.total ?? 0)],
    ['Line allows', String(maxRegressions)],
  ],
});

export const regressionsNote = (
  regressions: SearchRegressions,
): TooltipNote => ({
  rows: regressionRows(regressions),
});

export const SEARCH_CEILING_NOTE =
  'The most that the whole search can spend. Its replays and its agent’s runs count.';

export const formatWhyItStalled = (iteration: number): string =>
  `Why it stalled (iteration ${iteration})`;

export const REFLECTION_KIND = 'Looked for why it stalled';

const CAUSE_TITLES: Record<CauseKind, string> = {
  task: 'The task itself',
  judge: 'The judge',
  check: 'The check',
  infra: 'Around the work',
  config: 'The station’s config',
};

const CAUSE_MEANINGS: Record<CauseKind, string> = {
  task: 'The task is unclear, out of date, or can’t be done as written. No config would get it right.',
  judge:
    'The work can be fine, but the judge scored it wrong. The judge’s rubric requires the wrong thing.',
  check:
    'The check failed for a reason that the change didn’t cause, such as a broken or flaky test.',
  infra:
    'Something around the work failed the run, such as the runner, the network or a missing tool.',
  config:
    'A change to the station’s config, such as prompt, model or skills, could still fix it.',
};

const CAUSE_ACTIONS: Record<CauseKind, string> = {
  task: 'Fix the task, or take it out of the replay set.',
  judge: 'Fix the judge’s rubric.',
  check: 'Fix the check.',
  infra: 'Replay it again. If it keeps failing, fix what the run needs.',
  config:
    'You don’t need to do anything. The search keeps trying configs for these tasks.',
};

export const formatCauseTitle = (cause: CauseKind): string =>
  CAUSE_TITLES[cause];

export const formatCauseMeaning = (cause: CauseKind): string =>
  CAUSE_MEANINGS[cause];

export const formatCauseAction = (cause: CauseKind): string =>
  CAUSE_ACTIONS[cause];

export const UNCAUSED_TITLE = 'No cause recorded';

export const UNCAUSED_NOTE =
  'The search agent looked into these tasks but recorded no cause.';

export const SUGGESTED = 'Suggested:';

export const OPEN_FAILED_REPLAY = 'Open the failed replay run';

const tasksCounted = (count: number): string =>
  `${count} ${count === 1 ? 'task' : 'tasks'}`;

export const formatIncumbent = (candidate: {
  readonly isSeed: boolean;
  readonly name: string;
}): string =>
  `Looked at why ${candidate.isSeed ? 'the live config' : candidate.name} failed`;

export const formatReflectionLooked = (tasks: number): string =>
  `Two iterations in a row found nothing better. The search agent sorted the ${tasksCounted(tasks)} that the best config still failed by cause.`;

export const REFLECTION_LOOKING =
  'Two iterations in a row found nothing better. The search agent is looking into why the remaining tasks fail.';

const REFLECTION_RESULTS: Record<ReflectionResult, string> = {
  continued:
    'The search continued. A config change can still fix some of these tasks.',
  'no-config-cause':
    'The search ended. No config change can fix the tasks that are left. The rest of the budget stays unspent.',
  'no-failures': 'The search ended. No searched task failed.',
  'did-not-run':
    'The search ended. The search agent’s run failed before it recorded a cause.',
  'ceiling-reached':
    'The search ended at its ceiling. A config change can still fix some of these tasks.',
};

export const formatReflectionResult = (result: ReflectionResult): string =>
  REFLECTION_RESULTS[result];

export const formatReflectionIteration = (
  tasks: number,
  causes: number,
): string =>
  `This iteration proposed nothing. The search agent looked into ${tasksCounted(tasks)} that the best config still failed. Causes recorded: ${causes}`;

export const REFLECTION_ITERATION_PENDING =
  'This iteration proposes nothing. The search agent is looking into why the remaining tasks fail.';

export const SEE_WHY_IT_STALLED = 'See why it stalled';

export const formatSplitNote = (heldOut: readonly string[]): TooltipNote => ({
  body: 'The search agent only sees the tasks and scores used during the search. Afterward, the best candidates are evaluated against held-out tasks the agent hasn’t seen, to verify that improvements generalize beyond the search.',
  list: { title: `Held-out tasks (${heldOut.length})`, items: heldOut },
});

export const ON_THE_FRONTIER = 'On the frontier';

export const ON_THE_FRONTIER_NOTE: TooltipNote = {
  title: ON_THE_FRONTIER,
  body: 'No other candidate achieves a higher success rate without increasing cost, or a lower cost without reducing success.',
};

export const CANDIDATES_NOTE =
  'Candidate configurations proposed by the search agent, organized by iteration. Select a candidate to view its hypothesis, evaluation results, and pull request.';

export const formatBudgetNote = (
  budget: Pick<
    SearchResponseDto['budget'],
    'perIteration' | 'concurrency' | 'repeats'
  >,
  agent: string,
): TooltipNote => ({
  body: [
    `Each iteration proposes up to ${counted(budget.perIteration, 'candidate', 'candidates')}.`,
    `Up to ${counted(budget.concurrency, 'replay run', 'replay runs')} run in parallel.`,
    `Each run is replayed ${budget.repeats === 1 ? 'once' : `${budget.repeats} times`} per candidate.`,
  ].join(' '),
  rows: [['Search agent', agent]],
});

export const formatEffort = (effort: string): string =>
  `${effort.charAt(0).toUpperCase()}${effort.slice(1)} reasoning`;

export const candidateGainNote = (
  searched: SearchCandidateResponseDto['searchedGain'],
  heldOut: SearchCandidateResponseDto['heldOutGain'],
): string =>
  [
    searched &&
      `${GAIN_ON_SEARCHED}: ${formatGain(searched)}, likely ${formatGainRange(searched)} pts.`,
    heldOut &&
      `${GAIN_ON_HELD_OUT}: ${formatGain(heldOut)}, likely ${formatGainRange(heldOut)} pts.`,
  ]
    .filter(Boolean)
    .join(' ');

const PULL_REQUEST_CELLS: Record<PullRequestState, string> = {
  opening: 'Opening…',
  opened: 'Opened',
  failed: 'Not opened',
};

export const formatPullRequestCell = (state: PullRequestState): string =>
  PULL_REQUEST_CELLS[state];

export const formatIterationNote = (
  iteration: Pick<
    SearchIterationResponseDto,
    'kind' | 'state' | 'proposed' | 'attempts'
  >,
  spent: readonly string[],
): string =>
  [
    `${ITERATION_STATES[iteration.state]}.`,
    iteration.kind === 'reflect'
      ? null
      : `The search took ${iteration.proposed.length} of ${iteration.attempts} ${iteration.attempts === 1 ? 'proposal' : 'proposals'}.`,
    spent.length > 0 ? `The search agent spent ${spent.join(' · ')}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

const STOP_REASON_MARKS: Record<SearchStopReason, string | null> = {
  'iterations-spent': null,
  'ceiling-reached': 'Ceiling reached',
  stalled: 'Stalled',
  stopped: 'Stopped',
  'station-gone': 'Station gone',
  'set-gone': 'Set deleted',
  'seed-failed': 'Couldn’t start',
};

export const formatStopReasonMark = (
  reason: SearchStopReason | null,
): string | null => (reason ? STOP_REASON_MARKS[reason] : null);

export const NO_VALUE = '–';

export const estimatedRateRows = (
  interval: { readonly low: number; readonly high: number } | null,
): TooltipRow[] =>
  interval ? [['Estimated success rate', formatInterval(interval)]] : [];

export const formatSentences = (...parts: readonly (string | null)[]): string =>
  parts.filter(Boolean).join(' ');

export const CHANGES_TITLE = 'Changes';

export const HYPOTHESIS_TITLE = 'Hypothesis';

export const RESULTS_TITLE = 'Results';

export const THIS_CONFIG = 'This config';

export const GAIN_TITLE = 'Gain';

export const SEED_CHANGES =
  'The station as configured when the search started.';

export const NO_CHANGES = 'Same as the live config.';

export const formatRateNote = (
  interval: { readonly low: number; readonly high: number } | null,
): TooltipNote | null =>
  interval ? { rows: [['Likely range', formatInterval(interval)]] } : null;

const GAIN_TITLES: Record<GainEstimate['significance'], string> = {
  better: 'Better',
  worse: 'Worse',
  'within-noise': 'Within noise',
};

export const formatGainNote = (gain: GainEstimate): TooltipNote => ({
  title: GAIN_TITLES[gain.significance],
  rows: [['Likely range', `${formatGainRange(gain)} pts`]],
});

export const OPEN_PULL_REQUEST = 'Open pull request';

export const OPENING_PULL_REQUEST = 'Opening…';

export const VIEW_PULL_REQUEST = 'View pull request';

export const RETRY_PULL_REQUEST = 'Retry';
