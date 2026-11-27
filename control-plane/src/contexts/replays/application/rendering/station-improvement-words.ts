import {
  declineOf,
  STOPS,
} from '@replays/application/rendering/search-result-notice';
import { SKIP_ADVICE } from '@replays/application/rendering/skip-advice';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { FEWEST_SEARCH_TASKS } from '@replays/domain/value-objects/held-out-split.vo';
import {
  isLastingSkip,
  type SearchSkipReason,
} from '@replays/domain/value-objects/search-skip-reason';
import { isCutShort } from '@replays/domain/value-objects/search-stop-reason';

const PASSING_SKIPS: Readonly<
  Record<Exclude<SearchSkipReason, keyof typeof SKIP_ADVICE>, string>
> = {
  cooldown:
    'The cooldown after the last search has not passed. Spotlight looks again when it ends.',
  'pull-request-open':
    'A config pull request for the station is open. Spotlight looks again once a person merges or closes it.',
  'monthly-ceiling':
    'The searches of the line spent their monthly ceiling. Spotlight looks again next month.',
  'set-too-small': `The replay set has too few tasks. A search needs at least ${FEWEST_SEARCH_TASKS}. Spotlight adds the station’s new runs to the set.`,
  'no-fresh-held-out':
    'Earlier searches searched on the tasks a search would hold out. Spotlight waits for new tasks.',
  'no-headroom':
    'The live config already does about as well as the best past runs on the replay set. Spotlight waits for harder tasks.',
};

export const skipReasonText = (reason: SearchSkipReason): string =>
  isLastingSkip(reason) ? SKIP_ADVICE[reason].join(' ') : PASSING_SKIPS[reason];

export const searchResultText = (search: Search): string | null => {
  const reason = search.stopReason;

  if (search.current === 'stopped') {
    return reason && isCutShort(reason) ? STOPS[reason] : 'The search stopped.';
  }
  if (search.isActive) {
    return null;
  }
  if (search.awaitsPick) {
    return 'Spotlight is picking a candidate.';
  }

  const picked = search.pickedCandidate;

  if (picked) {
    const name = search.proposals.find((each) =>
      each.candidateId.equals(picked),
    )?.name.value;

    return `Spotlight picked candidate ${name ?? picked.value} for a config pull request.`;
  }

  const { pick } = search;

  return pick?.outcome === 'declined'
    ? declineOf(pick.reason, {
        candidateFinished: search.anyCandidateFinished,
      })
    : null;
};
