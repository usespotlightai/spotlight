import type { NoticeWords } from '@replays/application/rendering/reflection-notice';
import { FEWEST_SEARCH_TASKS } from '@replays/domain/value-objects/held-out-split.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type { SearchPickDecline } from '@replays/domain/value-objects/search-pick';
import type { SearchSkipReason } from '@replays/domain/value-objects/search-skip-reason';

export const ADVISED_SKIP_REASONS = [
  'no-scoring',
  'set-too-small',
  'no-headroom',
  'ceiling-too-low',
  'no-agent',
] as const satisfies readonly SearchSkipReason[];

export type AdvisedSkipReason = (typeof ADVISED_SKIP_REASONS)[number];

export const isAdvised = (
  reason: SearchSkipReason,
): reason is AdvisedSkipReason =>
  (ADVISED_SKIP_REASONS as readonly SearchSkipReason[]).includes(reason);

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
};

const ADVICE: Readonly<Record<AdvisedSkipReason, readonly string[]>> = {
  'no-scoring': [
    'The station has no judge and no check. Spotlight cannot score a config without one of them.',
    'Please add a judge or a check to the station in the Terraform of the line.',
  ],
  'set-too-small': [
    'The replay set of the station has too few tasks. Spotlight adds tasks from new runs of the station.',
    `Minimum tasks required: ${FEWEST_SEARCH_TASKS}`,
  ],
  'no-headroom': [
    'The live config does not do better on the replay set when it gets the answer. A search has no room to improve it.',
    'Please add harder tasks to the station, or change its judge or check.',
  ],
  'ceiling-too-low': [
    'The search ceiling is too low to replay each task of the set for each candidate.',
    'Please raise the search ceiling in the search policy of the line.',
  ],
  'no-agent': [
    'No runner can start the harness of the search agent.',
    'Please set a harness for the station, or an agent in its search policy.',
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
