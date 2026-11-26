import type { StationChangeRefusal } from '@replays/application/contracts/station-change-tests.contract';
import { SKIP_ADVICE } from '@replays/application/rendering/skip-advice';
import { FEWEST_SEARCH_TASKS } from '@replays/domain/value-objects/held-out-split.vo';

export interface RequestLimit {
  readonly perDay: number;
  readonly resetsAt: Date;
}

export interface RefusalDetail {
  readonly requestLimit?: RequestLimit;
}

const NO_DETAIL: RefusalDetail = {};

const advised = (reason: keyof typeof SKIP_ADVICE): string =>
  SKIP_ADVICE[reason].join(' ');

const day = (at: Date): string => at.toISOString().slice(0, 10);

const time = (at: Date): string =>
  `${day(at)} ${at.toISOString().slice(11, 16)} UTC`;

const REASONS: Readonly<
  Record<Exclude<StationChangeRefusal, 'monthly-ceiling'>, string>
> = {
  'station-gone': 'The station is no longer on the line.',
  'not-replayable': 'The station has no live config that Spotlight can replay.',
  'search-off': 'Search is off for the station in the Terraform of the line.',
  'no-replay-set':
    'The station has no replay set yet. Spotlight keeps one when the station has enough finished runs.',
  'result-pending':
    'The last search of the station has not given its result yet.',
  'search-running':
    'A search of the station is running and takes no more candidates.',
  'request-limit': 'The station took the most requested tests for today.',
  'pull-request-open':
    'A config pull request for the station is open. A person must merge or close it first.',
  'no-scoring': advised('no-scoring'),
  'no-agent': advised('no-agent'),
  'set-too-small': `The replay set of the station has too few tasks to measure a change. Minimum tasks required: ${FEWEST_SEARCH_TASKS}`,
  'no-fresh-held-out':
    'Earlier searches used the held-out tasks of the replay set. Spotlight has no fresh held-out tasks to measure the change on.',
  'ceiling-too-low': advised('ceiling-too-low'),
  noisy: advised('noisy'),
  'judge-unstable': advised('judge-unstable'),
  'judge-disagrees-with-people': advised('judge-disagrees-with-people'),
  'flaky-checks': advised('flaky-checks'),
  'no-headroom':
    'The live config already does about as well as the best past runs on the replay set. A change cannot show a gain.',
};

const requestLimit = (limit: RequestLimit | undefined): string =>
  limit
    ? `${REASONS['request-limit']} Maximum requests a day: ${limit.perDay}. The count resets at ${time(limit.resetsAt)}. To allow more, set requests_per_day in the search block of the station or of the line in Terraform.`
    : REASONS['request-limit'];

export const stationChangeRefusalReason = (
  refusal: StationChangeRefusal,
  nextMonthStart: Date,
  detail: RefusalDetail = NO_DETAIL,
): string => {
  if (refusal === 'monthly-ceiling') {
    return `The searches of the line reached their monthly ceiling. Next month starts: ${day(nextMonthStart)}`;
  }

  return refusal === 'request-limit'
    ? requestLimit(detail.requestLimit)
    : REASONS[refusal];
};
