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

export const SKIP_ADVICE: Readonly<
  Record<AdvisedSkipReason, readonly string[]>
> = {
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
