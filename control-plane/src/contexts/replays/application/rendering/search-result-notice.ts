import type { NoticeWords } from '@replays/application/rendering/reflection-notice';
import {
  isTransientSkip,
  type TRANSIENT_SKIP_REASONS,
} from '@replays/domain/services/station-improvement';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type { SearchPickDecline } from '@replays/domain/value-objects/search-pick';
import type { SearchSkipReason } from '@replays/domain/value-objects/search-skip-reason';

export type AdvisedSkipReason = Exclude<
  SearchSkipReason,
  (typeof TRANSIENT_SKIP_REASONS)[number]
>;

export const isAdvised = (
  reason: SearchSkipReason,
): reason is AdvisedSkipReason => !isTransientSkip(reason);

const candidateLine = (name: string, objective: SearchObjective): string =>
  objective === 'cost'
    ? `Candidate ${name} cost less per run than the live config and did as well on the held-out tasks.`
    : `Candidate ${name} did better than the live config on the held-out tasks.`;

const stationOf = (name: string | null): string =>
  name ? `the ${name} station` : 'a station';

const DECLINES: Readonly<Record<SearchPickDecline, string>> = {
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

const ADVICE: Readonly<Record<AdvisedSkipReason, readonly string[]>> = {
  'no-scoring': [
    'The station has no judge and no check. Spotlight cannot score a config without one of them.',
    'Please add a judge or a check to the station in the Terraform of the line.',
  ],
  'ceiling-too-low': [
    'The search ceiling is too low to replay each task of the set for each candidate.',
    'Please raise the search ceiling in the search policy of the line.',
  ],
  'no-agent': [
    'No runner can start the harness of the search agent.',
    'Please set a harness for the station, or an agent in its search policy.',
  ],
  noisy: [
    'Success moves too much between repeats of the same runs. Spotlight cannot tell configs apart on the replay set.',
    'Please make the judge or the check of the station give the same result for the same work.',
  ],
  'judge-unstable': [
    'The judge of the station does not give the same verdict twice for the same run.',
    'Please make the rubric of the judge more exact.',
  ],
  'flaky-checks': [
    'The check of the station gives a different result when it runs twice on the same change.',
    'Please fix the check of the station.',
  ],
};

export interface PickedResult {
  readonly stationName: string | null;
  readonly candidateName: string;
  readonly objective: SearchObjective;
  readonly stalled: readonly string[];
}

export const SearchResultWording = {
  opened(picked: PickedResult, url: string): NoticeWords {
    return {
      headline: `Spotlight opened a config pull request for ${stationOf(picked.stationName)}`,
      points: [
        candidateLine(picked.candidateName, picked.objective),
        `Pull request: ${url}`,
        'Please review the pull request. The station changes when you merge it.',
        ...picked.stalled,
      ],
    };
  },

  failed(picked: PickedResult, reason: string): NoticeWords {
    return {
      headline: `Sorry, the config pull request for ${stationOf(picked.stationName)} could not be opened`,
      points: [
        candidateLine(picked.candidateName, picked.objective),
        `Reason: ${reason}`,
        ...picked.stalled,
      ],
    };
  },

  declined(
    stationName: string | null,
    reason: SearchPickDecline,
    stalled: readonly string[],
  ): NoticeWords {
    return {
      headline: `The search of ${stationOf(stationName)} ended with no pull request`,
      points: [DECLINES[reason], ...stalled],
    };
  },

  skipped(stationName: string | null, reason: AdvisedSkipReason): NoticeWords {
    return {
      headline: `Spotlight cannot search ${stationOf(stationName)}`,
      points: ADVICE[reason],
    };
  },
};
