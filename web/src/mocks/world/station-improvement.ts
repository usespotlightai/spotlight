import type {
  CandidatePullRequestResponseDto,
  StationImprovementResponseDto,
} from '@/lib/api';
import { ongoing } from '@/lib/search';
import {
  type ImprovementStatus,
  isTransientSkip,
} from '@/lib/station-improvement';
import { hoursAgo } from '@/mocks/clock';
import { perWorld } from '@/mocks/world';
import { stationOf } from '@/mocks/world/station-insights';
import {
  type SearchSpec,
  searchStore,
  searchSummaryOf,
} from '@/mocks/world/station-searches';
import {
  MIN_SEARCH_TASKS,
  replaySetOf,
  setStore,
} from '@/mocks/world/station-sets';

type Improvement = StationImprovementResponseDto;

const OPEN = ['opening', 'opened', 'closing'];

const QUIET: Improvement = {
  status: 'waiting',
  searchId: null,
  pickPhase: null,
  pullRequestUrl: null,
  improvedAt: null,
  skip: null,
  pullRequestFailure: null,
  minimumTasks: MIN_SEARCH_TASKS,
  setId: null,
  lastStartedAt: null,
  checkAfter: null,
};

const PULL_REQUEST = 'https://github.com/acme/platform/pull/61';

export const shownImprovements = perWorld(
  () => new Map<string, ImprovementStatus>(),
);

const pullRequestsOf = (
  searches: readonly SearchSpec[],
): CandidatePullRequestResponseDto[] =>
  searches.flatMap((each) =>
    each.candidates.flatMap((candidate) =>
      candidate.pullRequest ? [candidate.pullRequest] : [],
    ),
  );

const shown = (
  status: ImprovementStatus,
  facts: Improvement,
  newest: SearchSpec | undefined,
): Improvement => {
  switch (status) {
    case 'searching':
      return { ...facts, status, searchId: newest?.id ?? 'search_shown' };
    case 'picking':
      return {
        ...facts,
        status,
        searchId: newest?.id ?? 'search_shown',
        pickPhase: 'choosing',
      };
    case 'pull-request-open':
      return { ...facts, status, pullRequestUrl: PULL_REQUEST };
    case 'improved':
      return {
        ...facts,
        status,
        pullRequestUrl: PULL_REQUEST,
        improvedAt: hoursAgo(20),
      };
    case 'not-improving':
      return {
        ...facts,
        status,
        skip: { reason: 'no-scoring', at: hoursAgo(6) },
      };
    default:
      return { ...facts, status };
  }
};

export const stationImprovement = (
  teamId: string,
  lineId: string,
  stationId: string,
): Improvement => {
  const spec = setStore().find(
    (each) => each.lineId === lineId && each.stationId === stationId,
  );
  const set = spec ? replaySetOf(spec) : null;
  const searches = searchStore()
    .filter((each) => searchSummaryOf(each).stationId === stationId)
    .sort((one, other) => one.startedHoursAgo - other.startedHoursAgo);
  const newest = searches[0];
  const newestSummary = newest && searchSummaryOf(newest);
  const pullRequests = pullRequestsOf(searches);
  const open = pullRequests.find((each) => OPEN.includes(each.state));
  const schedule = set?.searchSchedule ?? null;
  const facts: Improvement = {
    ...QUIET,
    setId: set?.id ?? null,
    lastStartedAt: newestSummary?.startedAt ?? null,
    checkAfter: schedule?.checkAfter ?? null,
  };
  const forced = shownImprovements().get(stationId);

  if (forced) {
    return shown(forced, facts, newest);
  }

  const lastSkip = schedule?.lastSkip ?? null;
  const improvedAt = schedule?.lastImprovedAt ?? null;
  const pick = newestSummary?.pick ?? null;
  const picked = pick?.outcome === 'picked' ? pick.candidateId : null;
  const pickHasPullRequest = Boolean(
    newest?.candidates.some(
      (each) => each.candidate.id === picked && each.pullRequest,
    ),
  );

  if (newest && ongoing(newest.state)) {
    return { ...facts, status: 'searching', searchId: newest.id };
  }
  if (newest && newest.state === 'finished' && !pick) {
    return {
      ...facts,
      status: 'picking',
      searchId: newest.id,
      pickPhase: 'choosing',
    };
  }
  if (newest && picked && !pickHasPullRequest) {
    return {
      ...facts,
      status: 'picking',
      searchId: newest.id,
      pickPhase: 'opening',
    };
  }
  if (open) {
    return { ...facts, status: 'pull-request-open', pullRequestUrl: open.url };
  }
  if (!stationOf(teamId, lineId, stationId)?.search?.enabled) {
    return { ...facts, status: 'off' };
  }
  if (!set || set.entries.length === 0) {
    return { ...facts, status: 'not-started' };
  }
  if (
    lastSkip &&
    !isTransientSkip(lastSkip.reason) &&
    (!improvedAt || lastSkip.at > improvedAt)
  ) {
    return { ...facts, status: 'not-improving', skip: lastSkip };
  }
  if (
    improvedAt &&
    (!facts.lastStartedAt || improvedAt >= facts.lastStartedAt)
  ) {
    return { ...facts, status: 'improved', improvedAt };
  }

  return { ...facts, status: 'waiting' };
};
