import { SKIP_ADVICE } from '@replays/application/rendering/skip-advice';
import { REQUESTS_PER_DAY } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { FEWEST_SEARCH_TASKS } from '@replays/domain/value-objects/held-out-split.vo';
import type { StationChangeRefusal } from '@work/application/ports/station-change-tests.port';

const advised = (reason: keyof typeof SKIP_ADVICE): string =>
  SKIP_ADVICE[reason].join(' ');

const day = (at: Date): string => at.toISOString().slice(0, 10);

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
  'request-limit': `The station took the most requested tests for today. Maximum requests a day: ${REQUESTS_PER_DAY}`,
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
  'flaky-checks': advised('flaky-checks'),
  'no-headroom':
    'The live config already does about as well as the best past runs on the replay set. A change cannot show a gain.',
};

export const stationChangeRefusalReason = (
  refusal: StationChangeRefusal,
  nextMonthStart: Date,
): string =>
  refusal === 'monthly-ceiling'
    ? `The searches of the line reached their monthly ceiling. Next month starts: ${day(nextMonthStart)}`
    : REASONS[refusal];
