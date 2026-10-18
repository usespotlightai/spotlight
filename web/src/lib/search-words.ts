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
import {
  formatGain,
  formatGainRange,
  formatInterval,
  formatMinGain,
  formatPoints,
} from '@/lib/replay-words';

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

export const GAIN_ON_SEARCHED = 'Gain over the live config, searched';

export const GAIN_ON_HELD_OUT = 'Gain over the live config, held out';

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

export const OBJECTIVE_LABEL = 'Aim for';

export const formatObjective = (objective: SearchObjective): string =>
  OBJECTIVES[objective];

export const objectiveNote = (objective: SearchObjective): string =>
  OBJECTIVE_NOTES[objective];

export const formatObjectiveSuggested = (rate: number): string =>
  `Suggested: the live config already succeeds on ${formatPercent(rate)} of this set. The set has little room for more success.`;

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
  'too-few-held-out': 'Too few held-out tasks to tell',
};

const OVERFIT_NOTES: Record<Overfit, string> = {
  likely:
    'This candidate beat the live config on searched tasks but not on held-out tasks. The gain may not carry over to new work.',
  'too-few-held-out':
    'This candidate beat the live config on searched tasks. Too few held-out tasks have a score to tell if the gain carries over.',
};

export const formatOverfit = (mark: Overfit): string => OVERFIT_LABELS[mark];

export const overfitNote = (mark: Overfit): string => OVERFIT_NOTES[mark];

export const OVERFIT_PICK =
  'The gain showed only on searched tasks. You can still pick this candidate, but the gain may not carry over to new work.';

export const formatOverfitCount = (count: number): string =>
  `${count} frontier ${count === 1 ? 'candidate' : 'candidates'} gained only on searched tasks, not on held-out tasks.`;

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

export const SPLIT_NOTE =
  'The search agent sees only the searched tasks and their scores. It doesn’t see the held-out tasks. After the search, the best candidates replay on the held-out tasks to check that they don’t only fit what the agent saw.';

export const formatHeldOutTasks = (titles: readonly string[]): string =>
  titles.length > 0 ? `Held out: ${titles.join(', ')}.` : '';

export const ON_THE_FRONTIER = 'On the frontier';

export const ON_THE_FRONTIER_NOTE =
  'On the frontier: no other candidate succeeds more for the same cost or less.';

export const CANDIDATES_NOTE =
  'Configs that the search agent proposed, by iteration. Pick a candidate to see its reasoning, replays and pull request.';

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
  'set-gone': 'Set deleted',
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
