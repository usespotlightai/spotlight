import type {
  ConfigPullRequestReasonResponseDto,
  ReplayCheckResponseDto,
  SearchCandidateResponseDto,
  SearchEstimateResponseDto,
  SearchIterationResponseDto,
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
  'iterations-spent': 'It ran every iteration it was given',
  'ceiling-reached': 'It reached its ceiling',
  stalled: 'Two iterations in a row found nothing, so it stopped',
  stopped: 'A person stopped it',
  'station-gone': 'Its station is gone from its line',
  'set-gone': 'Its replay set was deleted',
  'seed-failed': 'The live config could not be replayed',
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
  'no-source': 'The line does not say which repository holds its Terraform',
  'repository-unreachable':
    'Spotlight’s GitHub App cannot reach the line’s repository',
  'file-missing': 'The line’s Terraform file is not in its repository',
  'file-unparsable': 'The line’s Terraform file could not be read',
  'block-not-found': 'The station’s block was not found in the file',
  'blocks-ambiguous': 'The station’s block was found more than once',
  'computed-attribute':
    'An attribute it would change is computed in Terraform, so it must be set by hand',
  drifted: 'The file changed since the search began',
  'edit-failed':
    'Spotlight’s change to the file would not read back as Terraform, so it must be made by hand',
  'branch-taken': 'The branch for the pull request is taken already',
  'file-unwritable': 'The file could not be written in its repository',
  'github-refused': 'GitHub refused the change',
};

const CHECK_VERDICTS: Record<CheckVerdict, string> = {
  running: 'Checking',
  passed: 'Passed',
  failed: 'Too many regressions',
  undecided: 'Undecided',
};

const UNDECIDED: Record<Undecided, string> = {
  'replay-gone': 'its replay is gone',
  stopped: 'its replay was stopped',
  'over-ceiling': 'its replay reached its ceiling',
  'baseline-unfinished': 'the live config’s replay did not finish',
  'no-baseline': 'there was no replay of the live config to compare with',
  'too-few-scored': 'fewer than half the tasks were scored on both sides',
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
      return 'Nobody has measured how much this set’s success moves by chance, so a small gain may be luck. Use Check this set on the set page, or replay each run more than once.';
    case 'noisy': {
      const fix =
        warning.neededRepeats > warning.suggestedRepeats
          ? `Even replaying each run ${warning.suggestedRepeats} times, the most allowed, won’t bring it under that, so read small gains with care or raise the line’s smallest real gain.`
          : `Replaying each run ${warning.suggestedRepeats} times would bring that down.`;

      return `This set’s success moved ${pointsShown(warning.spread)} between copies of the same runs, more than the ${minGainShown(warning.minGain)} the line counts as real. ${fix}`;
    }
    case 'saturated':
      return `The live config already succeeds on ${percentShown(warning.rate)} of this set, so there is little room to succeed more. Aim for the same success for less, or add tasks the live config fails.`;
    case 'judge-unstable':
      return `Judging the same change twice, the judge gave the same verdict only ${percentShown(warning.agreement)} of the time over ${warning.compared} ${warning.compared === 1 ? 'change' : 'changes'}, so its verdicts are partly chance. Make the rubric more specific before you search.`;
    case 'flaky-checks':
      return `The check passed once and failed once on ${warning.flaky} of ${warning.rechecked} changes it ran twice, so it may flip a candidate’s result by chance. The set page lists them.`;
    case 'sanity-failed':
      return `A stronger model did not do clearly better on this set (${gainShown(warning)}, likely ${gainRangeShown(warning)}) and did worse on ${warning.worseTasks} ${warning.worseTasks === 1 ? 'task' : 'tasks'}, so its tasks may be unclear or its scoring off.`;
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
  cost: 'Ranks the candidates that succeed as often as the live config, within noise, by what a run costs.',
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
    'How often each candidate succeeded on the searched tasks, against what it spent a run. The frontier joins those no other succeeds as often for less; the live config is always on it.',
  cost: 'How often each candidate succeeded on the searched tasks, against what it spent a run. This search aims for the same success for less, so the frontier joins only those that succeed as often as the live config, within noise, and that no other matches for less; the live config is always on it.',
};

export const OBJECTIVE_LABEL = 'Aim for';

export const OBJECTIVE_TERM = 'Aims for';

export const objectiveShown = (objective: SearchObjective): string =>
  OBJECTIVES[objective];

export const objectiveNote = (objective: SearchObjective): string =>
  OBJECTIVE_NOTES[objective];

export const objectiveSuggestedShown = (rate: number): string =>
  `Chosen for you: the live config already succeeds on ${percentShown(rate)} of this set, so there is little room to succeed more.`;

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
    'It beat the live config on the tasks the search could see, but not on the held-out tasks it never saw, so the gain may not carry over to new work.',
  'too-few-held-out':
    'It beat the live config on the tasks the search could see, but too few held-out tasks were scored to tell whether the gain carries over to new work.',
};

export const onlyOnSeenTasksShown = (mark: OnlyOnSeenTasks): string =>
  ONLY_ON_SEEN_TASKS[mark];

export const onlyOnSeenTasksNote = (mark: OnlyOnSeenTasks): string =>
  ONLY_ON_SEEN_TASKS_NOTES[mark];

export const ONLY_ON_SEEN_TASKS_PICK =
  'Its gain showed only on the tasks the search could see. You can still pick it, but the gain may not carry over to new work.';

export const onlyOnSeenTasksCountShown = (count: number): string =>
  `${count} ${count === 1 ? 'candidate' : 'candidates'} on the frontier gained only on the tasks the search could see, not on the held-out ones.`;

export const SEARCH_CEILING_NOTE =
  'The most the whole search may spend: its replays and its agent’s runs.';
