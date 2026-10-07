import type {
  ConfigPullRequestReasonResponseDto,
  ReplayCheckResponseDto,
  SearchCandidateResponseDto,
  SearchCauseResponseDto,
  SearchEstimateResponseDto,
  SearchIterationResponseDto,
  SearchReflectionResponseDto,
  SearchResponseDto,
} from '@/lib/api';
import { percentShown } from '@/lib/judge';
import {
  gainRangeShown,
  gainShown,
  minGainShown,
  pointsShown,
} from '@/lib/replay-words';

export type SearchState = SearchResponseDto['state'];
export type SearchEnding = NonNullable<SearchResponseDto['ending']>;
export type IterationState = SearchIterationResponseDto['state'];
export type PullRequestState = NonNullable<
  SearchCandidateResponseDto['pullRequest']
>['state'];
export type PullRequestReason = ConfigPullRequestReasonResponseDto;
type ReasonCode = PullRequestReason['code'];
type CheckVerdict = ReplayCheckResponseDto['verdict'];
type Undecided = NonNullable<ReplayCheckResponseDto['undecidedBecause']>;
export type SearchWarning = SearchEstimateResponseDto['warnings'][number];
export type SearchObjective = SearchEstimateResponseDto['objective'];
export type CauseKind = SearchCauseResponseDto['cause'];
export type ReflectionOutcome = NonNullable<
  SearchReflectionResponseDto['outcome']
>;
export type OnlyOnSeenTasks = NonNullable<
  SearchCandidateResponseDto['onlyOnSeenTasks']
>;

const STATES: Record<SearchState, string> = {
  seeding: 'Replaying the live config',
  searching: 'Searching',
  'holding-out': 'Checking on held-out tasks',
  finished: 'Finished',
  stopped: 'Stopped',
};

const ENDINGS: Record<SearchEnding, string> = {
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
  refused: 'No pull request opened',
};

const REASONS: Record<ReasonCode, string> = {
  'no-source': 'Line names no repository for its Terraform',
  'repository-unreachable':
    'Spotlight’s GitHub App can’t reach the line’s repository',
  'file-missing': 'Line’s Terraform file isn’t in its repository',
  'file-unparsable': 'Line’s Terraform file couldn’t be read',
  'block-not-found': 'Station’s block isn’t in the file',
  'blocks-ambiguous': 'Station’s block appears more than once',
  'computed-attribute':
    'Attribute is computed in Terraform. Please set it by hand.',
  drifted: 'File changed since the search began',
  'edit-failed':
    'Edited file wouldn’t parse as Terraform. Please make the change by hand.',
  'branch-taken': 'Pull request branch already exists',
  'file-unwritable': 'File couldn’t be written to its repository',
  'github-refused': 'GitHub refused the change',
};

const CHECK_VERDICTS: Record<CheckVerdict, string> = {
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

export const searchStateShown = (state: SearchState): string => STATES[state];

export const endingShown = (ending: SearchEnding): string => ENDINGS[ending];

export const iterationStateShown = (state: IterationState): string =>
  ITERATION_STATES[state];

export const pullRequestStateShown = (state: PullRequestState): string =>
  PULL_REQUEST_STATES[state];

export const pullRequestReasonShown = (reason: PullRequestReason): string =>
  REASONS[reason.code];

export const verdictShown = (
  verdict: CheckVerdict,
  undecidedBecause: Undecided | null = null,
): string =>
  verdict === 'undecided' && undecidedBecause
    ? `${CHECK_VERDICTS[verdict]}: ${UNDECIDED[undecidedBecause]}`
    : CHECK_VERDICTS[verdict];

export const warningShown = (warning: SearchWarning): string => {
  switch (warning.kind) {
    case 'noise-unmeasured':
      return 'Set’s noise is unmeasured. A small gain may be luck. Use Check this set, or replay each run more than once.';
    case 'noisy': {
      const fix =
        warning.neededRepeats > warning.suggestedRepeats
          ? `Even ${warning.suggestedRepeats} repeats, the maximum, won’t bring it under. Read small gains with care, or raise the line’s min_gain.`
          : `Replaying each run ${warning.suggestedRepeats} times would bring it under.`;

      return `Success moved ${pointsShown(warning.spread)} between copies of the same runs, above the line’s minimum real gain. ${fix} Minimum real gain: ${minGainShown(warning.minGain)}`;
    }
    case 'saturated':
      return `Live config already succeeds on ${percentShown(warning.rate)} of this set. Aim for the same success for less, or add tasks the live config fails.`;
    case 'judge-unstable':
      return `Judge gave the same verdict twice on only ${percentShown(warning.agreement)} of ${warning.compared} ${warning.compared === 1 ? 'change' : 'changes'}. Make the rubric more specific before you search.`;
    case 'flaky-checks':
      return `Check flipped on ${warning.flaky} of ${warning.rechecked} changes it ran twice. It may flip a candidate’s result by chance. The set page lists them.`;
    case 'sanity-failed':
      return `A stronger model didn’t do clearly better on this set: ${gainShown(warning)}, likely ${gainRangeShown(warning)}. It did worse on ${warning.worseTasks} ${warning.worseTasks === 1 ? 'task' : 'tasks'}. Tasks may be unclear, or scoring off.`;
  }
};

export const repeatsSuggestionShown = (repeats: number): string =>
  `Replay each run ${repeats} times`;

export const GAIN_ON_SEARCHED = 'Gain over the live config, searched';

export const GAIN_ON_HELD_OUT = 'Gain over the live config, held out';

const OBJECTIVES: Record<SearchObjective, string> = {
  success: 'More success',
  cost: 'The same success for less',
};

const OBJECTIVE_NOTES: Record<SearchObjective, string> = {
  success: 'Ranks candidates by how often they succeed.',
  cost: 'Ranks candidates by cost per run. Only those matching the live config’s success, within noise, count.',
};

const BEST_TERMS: Record<SearchObjective, string> = {
  success: 'Best',
  cost: 'Cheapest',
};

const NO_BEST: Record<SearchObjective, string> = {
  success: 'No best candidate yet',
  cost: 'No candidate holds its success yet',
};

const FRONTIER_NOTES: Record<SearchObjective, string> = {
  success:
    'Success on the searched tasks against cost per run. Frontier: candidates no other beats for less. The live config is always on it.',
  cost: 'Success on the searched tasks against cost per run. Frontier: candidates matching the live config’s success, within noise, that no other matches for less. The live config is always on it.',
};

export const OBJECTIVE_LABEL = 'Aim for';

export const OBJECTIVE_TERM = 'Aims for';

export const objectiveShown = (objective: SearchObjective): string =>
  OBJECTIVES[objective];

export const objectiveNote = (objective: SearchObjective): string =>
  OBJECTIVE_NOTES[objective];

export const objectiveSuggestedShown = (rate: number): string =>
  `Suggested: the live config already succeeds on ${percentShown(rate)} of this set. Little room for more success.`;

export const bestTermShown = (objective: SearchObjective): string =>
  BEST_TERMS[objective];

export const bestLabelShown = (objective: SearchObjective): string =>
  `${BEST_TERMS[objective]}:`;

export const noBestShown = (objective: SearchObjective): string =>
  NO_BEST[objective];

export const frontierNote = (objective: SearchObjective): string =>
  FRONTIER_NOTES[objective];

export const bestOnShown = (heldOut: boolean): string =>
  heldOut ? 'held out' : 'searched';

const ONLY_ON_SEEN_TASKS: Record<OnlyOnSeenTasks, string> = {
  marked: 'Only on seen tasks',
  'too-few-held-out': 'Too few held-out tasks to tell',
};

const ONLY_ON_SEEN_TASKS_NOTES: Record<OnlyOnSeenTasks, string> = {
  marked:
    'Beat the live config on searched tasks, not on held-out ones. Gain may not carry over to new work.',
  'too-few-held-out':
    'Beat the live config on searched tasks. Too few held-out tasks scored to tell if the gain carries over.',
};

export const onlyOnSeenTasksShown = (mark: OnlyOnSeenTasks): string =>
  ONLY_ON_SEEN_TASKS[mark];

export const onlyOnSeenTasksNote = (mark: OnlyOnSeenTasks): string =>
  ONLY_ON_SEEN_TASKS_NOTES[mark];

export const ONLY_ON_SEEN_TASKS_PICK =
  'Gain showed only on searched tasks. You can still pick it, but it may not carry over to new work.';

export const onlyOnSeenTasksCountShown = (count: number): string =>
  `${count} frontier ${count === 1 ? 'candidate' : 'candidates'} gained only on searched tasks, not held-out ones.`;

export const SEARCH_CEILING_NOTE =
  'Most the whole search may spend: its replays and its agent’s runs.';

export const whyItStalledShown = (iteration: number): string =>
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
  task: 'Task is unclear, out of date, or can’t be done as asked. No config would get it right.',
  judge:
    'Work may be fine, but the judge scored it wrong. Its rubric asks for the wrong thing.',
  check:
    'Check failed for a reason the change didn’t cause, such as a broken or flaky test.',
  infra:
    'Run failed around the work: the runner, the network or a missing tool.',
  config:
    'A change to the station’s config, such as prompt, model or skills, could still fix it.',
};

const CAUSE_ACTIONS: Record<CauseKind, string> = {
  task: 'Fix the task, or take it out of the replay set.',
  judge: 'Fix the judge’s rubric.',
  check: 'Fix the check.',
  infra: 'Replay it again. If it keeps failing, fix what the run needs.',
  config: 'Nothing to do. The search keeps trying configs for these.',
};

export const causeTitleShown = (cause: CauseKind): string =>
  CAUSE_TITLES[cause];

export const causeMeaningShown = (cause: CauseKind): string =>
  CAUSE_MEANINGS[cause];

export const causeActionShown = (cause: CauseKind): string =>
  CAUSE_ACTIONS[cause];

export const UNCAUSED_TITLE = 'No cause recorded';

export const UNCAUSED_NOTE =
  'Search agent looked into these but recorded no cause.';

export const SUGGESTED = 'Suggested:';

export const OPEN_FAILED_REPLAY = 'Open the failed replay run';

const tasksCounted = (count: number): string =>
  `${count} ${count === 1 ? 'task' : 'tasks'}`;

export const standingShown = (candidate: {
  readonly seed: boolean;
  readonly name: string;
}): string =>
  `Looked at why ${candidate.seed ? 'the live config' : candidate.name} failed`;

export const reflectionLookedShown = (tasks: number): string =>
  `Two iterations in a row found nothing better. The search agent sorted the ${tasksCounted(tasks)} the best config still failed by cause.`;

export const REFLECTION_LOOKING =
  'Two iterations in a row found nothing better. The search agent is looking into why the remaining tasks fail.';

const REFLECTION_OUTCOMES: Record<ReflectionOutcome, string> = {
  'went-on': 'Search continued. A config change could still fix some of them.',
  'no-config-cause':
    'Search ended. Nothing left is fixable by config. Unspent budget is kept.',
  'no-failures': 'Search ended. No searched task failed.',
  'did-not-run':
    'Search ended. The search agent’s run failed before recording any cause.',
  'out-of-budget':
    'Search ended with no budget left. A config change could still fix some of them.',
};

export const reflectionOutcomeShown = (outcome: ReflectionOutcome): string =>
  REFLECTION_OUTCOMES[outcome];

export const reflectionIterationShown = (
  tasks: number,
  causes: number,
): string =>
  `Proposed nothing. Looked into ${tasksCounted(tasks)} the best config still failed. Causes recorded: ${causes}`;

export const REFLECTION_ITERATION_PENDING =
  'Proposes nothing. The search agent is looking into why the remaining tasks fail.';

export const SEE_WHY_IT_STALLED = 'See why it stalled';
