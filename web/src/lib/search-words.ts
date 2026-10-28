import type {
  CandidatePullRequestResponseDto,
  ConfigPullRequestReasonResponseDto,
  FailureCauseResponseDto,
  ReplayCheckResponseDto,
  ReplaySetResponseDto,
  SearchCandidateResponseDto,
  SearchIterationResponseDto,
  SearchReflectionResponseDto,
  SearchResponseDto,
} from '@/lib/api';
import type { GainEstimate } from '@/lib/replay';
import {
  formatGain,
  formatGainRange,
  formatInterval,
} from '@/lib/replay-words';
import type { SearchRegressions } from '@/lib/search';
import type { TooltipNote, TooltipRow } from '@/lib/tooltip-note';

export type SearchState = SearchResponseDto['state'];
export type SearchStopReason = NonNullable<SearchResponseDto['stopReason']>;
export type IterationState = SearchIterationResponseDto['state'];
export type PullRequestState = CandidatePullRequestResponseDto['state'];
export type PullRequestStatus = Pick<
  CandidatePullRequestResponseDto,
  'state' | 'closedBecause' | 'closeFailure'
>;
type CloseReason = NonNullable<
  CandidatePullRequestResponseDto['closedBecause']
>;
export type PullRequestReason = ConfigPullRequestReasonResponseDto;
type ReasonCode = PullRequestReason['code'];
type CheckResult = ReplayCheckResponseDto['result'];
type Undecided = NonNullable<ReplayCheckResponseDto['undecidedBecause']>;
export type SearchObjective = SearchResponseDto['objective'];
export type SearchTrigger = SearchResponseDto['trigger'];
export type SearchPick = NonNullable<SearchResponseDto['pick']>;
type PickDecline = NonNullable<SearchPick['reason']>;
type SearchSchedule = NonNullable<ReplaySetResponseDto['searchSchedule']>;
export type SearchSkip = NonNullable<SearchSchedule['lastSkip']>;
type SkipReason = SearchSkip['reason'];
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
  closing: 'Spotlight is closing the pull request…',
  merged: 'Pull request merged',
  closed: 'Pull request closed',
  failed: 'No pull request opened',
};

const CLOSE_REASONS: Record<CloseReason, string> = {
  stale:
    'The live config of the station changed after the pull request opened.',
  'by-person': 'The pull request was closed on GitHub.',
};

const NOT_PROPOSED_AGAIN =
  "Spotlight does not propose this config again while the station's live config stays the same.";

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

export const formatPullRequestClosed = (
  pullRequest: Pick<
    CandidatePullRequestResponseDto,
    'closedBecause' | 'closeFailure'
  >,
): string | null => {
  const { closedBecause, closeFailure } = pullRequest;

  if (!closedBecause) {
    return null;
  }

  return [
    CLOSE_REASONS[closedBecause],
    closedBecause === 'by-person' && NOT_PROPOSED_AGAIN,
    closeFailure &&
      `Sorry, Spotlight could not close it on GitHub. ${closeFailure.message}`,
  ]
    .filter(Boolean)
    .join(' ');
};

export const formatCheckResult = (
  result: CheckResult,
  undecidedBecause: Undecided | null = null,
): string =>
  result === 'undecided' && undecidedBecause
    ? `${CHECK_RESULTS[result]}: ${UNDECIDED[undecidedBecause]}`
    : CHECK_RESULTS[result];

const GAIN_ON_SEARCHED = 'Gain over the live config, searched';

const GAIN_ON_HELD_OUT = 'Gain over the live config, held out';

const OBJECTIVES: Record<SearchObjective, string> = {
  success: 'More success',
  cost: 'The same success for less',
};

const OBJECTIVE_NOTES: Record<SearchObjective, string> = {
  success: 'Spotlight ranks candidates by how often they succeed.',
  cost: 'Spotlight ranks candidates by cost per run. Only candidates that match the live config’s success, within noise, count.',
};

const BEST_TERMS: Record<SearchObjective, string> = {
  success: 'Best',
  cost: 'Cheapest',
};

const NO_BEST: Record<SearchObjective, string> = {
  success: 'No best candidate yet',
  cost: 'No candidate matches the live config’s success yet',
};

const FRONTIER_NOTES: Record<SearchObjective, string> = {
  success:
    'Success on the searched tasks and cost per run of each candidate. Frontier: candidates that no other candidate beats for less. The live config is always on the frontier.',
  cost: 'Success on the searched tasks and cost per run of each candidate. Frontier: candidates that match the live config’s success, within noise, and that no other candidate matches for less. The live config is always on the frontier.',
};

export const formatObjective = (objective: SearchObjective): string =>
  OBJECTIVES[objective];

export const objectiveNote = (objective: SearchObjective): string =>
  OBJECTIVE_NOTES[objective];

export const formatBestTerm = (objective: SearchObjective): string =>
  BEST_TERMS[objective];

export const formatNoBest = (objective: SearchObjective): string =>
  NO_BEST[objective];

export const frontierNote = (objective: SearchObjective): string =>
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

export const SPLIT_NOTE =
  'The search agent sees only the searched tasks and their scores. It doesn’t see the held-out tasks. After the search, the best candidates replay on the held-out tasks to check that they don’t only fit what the agent saw.';

export const formatHeldOutTasks = (titles: readonly string[]): string =>
  titles.length > 0 ? `Held out: ${titles.join(', ')}.` : '';

export const ON_THE_FRONTIER = 'On the frontier';

export const ON_THE_FRONTIER_NOTE: TooltipNote = {
  title: ON_THE_FRONTIER,
  body: 'No other candidate succeeds more for less.',
};

export const CANDIDATES_NOTE =
  'Configs that the search agent proposed, by iteration. Select a candidate to see its hypothesis, results and pull request.';

export const formatBudgetNote = (
  budget: Pick<SearchResponseDto['budget'], 'perIteration' | 'concurrency'>,
  repeats: string,
  agent: string,
): string =>
  `Each iteration tries ${budget.perIteration} ${budget.perIteration === 1 ? 'candidate' : 'candidates'}, ${budget.concurrency} at once. ${repeats}. Search agent: ${agent}`;

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
  closing: 'Closing…',
  merged: 'Merged',
  closed: 'Closed',
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
  'ceiling-reached': 'Hit its ceiling',
  stalled: 'Stalled',
  stopped: 'Stopped',
  'station-gone': 'Station gone',
  'seed-failed': 'Couldn’t start',
};

export const formatStopReasonMark = (
  reason: SearchStopReason | null,
): string | null => (reason ? STOP_REASON_MARKS[reason] : null);

export const NO_VALUE = '–';

export const formatLikely = (
  interval: { readonly low: number; readonly high: number } | null,
): string | null =>
  interval ? `Likely range: ${formatInterval(interval)}.` : null;

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

export const VIEW_PULL_REQUEST = 'View pull request';

export const NO_SEARCHES_YET =
  'Spotlight searches the station on a schedule and when a station alert fires.';

const TRIGGER_LABELS: Record<SearchTrigger, string> = {
  schedule: 'On schedule',
  alert: 'After a station alert',
};

const TRIGGERS: Record<SearchTrigger, string> = {
  schedule:
    'Spotlight started this search. The period of the search policy ran out.',
  alert: 'Spotlight started this search. A station alert fired.',
};

export const formatTriggerLabel = (trigger: SearchTrigger): string =>
  TRIGGER_LABELS[trigger];

export const formatTrigger = (trigger: SearchTrigger): string =>
  TRIGGERS[trigger];

export const PICKED_TITLE = 'Picked by Spotlight';

export const NOT_PICKED_TITLE = 'No pull request';

const PICK_DECLINES: Record<PickDecline, string> = {
  'no-candidate': 'No candidate finished its replay on the held-out tasks.',
  'no-held-out-gain':
    'No candidate did better than the live config on the held-out tasks.',
  'not-cheaper':
    'No candidate cost less per run than the live config and did as well on the held-out tasks.',
  'over-regression-limit':
    'The best candidate is over the regression limit of the line.',
  'likely-overfit':
    'The best candidate is likely overfit. It did better only on the searched tasks.',
  'station-gone':
    'The station is gone from its line. Spotlight cannot change its config.',
  'pull-request-open': 'A config pull request for the station is already open.',
  'rejected-before':
    'A person closed a config pull request for each passing candidate while the live config stayed the same.',
};

const PICKED: Record<PullRequestState, (name: string) => string> = {
  opening: (name) =>
    `Spotlight picked ${name}. Its config pull request is opening.`,
  opened: (name) => `Spotlight opened a config pull request for ${name}.`,
  closing: (name) =>
    `Spotlight is closing the config pull request for ${name}.`,
  merged: (name) => `The config pull request for ${name} merged.`,
  closed: (name) => `The config pull request for ${name} is closed.`,
  failed: (name) =>
    `Spotlight picked ${name}. Its config pull request could not be opened.`,
};

export const formatPick = (
  pick: SearchPick,
  pullRequest: PullRequestStatus | null,
): string =>
  pick.outcome === 'picked'
    ? [
        PICKED[pullRequest?.state ?? 'opening'](pick.name ?? 'a candidate'),
        pullRequest && formatPullRequestClosed(pullRequest),
      ]
        .filter(Boolean)
        .join(' ')
    : PICK_DECLINES[pick.reason ?? 'no-candidate'];

const SKIP_REASONS: Record<SkipReason, (minimumTasks: number) => string> = {
  'no-agent': () => 'no runner can start the harness of the search agent.',
  'no-scoring': () => 'the station has no judge and no check.',
  'set-too-small': (minimumTasks) =>
    `the replay set has too few tasks. Minimum tasks: ${minimumTasks}`,
  'no-fresh-held-out': () =>
    'earlier searches searched on too many tasks of the set. A search needs new tasks to hold out.',
  'ceiling-too-low': () =>
    'the search ceiling is too low to replay each task once per candidate.',
  noisy: () => 'success moves too much between repeats of the same runs.',
  'judge-unstable': () => 'the judge does not give the same verdict twice.',
  'flaky-checks': () => 'the check flips on changes that it ran twice.',
  'no-headroom': () =>
    'the live config does not do better on the set when it gets the answer.',
  'monthly-ceiling': () =>
    'the searches of the line spent the monthly ceiling of its search policy.',
  'pull-request-open': () => 'a config pull request of the station is open.',
  cooldown: () => 'the last search of the station started too recently.',
};

export const formatSkip = (
  skip: SearchSkip | null,
  minimumTasks: number,
): string =>
  skip
    ? `Spotlight did not start a search: ${SKIP_REASONS[skip.reason](minimumTasks)}`
    : NO_SEARCHES_YET;
