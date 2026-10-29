import type { NoticeWords } from '@replays/application/rendering/reflection-notice';
import {
  isTransientSkip,
  type SearchSkipReason,
  type TRANSIENT_SKIP_REASONS,
} from '@replays/domain/value-objects/search-skip-reason';

export type AdvisedSkipReason = Exclude<
  SearchSkipReason,
  (typeof TRANSIENT_SKIP_REASONS)[number]
>;

export const isAdvised = (
  reason: SearchSkipReason,
): reason is AdvisedSkipReason => !isTransientSkip(reason);

const percent = (value: number): number => Math.round(value * 100);

const pointsOf = (gain: number): string =>
  `${gain >= 0 ? '+' : '−'}${Math.abs(percent(gain))} points`;

const stationOf = (name: string | null): string =>
  name ? `the ${name} station` : 'a station';

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
  readonly changes: readonly string[];
  readonly heldOutGain: number | null;
}

const changeOf = (picked: PickedResult): string =>
  picked.changes.length > 0
    ? `Candidate ${picked.candidateName} changes ${picked.changes.join(', ')}.`
    : `Candidate ${picked.candidateName} changes the station config.`;

const gainOf = (picked: PickedResult): string =>
  picked.heldOutGain === null
    ? 'Held-out gain: not measured'
    : `Held-out gain: ${pointsOf(picked.heldOutGain)}`;

export const SearchResultWording = {
  opened(picked: PickedResult): NoticeWords {
    return {
      headline: `Spotlight opened a config pull request for ${stationOf(picked.stationName)}`,
      points: [changeOf(picked), gainOf(picked)],
    };
  },

  failed(picked: PickedResult, reason: string): NoticeWords {
    return {
      headline: `Sorry, the config pull request for ${stationOf(picked.stationName)} could not be opened`,
      points: [changeOf(picked), `Reason: ${reason}`],
    };
  },

  stalled(stationName: string | null, fixes: readonly string[]): NoticeWords {
    return {
      headline: `The search of ${stationOf(stationName)} stalled on causes outside the config`,
      points: fixes,
    };
  },

  skipped(stationName: string | null, reason: AdvisedSkipReason): NoticeWords {
    return {
      headline: `Spotlight cannot search ${stationOf(stationName)}`,
      points: ADVICE[reason],
    };
  },
};
