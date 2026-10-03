import type {
  ConfigPullRequestReasonResponseDto,
  ReplayCheckResponseDto,
  SearchCandidateResponseDto,
  SearchEstimateResponseDto,
  SearchIterationResponseDto,
  SearchResponseDto,
} from '@/lib/api';
import { minGainShown, pointsShown } from '@/lib/replay-words';

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
      return 'Nobody has measured how much this set’s success moves by chance, so a small gain may be luck. Measure its noise on the set page, or replay each run more than once.';
    case 'noisy': {
      const fix =
        warning.neededRepeats > warning.suggestedRepeats
          ? `Even replaying each run ${warning.suggestedRepeats} times, the most allowed, won’t bring it under that, so read small gains with care or raise the line’s smallest real gain.`
          : `Replaying each run ${warning.suggestedRepeats} times would bring that down.`;

      return `This set’s success moved ${pointsShown(warning.spread)} between copies of the same runs, more than the ${minGainShown(warning.minGain)} the line counts as real. ${fix}`;
    }
  }
};

export const repeatsSuggestionShown = (repeats: number): string =>
  `Replay each run ${repeats} times`;

export const GAIN_ON_SEARCHED = 'Gain over the live config, searched';

export const GAIN_ON_HELD_OUT = 'Gain over the live config, held out';

export const BEST_LABEL = 'Best:';

export const bestOnShown = (heldOut: boolean): string =>
  heldOut ? 'held out' : 'searched';
